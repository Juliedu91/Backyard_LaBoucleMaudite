const NTFY = 'https://ntfy.sh/';
const STORAGE_KEY = 'bm_admin_teams_v1';

const form = document.getElementById('team-form');
const nameInput = document.getElementById('team-name');
const roomInput = document.getElementById('team-room');
const formMessage = document.getElementById('form-message');
const teamList = document.getElementById('team-list');
const emptyState = document.getElementById('empty-state');
const connectionSummary = document.getElementById('connection-summary');

let teams = loadTeams();
const states = new Map();
const streams = new Map();

function loadTeams() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return [];

    const seenRooms = new Set();
    return saved.filter(team => {
      if (!team || typeof team.name !== 'string' || typeof team.room !== 'string') return false;
      const name = team.name.trim().slice(0, 40);
      const room = team.room.trim();
      if (!name || !isValidRoom(room) || seenRooms.has(room)) return false;
      seenRooms.add(room);
      team.name = name;
      team.room = room;
      return true;
    });
  } catch {
    return [];
  }
}

function isValidRoom(room) {
  return /^[A-Za-z0-9_-]{1,64}$/.test(room);
}

function saveTeams() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
    formMessage.textContent = '';
  } catch {
    formMessage.textContent = 'Impossible d’enregistrer la liste dans ce navigateur.';
  }
}

function makeState(team) {
  return {
    name: team.name,
    room: team.room,
    connected: false,
    received: false,
    running: false,
    pausedAt: 0,
    startAt: 0,
    duration: 60,
    distance: 0,
    alertPercent: 8.33,
    lastVersion: 0,
    changedAt: 0,
    error: false
  };
}

function registerTeam(team) {
  const state = makeState(team);
  states.set(team.room, state);

  const topic = `${NTFY}boucle-maudite-${encodeURIComponent(team.room)}`;
  const stream = new EventSource(`${topic}/sse?since=latest`);
  streams.set(team.room, stream);
  stream.onopen = () => {
    state.connected = true;
    state.error = false;
    render();
  };
  stream.onerror = () => {
    state.connected = false;
    state.error = true;
    render();
  };
  stream.onmessage = event => {
    try {
      const message = JSON.parse(event.data);
      if (message.event === 'message') applyState(state, message.message);
    } catch {
      // Ignore ntfy keep-alive and non-state events.
    }
  };

  loadLatestState(state, topic);
}

async function loadLatestState(state, topic) {
  try {
    const response = await fetch(`${topic}/json?poll=1&since=latest`);
    if (!response.ok) throw new Error('État initial indisponible');
    const body = await response.text();
    const messages = body.split('\n').filter(Boolean);

    for (let index = messages.length - 1; index >= 0; index--) {
      try {
        const message = JSON.parse(messages[index]);
        if (message.event !== 'message') continue;
        applyState(state, message.message);
        return;
      } catch {
        // Skip non-JSON lines and inspect the next event.
      }
    }
    render();
  } catch {
    state.error = true;
    render();
  }
}

function applyState(state, raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || typeof data.v !== 'number' || !Number.isFinite(data.v) || data.v <= state.lastVersion) return;

    state.lastVersion = data.v;
    state.received = true;
    state.running = Boolean(data.running);
    state.startAt = Number(data.startAt) || 0;
    state.pausedAt = Number(data.pausedAt) || 0;
    state.duration = positiveNumber(data.dur, 60);
    state.distance = Math.max(0, Number(data.km) || 0);
    state.alertPercent = positiveNumber(data.pct, 8.33);
    state.changedAt = data.v;
    state.error = false;
    render();
  } catch {
    // Ignore malformed or unrelated messages on the topic.
  }
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function getTimer(state, now = Date.now()) {
  if (!state.running || !state.startAt) return null;
  const durationMs = state.duration * 60 * 1000;
  const elapsedMs = Math.max(0, (state.pausedAt || now) - state.startAt);
  const elapsedInLap = elapsedMs % durationMs;
  return {
    lap: Math.floor(elapsedMs / durationMs) + 1,
    remaining: Math.max(0, Math.ceil((durationMs - elapsedInLap) / 1000)),
    progress: elapsedInLap / durationMs,
    elapsed: elapsedMs,
    paused: Boolean(state.pausedAt)
  };
}

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function formatElapsed(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderTeamCard(state, now) {
  const timer = getTimer(state, now);
  const card = makeElement('article', 'card team-card');
  const header = makeElement('div', 'team-card-header');
  header.append(makeElement('h3', 'team-name', state.name));

  let statusText = 'En attente';
  let statusClass = '';
  if (state.running && state.pausedAt) {
    statusText = 'En pause';
    statusClass = 'paused';
  } else if (state.running) {
    statusText = 'En cours';
    statusClass = 'running';
  }
  header.append(makeElement('span', `team-status ${statusClass}`, statusText));
  card.append(header);

  if (!state.received) {
    card.append(makeElement('p', 'team-timer', '— —'));
    card.append(makeElement('p', 'team-lap', 'Aucun chrono reçu'));
  } else if (!timer) {
    card.append(makeElement('p', 'team-timer', '— —'));
    card.append(makeElement('p', 'team-lap', 'Prête à démarrer'));
  } else {
    const warningSeconds = Math.round(state.duration * 60 * (state.alertPercent / 100));
    const warningClass = timer.remaining <= Math.min(60, warningSeconds / 2) ? 'bad'
      : timer.remaining <= warningSeconds ? 'warn' : '';
    card.append(makeElement('p', `team-timer ${warningClass}`, formatTime(timer.remaining)));
    card.append(makeElement('p', 'team-lap', `Tour ${timer.lap}${timer.paused ? ' · en pause' : ''}`));

    const progress = makeElement('div', 'team-progress');
    progress.setAttribute('role', 'progressbar');
    progress.setAttribute('aria-valuemin', '0');
    progress.setAttribute('aria-valuemax', '100');
    progress.setAttribute('aria-valuenow', String(Math.round(timer.progress * 100)));
    const fill = makeElement('div', 'team-progress-fill');
    fill.style.width = `${Math.round(timer.progress * 100)}%`;
    if (warningClass === 'bad') fill.style.background = 'var(--bad)';
    else if (warningClass === 'warn') fill.style.background = 'var(--warn)';
    progress.append(fill);
    card.append(progress);

    const meta = makeElement('div', 'team-meta');
    meta.append(makeElement('span', '', `Temps total ${formatElapsed(timer.elapsed)}`));
    meta.append(makeElement('span', '', `${(Math.floor(timer.lap - 1) * state.distance).toFixed(1).replace('.', ',')} km`));
    card.append(meta);
  }

  const changedText = state.changedAt
    ? `Dernier changement : ${new Date(state.changedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : 'En attente du premier changement';
  const connectionText = state.connected ? 'Flux connecté' : state.error ? 'Reconnexion au flux…' : 'Connexion au flux…';
  const connection = makeElement('p', 'team-connection', `${connectionText} · ${changedText}`);
  if (!state.connected) connection.classList.add('disconnected');
  card.append(connection);

  const removeButton = makeElement('button', 'remove-team', 'Retirer du tableau');
  removeButton.type = 'button';
  removeButton.dataset.removeRoom = state.room;
  card.append(removeButton);
  return { card, timer };
}

function render() {
  const now = Date.now();
  const sortedStates = [...states.values()].sort((a, b) => {
    const timerA = getTimer(a, now);
    const timerB = getTimer(b, now);
    if (timerA && timerB) return timerA.remaining - timerB.remaining;
    if (timerA) return -1;
    if (timerB) return 1;
    return a.name.localeCompare(b.name, 'fr');
  });

  teamList.replaceChildren();
  for (const state of sortedStates) teamList.append(renderTeamCard(state, now).card);
  emptyState.hidden = teams.length > 0;

  const connected = sortedStates.filter(state => state.connected).length;
  connectionSummary.textContent = teams.length
    ? `${connected}/${teams.length} flux connectés`
    : 'Ajoute les salles des équipes pour commencer.';
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const room = roomInput.value.trim();

  if (!name) {
    formMessage.textContent = 'Saisis le nom de l’équipe.';
    nameInput.focus();
    return;
  }
  if (!isValidRoom(room)) {
    formMessage.textContent = 'Le code doit contenir uniquement des lettres, chiffres, tirets ou tirets bas.';
    roomInput.focus();
    return;
  }
  if (teams.some(team => team.room === room)) {
    formMessage.textContent = 'Cette salle est déjà dans le tableau.';
    roomInput.focus();
    return;
  }

  const team = { name: name.slice(0, 40), room };
  teams.push(team);
  saveTeams();
  registerTeam(team);
  nameInput.value = '';
  roomInput.value = '';
  nameInput.focus();
  render();
});

teamList.addEventListener('click', event => {
  const button = event.target.closest('[data-remove-room]');
  if (!button) return;

  const room = button.dataset.removeRoom;
  streams.get(room)?.close();
  streams.delete(room);
  states.delete(room);
  teams = teams.filter(team => team.room !== room);
  saveTeams();
  render();
});

for (const team of teams) registerTeam(team);
render();
setInterval(render, 1000);
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY) return;
  const updated = loadTeams();
  for (const [room, stream] of streams) {
    if (!updated.some(team => team.room === room)) {
      stream.close();
      streams.delete(room);
      states.delete(room);
    }
  }
  teams = updated;
  for (const team of teams) if (!streams.has(team.room)) registerTeam(team);
  render();
});
