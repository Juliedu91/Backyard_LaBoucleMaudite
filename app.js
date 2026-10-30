// ---- Interface et état du chronomètre ----
const $=id=>document.getElementById(id);
let startAt=null,timer=null,lastLap=0,lastSec=null,ac=null,wl=null,zoneFired=false,pausedAt=null,seeking=false;
let hapticMilestones=new Set();
function ensureAudioContext(){
  if(ac)return ac;
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextClass)return null;
  try{ac=new AudioContextClass()}catch(e){}
  return ac;
}
const nowT=()=>pausedAt||Date.now();
const pad=n=>String(n).padStart(2,'0');
const fmt=s=>{s=Math.max(0,Math.floor(s));return pad(Math.floor(s/60))+':'+pad(s%60)};

function tick(){
  const lapMs=Math.max(0.1,parseFloat($('dur').value)||60)*60000;
  const km=parseFloat($('km').value)||0;
  const el=nowT()-startAt;
  const lap=Math.floor(el/lapMs)+1;
  const remMs=lapMs-(el%lapMs);
  const rem=Math.ceil(remMs/1000);
  $('lap').textContent='Tour '+lap;
  $('time').textContent=fmt(rem);
  $('fill').style.width=(100*(el%lapMs)/lapMs)+'%';
  if(!seeking){$('seek').max=Math.round(lapMs/1000);$('seek').value=Math.floor((el%lapMs)/1000);}
  $('seekv').textContent=fmt((el%lapMs)/1000);$('seekmax').textContent=fmt(lapMs/1000);
  const zoneSec=Math.round(lapMs/1000*((parseFloat($('pct').value)||8.33)/100));
  const inZone=rem<=zoneSec;
  document.body.classList.toggle('zone',inZone);
  if(inZone&&!pausedAt&&startAt)musicUpdate(Math.min(1,Math.max(0,1-rem/zoneSec)));else if(!musTest)musicStop();
  const cls=inZone&&rem<=Math.min(60,zoneSec/2)?'bad':inZone?'warn':'';
  document.body.classList.toggle('hot',cls==='bad');document.body.classList.toggle('crit',inZone&&rem<=10);
  $('time').className='time '+cls;
  $('fill').style.background=cls==='bad'?'var(--bad)':cls==='warn'?'var(--warn)':'var(--ok)';
  const t=Math.floor(el/1000);
  $('total').textContent=pad(Math.floor(t/3600))+':'+pad(Math.floor(t%3600/60))+':'+pad(t%60);
  $('dist').textContent=((lap-1)*km).toFixed(1).replace('.',',')+' km';
  $('sub').textContent=pausedAt?'⏸ EN PAUSE':inZone?'⚠️ Rejoins la ligne de départ !':'Avant d’être éliminé…';
  if(lap!==lastLap){ if(lastLap){if(!laughScheduled)laugh(9,165,.7);document.body.classList.add('boo');setTimeout(()=>document.body.classList.remove('boo'),2500);} lastLap=lap; lastSec=null; zoneFired=false; laughScheduled=false;hapticMilestones.clear(); }
  if(!seeking&&!pausedAt){
    [[10,[45]],[5,[55,70,55]],[1,[150]]].forEach(([mark,pattern])=>{
      if(rem<=mark&&!hapticMilestones.has(mark)){hapticMilestones.add(mark);buzz(pattern)}
    });
  }
  if(rem===1&&!laughScheduled&&!seeking&&!pausedAt){laughScheduled=true;laugh(9,165,.7,remMs/1000);duck(1.4);}
  if(rem!==lastSec){
    lastSec=rem;
    if(seeking||pausedAt){}
    else if(rem<=10&&rem>=1)say(NUM[rem],1.25);
    else if(inZone&&!zoneFired){zoneFired=true;say('Préparez-vous pour le prochain tour');}
    else if(inZone&&rem===60)say('Une minute');
    else if(inZone&&rem===30)say('Trente secondes');
    else if(inZone&&rem%60===0)say('Plus que '+(rem/60)+' minutes');
  }
}

// ---- Sons et retours haptiques ----
let laughBuf=null;
async function loadLaugh(){
  if(laughBuf)return laughBuf;
  ensureAudioContext();
  if(!ac)throw new Error('Audio non disponible sur cet appareil');
  const response=await fetch('assets/laugh.mp3');
  if(!response.ok)throw new Error('Impossible de charger le rire');
  laughBuf=await ac.decodeAudioData(await response.arrayBuffer());
  return laughBuf;
}
// n>=9: rire complet ; n>=3: début du rire ; sinon: un court "ha"
let lastLaugh=null,laughScheduled=false,laughBus=null;
// Safari sur iOS n'expose généralement pas l'API Vibration du Web.
const HAPTIC_SUPPORTED=typeof navigator.vibrate==='function';
if(!HAPTIC_SUPPORTED){
  $('vibe').checked=false;
  $('vibe').disabled=true;
  $('haptic-note').textContent='La vibration web n’est pas disponible dans ce navigateur. Les alertes visuelles et sonores restent actives.';
  $('haptic-note').hidden=false;
}
function buzz(pattern){
  if(!HAPTIC_SUPPORTED||!$('vibe').checked)return false;
  try{navigator.vibrate(0);return navigator.vibrate(pattern)}catch(e){return false}
}
function buzzStop(){if(HAPTIC_SUPPORTED){try{navigator.vibrate(0)}catch(e){}}}
$('vibe').addEventListener('change',()=>{if(!$('vibe').checked)buzzStop()});
function stopLaugh(){
  try{lastLaugh&&lastLaugh.stop()}catch(e){}lastLaugh=null;laughScheduled=false;
  try{buzzStop()}catch(e){}
}
function laugh(n=9,base=165,vol=.7,when=0){
  loadLaugh().then(buf=>{
    if(!laughBus){
      const bg=ac.createGain();bg.gain.value=2.8;
      const c=ac.createDynamicsCompressor();c.threshold.value=-16;c.knee.value=10;c.ratio.value=12;c.attack.value=.003;c.release.value=.25;
      bg.connect(c);c.connect(ac.destination);laughBus=bg;
    }
    const s=ac.createBufferSource();s.buffer=buf;
    const g=ac.createGain();g.gain.value=1;
    s.connect(g);g.connect(laughBus);
    const dur=n>=9?buf.duration:n>=3?Math.min(1.4,buf.duration):.45;
    const off=n>=9||n>=3?0:(base<=120?0.1:0.25);
    const t0=ac.currentTime+Math.max(0,when);
    g.gain.setValueAtTime(1,t0+dur-.12);
    g.gain.linearRampToValueAtTime(0,t0+dur);
    s.start(t0,off,dur);
    lastLaugh=s;
  }).catch(()=>laughSynth(n,base,vol));
}
function laughSynth(n=6,base=170,vol=.5){
  try{
  ensureAudioContext();
  const t0=ac.currentTime+.02;
  const m=ac.createGain();m.gain.value=vol;
  const dl=ac.createDelay();dl.delayTime.value=.2;
  const fb=ac.createGain();fb.gain.value=.4;dl.connect(fb);fb.connect(dl);
  m.connect(ac.destination);m.connect(dl);dl.connect(ac.destination);
  const ws=ac.createWaveShaper(),c=new Float32Array(256);
  for(let i=0;i<256;i++){const x=i/128-1;c[i]=Math.tanh(x*3)}
  ws.curve=c;ws.connect(m);
  let t=t0;
  for(let i=0;i<n;i++){
    const d=i===0&&n>1?.4:.14+Math.random()*.03;
    const f=base*(1-i*.05);
    const o=ac.createOscillator();o.type='sawtooth';
    o.frequency.setValueAtTime(f*1.35,t);
    o.frequency.exponentialRampToValueAtTime(f*.8,t+d);
    const lfo=ac.createOscillator(),lg=ac.createGain();
    lfo.frequency.value=9;lg.gain.value=f*.04;lfo.connect(lg);lg.connect(o.frequency);
    const g=ac.createGain();
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(1,t+.025);
    g.gain.exponentialRampToValueAtTime(.001,t+d);
    [[650,5],[1150,8],[2500,6]].forEach(([fr,q],k)=>{
      const b=ac.createBiquadFilter();b.type='bandpass';b.frequency.value=fr;b.Q.value=q;
      const bg=ac.createGain();bg.gain.value=k===0?1.2:k===1?.8:.3;
      o.connect(b);b.connect(bg);bg.connect(g);
    });
    g.connect(ws);
    o.start(t);lfo.start(t);o.stop(t+d+.05);lfo.stop(t+d+.05);
    t+=d+(i===0&&n>1?.06:.07);
  }
  }catch(e){}
}
const NUM=['zéro','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix'];
function say(txt,rate=.85){
  try{
    if(!$('voice').checked||!window.speechSynthesis)return;
    const u=new SpeechSynthesisUtterance(txt);
    u.lang='fr-FR';
    const fr=speechSynthesis.getVoices().filter(v=>v.lang&&v.lang.toLowerCase().startsWith('fr'));const v=fr.find(v=>/google/i.test(v.name))||fr[0];
    if(v)u.voice=v;
    u.pitch=.6;u.rate=rate;u.volume=1;
    duck(txt.length>12?3.2:1.1);speechSynthesis.cancel();speechSynthesis.speak(u);
  }catch(e){}
}
// ---- Musique ambiante ----
let mus=null,musTest=false,duckT=null;
function kick(t,v){
  const o=ac.createOscillator(),g=ac.createGain();
  o.type='sine';o.frequency.setValueAtTime(130,t);o.frequency.exponentialRampToValueAtTime(38,t+.14);
  g.gain.setValueAtTime(v*.9,t);g.gain.exponentialRampToValueAtTime(.001,t+.24);
  o.connect(g);g.connect(mus.m);o.start(t);o.stop(t+.26);
}
function pluck(t,f,v){
  const o=ac.createOscillator(),g=ac.createGain(),b=ac.createBiquadFilter();
  o.type='sawtooth';o.frequency.value=f;b.type='lowpass';b.frequency.value=1800;
  g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+.1);
  o.connect(b);b.connect(g);g.connect(mus.m);o.start(t);o.stop(t+.12);
}
function musicSched(){
  if(!mus)return;
  const p=mus.p,s16=60/(70+85*p)/4,N=[0,1,0,1,3,1,0,6];
  while(mus.next<ac.currentTime+.3){
    const t=mus.next,k=mus.step%8;
    if(k===0||k===2||(p>.55&&(k===4||k===6)))kick(t,k===2?.7:1);
    if(p>.2){const base=(p>.7&&mus.step%16>=8)?220:110;pluck(t,base*Math.pow(2,N[k]/12),.05+.09*p)}
    mus.step++;mus.next+=s16;
  }
}
function musicStart(){
  if(mus||!$('music').checked)return;
  try{
    ensureAudioContext();
    if(ac.state==='suspended')ac.resume();
    const t=ac.currentTime,oscs=[];
    const m=ac.createGain();m.gain.setValueAtTime(0,t);m.gain.linearRampToValueAtTime(.35,t+2);m.connect(ac.destination);
    const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=250;lp.connect(m);
    [[55,'sawtooth',.2],[55.8,'sawtooth',.2],[82.4,'triangle',.14]].forEach(([f,ty,v])=>{
      const o=ac.createOscillator(),g=ac.createGain();o.type=ty;o.frequency.value=f;g.gain.value=v;o.connect(g);g.connect(lp);o.start();oscs.push(o);
    });
    const lvl=ac.createGain();lvl.gain.value=0;lvl.connect(m);
    const trem=ac.createGain();trem.gain.value=.55;trem.connect(lvl);
    const lfo=ac.createOscillator(),ld=ac.createGain();lfo.frequency.value=5;ld.gain.value=.45;lfo.connect(ld);ld.connect(trem.gain);lfo.start();oscs.push(lfo);
    const bp=ac.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1100;bp.Q.value=.8;bp.connect(trem);
    [233.1,329.6,466.9,659.3].forEach(f=>{
      const o=ac.createOscillator(),g=ac.createGain();o.type='sawtooth';o.frequency.value=f;o.detune.value=(Math.random()-.5)*20;g.gain.value=.25;o.connect(g);g.connect(bp);o.start();oscs.push(o);
    });
    mus={m,lp,lvl,lfo,oscs,p:0,step:0,next:t+.1};
    mus.iv=setInterval(musicSched,90);
  }catch(e){mus=null}
}
function musicUpdate(p){
  if(!mus)musicStart();
  if(!mus)return;
  mus.p=p;const t=ac.currentTime;
  mus.lp.frequency.setTargetAtTime(200+1400*p,t,.3);
  mus.lvl.gain.setTargetAtTime(.04+.22*p,t,.3);
  mus.lfo.frequency.setTargetAtTime(4+7*p,t,.3);
}
function musicStop(){
  if(!mus)return;
  const x=mus;mus=null;clearInterval(x.iv);
  x.m.gain.cancelScheduledValues(ac.currentTime);x.m.gain.setTargetAtTime(0,ac.currentTime,.1);
  setTimeout(()=>x.oscs.forEach(o=>{try{o.stop()}catch(e){}}),700);
}
function duck(sec){
  if(!mus)return;
  const t=ac.currentTime;mus.m.gain.cancelScheduledValues(t);mus.m.gain.setTargetAtTime(.12,t,.05);
  clearTimeout(duckT);
  duckT=setTimeout(()=>{if(mus)mus.m.gain.setTargetAtTime(.35,ac.currentTime,.4)},sec*1000);
}
function musicTest(){
  musTest=true;musicStop();musicUpdate(.8);
  setTimeout(()=>{musTest=false;if(!startAt)musicStop()},7000);
}
// ---- Contrôles et plein écran ----
async function lock(){try{wl=await navigator.wakeLock.request('screen')}catch(e){}}
$('start').onclick=()=>{
  if(startAt)return;
  ensureAudioContext();
  startAt=Date.now();lastLap=0;hapticMilestones.clear();lock();loadLaugh().catch(()=>{});
  try{speechSynthesis.getVoices();const u0=new SpeechSynthesisUtterance(' ');u0.volume=0;speechSynthesis.speak(u0)}catch(e){}
  $('start').textContent='En cours…';$('start').disabled=true;$('pause').disabled=false;$('seek').disabled=false;
  tick();timer=setInterval(tick,200);
  pushState();
};
let resetT=null;
function fullReset(){
  clearTimeout(resetT);resetT=null;stopLaugh();
  musicStop();clearInterval(timer);timer=null;
  startAt=null;pausedAt=null;seeking=false;lastLap=0;lastSec=null;zoneFired=false;musTest=false;hapticMilestones.clear();
  try{speechSynthesis.cancel()}catch(e){}
  try{wl&&wl.release()}catch(e){}
  document.body.classList.remove('paused','zone','boo','hot','crit');
  const s=(parseFloat($('dur').value)||60)*60;
  $('start').textContent='Démarrer';$('start').disabled=false;
  $('pause').disabled=true;$('pause').textContent='Pause';
  $('reset').textContent='Reset';
  $('seek').disabled=true;$('seek').max=Math.round(s);$('seek').value=0;
  $('seekv').textContent='00:00';$('seekmax').textContent=fmt(s);
  $('lap').textContent='Prêt à hurler';
  $('time').textContent=fmt(s);$('time').className='time';
  $('sub').textContent='Avant d’être éliminé…';
  $('fill').style.width='0';$('fill').style.background='var(--ok)';
  $('total').textContent='00:00:00';$('dist').textContent='0,0 km';
  pushState();
}
$('reset').onclick=()=>{
  if(!startAt){fullReset();return;}
  if(resetT){fullReset();return;}
  $('reset').textContent='Confirmer ?';
  resetT=setTimeout(()=>{resetT=null;$('reset').textContent='Reset'},3000);
};

function fit(){
  const app=document.querySelector('.app');
  app.style.zoom=1;
  const full=!!document.fullscreenElement||(innerWidth>=screen.width-2&&innerHeight>=screen.height-2);
  document.documentElement.classList.toggle('fs',full);
  document.getElementById('fs').style.opacity=full?.45:1;
  if(!full)return;
  const w=app.offsetWidth,hh=app.offsetHeight;
  app.style.zoom=Math.max(.6,Math.min(4,(innerWidth-32)/w,(innerHeight-110)/hh));
}
if(!document.documentElement.requestFullscreen)$('fs').style.display='none';
$('fs').onclick=()=>{
  try{document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}catch(e){}
};
['resize','fullscreenchange'].forEach(e=>(e==='resize'?window:document).addEventListener(e,()=>setTimeout(fit,50)));
document.querySelector('details').addEventListener('toggle',fit);
fit();
$('dur').oninput=()=>{if(!startAt){const s=(parseFloat($('dur').value)||60)*60;$('time').textContent=fmt(s);$('seekmax').textContent=fmt(s);$('seek').max=Math.round(s)}};
$('pause').onclick=()=>{
  if(!startAt)return;
  if(pausedAt){startAt+=Date.now()-pausedAt;pausedAt=null;$('pause').textContent='Pause';document.body.classList.remove('paused');lock();}
  else{stopLaugh();pausedAt=Date.now();$('pause').textContent='Reprendre';document.body.classList.add('paused');try{speechSynthesis.cancel()}catch(e){}}
  tick();pushState();
};
let pt=null;function pushSoon(){clearTimeout(pt);pt=setTimeout(pushState,150)}
const seekEl=$('seek');
seekEl.addEventListener('pointerdown',()=>{seeking=true});
['pointerup','pointercancel','change','blur'].forEach(ev=>seekEl.addEventListener(ev,()=>{seeking=false}));
seekEl.addEventListener('input',()=>{
  if(!startAt)return;
  stopLaugh();
  hapticMilestones.clear();
  const lapMs=Math.max(0.1,parseFloat($('dur').value)||60)*60000;
  const L=Math.floor((nowT()-startAt)/lapMs);
  const target=Math.min(parseFloat(seekEl.value),lapMs/1000-1)*1000;
  startAt=nowT()-(L*lapMs+target);
  const zoneSec=Math.round(lapMs/1000*((parseFloat($('pct').value)||8.33)/100));
  zoneFired=(lapMs-target)/1000<=zoneSec;
  seeking=true;tick();pushSoon();
});

// ---- Synchronisation multi-appareils (hors Claude, via ntfy.sh) ----
const NTFY='https://ntfy.sh/';
const qs=new URLSearchParams(location.search);
let room=(qs.get('room')||'').replace(/[^a-zA-Z0-9_-]/g,'');
if(!room){
  try{room=localStorage.getItem('bm_room')||''}catch(e){}
  if(!room){const a=new Uint8Array(8);crypto.getRandomValues(a);room=Array.from(a,x=>x.toString(36).padStart(2,'0')).join('').slice(0,12)}
}
try{localStorage.setItem('bm_room',room)}catch(e){}
const isView=qs.get('view')==='1';
const sync={room,topic:'boucle-maudite-'+room,canWrite:!isView,applying:false,lastV:0};
if(!qs.get('room')){try{const u=new URL(location.href);u.searchParams.set('room',room);history.replaceState(null,'',u)}catch(e){}}
function baseUrl(){return location.origin==='null'||location.protocol==='file:'?location.href.split('?')[0]:location.origin+location.pathname}
function pushState(){
  if(!sync.canWrite||sync.applying)return;
  const s={startAt:startAt||0,pausedAt:pausedAt||0,running:!!startAt,
    dur:parseFloat($('dur').value)||60,km:parseFloat($('km').value)||0,pct:parseFloat($('pct').value)||8.33,scream:$('scream').checked,v:Date.now()};
  sync.lastV=s.v;
  fetch(NTFY+sync.topic,{method:'POST',body:JSON.stringify(s)}).catch(()=>{});
}
function unlockAudio(){
  let p=Promise.resolve(false);
  try{
    ensureAudioContext();
    const r=ac.resume?ac.resume():Promise.resolve();
    const b=ac.createBuffer(1,1,22050),s=ac.createBufferSource();s.buffer=b;s.connect(ac.destination);s.start(0);
    loadLaugh().catch(()=>{});
    p=Promise.resolve(r).then(()=>ac.state==='running').catch(()=>false);
  }catch(e){}
  try{const u0=new SpeechSynthesisUtterance(' ');u0.volume=0;speechSynthesis.getVoices();speechSynthesis.speak(u0)}catch(e){}
  return p;
}
function applyState(s){
  sync.applying=true;
  try{
    if(s.dur)$('dur').value=s.dur;
    if(s.km!=null)$('km').value=s.km;
    if(s.pct)$('pct').value=s.pct;
    if(s.scream!==undefined)$('scream').checked=!!s.scream;
    if(!s.running){fullReset()}
    else{
      const was=!!startAt;
      startAt=s.startAt;pausedAt=s.pausedAt||null;
      $('pause').textContent=pausedAt?'Reprendre':'Pause';
      document.body.classList.toggle('paused',!!pausedAt);
      if(pausedAt){stopLaugh();try{speechSynthesis.cancel()}catch(e){}}
      if(!was){
        lastLap=0;lastSec=null;zoneFired=false;
        $('start').textContent='En cours…';$('start').disabled=true;$('pause').disabled=false;$('seek').disabled=false;
        try{lock()}catch(e){}
        timer=setInterval(tick,200);
      }
      tick();
    }
  }finally{sync.applying=false}
}
function handleMsg(raw){
  try{
    const s=JSON.parse(raw);
    if(!s||typeof s.v!=='number'||s.v<=sync.lastV)return;
    sync.lastV=s.v;applyState(s);
  }catch(e){}
}
['dur','km','pct','scream'].forEach(id=>$(id).addEventListener('change',pushState));
(function initSync(){
  const spec=$('spec');spec.hidden=false;
  const links=()=>{
    const b=baseUrl();
    return {view:b+'?room='+sync.room+'&view=1',ctl:b+'?room='+sync.room};
  };
  const copy=(txt,msg)=>{
    const done=()=>{$('shmsg').textContent=msg};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done,()=>{$('shmsg').textContent=txt})}
    else $('shmsg').textContent=txt;
  };
  if(sync.canWrite){
    spec.textContent='📡 Diffusion active — salle '+sync.room;
    $('copyview').onclick=()=>copy(links().view,'Lien spectateur copié ✔');
    $('copyctl').onclick=()=>copy(links().ctl,'Lien contrôle copié ✔ (garde-le pour toi)');
    fetch(NTFY+sync.topic+'/json?poll=1&since=latest').then(r=>r.text()).then(t=>{
      const lines=t.trim().split('\n').filter(Boolean);
      for(let k=lines.length-1;k>=0;k--){
        try{const m=JSON.parse(lines[k]);if(m.event==='message'){const s=JSON.parse(m.message);if(s.running&&!startAt)applyState(s);break}}catch(e){}
      }
    }).catch(()=>{});
  }else{
    document.body.classList.add('spectator');
    $('sharebox').style.display='none';
    spec.hidden=true;
    
    try{
      const es=new EventSource(NTFY+sync.topic+'/sse?since=latest');
      es.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.event==='message')handleMsg(m.message)}catch(_){}};
    }catch(e){spec.textContent='⚠️ Synchronisation indisponible'}
  }
})();

// ---- Messages aux spectateurs ----
const MSGT=NTFY+sync.topic+'-msg';
let bcastT=null,lastMsgId=null;
function chime(){
  try{
    ensureAudioContext();
    const t=ac.currentTime;
    [660,880].forEach((f,i)=>{
      const o=ac.createOscillator(),g=ac.createGain(),s=t+i*.18;
      o.type='sine';o.frequency.value=f;
      g.gain.setValueAtTime(.0001,s);g.gain.exponentialRampToValueAtTime(.35,s+.02);g.gain.exponentialRampToValueAtTime(.001,s+.3);
      o.connect(g);g.connect(ac.destination);o.start(s);o.stop(s+.32);
    });
  }catch(e){}
}
function showMsg(m){
  clearTimeout(bcastT);
  const el=$('bcast');
  if(!m||!m.text){el.hidden=true;lastMsgId=m&&m.id||lastMsgId;return}
  const age=Date.now()-(m.t||0);
  const left=m.dur?m.dur*1000-age:Infinity;
  if(left<=0||age>6*3600e3){el.hidden=true;return}
  el.textContent=m.text;el.hidden=false;
  if(isFinite(left))bcastT=setTimeout(()=>{el.hidden=true},left);
  if(m.id!==lastMsgId){lastMsgId=m.id;chime();buzz([50,70,50]);if(m.say)say(m.text)}
}
function postMsg(m){fetch(MSGT,{method:'POST',body:JSON.stringify(m)}).catch(()=>{})}
if(sync.canWrite){
  $('msgsend').onclick=()=>{
    const text=$('msgtxt').value.trim().slice(0,200);if(!text)return;
    const t=Date.now(),m={text,dur:parseInt($('msgdur').value)||0,say:$('msgvoice').checked,t,id:String(t)};
    postMsg(m);showMsg(m);
  };
  $('msgclear').onclick=()=>{
    const t=Date.now(),m={text:'',t,id:String(t)};
    postMsg(m);showMsg(m);$('msgtxt').value='';
  };
  $('msgtxt').addEventListener('keydown',e=>{if(e.key==='Enter')$('msgsend').click()});
}else{
  try{
    const em=new EventSource(MSGT+'/sse?since=latest');
    em.onmessage=e=>{try{const x=JSON.parse(e.data);if(x.event==='message')showMsg(JSON.parse(x.message))}catch(_){}};
  }catch(e){}
}

// ---- Surveillance du son (le navigateur peut suspendre l'audio) ----
const sndIc=document.createElement('div');
sndIc.id='snd';sndIc.textContent='🔇';sndIc.setAttribute('aria-label','Touche pour activer le son');sndIc.style.display='none';
document.body.appendChild(sndIc);
const needSound=()=>sync.canWrite?(!!ac&&ac.state!=='running'):(!ac||ac.state!=='running');
const refreshSnd=()=>{sndIc.style.display=needSound()?'block':'none'};
['pointerup','click','touchend','keydown'].forEach(ev=>document.addEventListener(ev,()=>{if(needSound())unlockAudio().then(refreshSnd)},true));
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&ac&&ac.state!=='running'){try{ac.resume().then(refreshSnd,()=>{})}catch(e){}}
  refreshSnd();
});
setInterval(()=>{
  if(ac&&ac.state!=='running'){try{ac.resume().then(refreshSnd,()=>{})}catch(e){}}
  refreshSnd();
},1000);
refreshSnd();

// ---- Mes tours (historique personnel, stocké sur l'appareil) ----
const LKEY='bm_laps_'+sync.room;
let myLaps=[],lapClrT=null;
try{myLaps=JSON.parse(localStorage.getItem(LKEY)||'[]')}catch(e){}
const saveLaps=()=>{try{localStorage.setItem(LKEY,JSON.stringify(myLaps))}catch(e){}};
const hms=ms=>{const s=Math.max(0,Math.floor(ms/1000));return pad(Math.floor(s/3600))+':'+pad(Math.floor(s%3600/60))+':'+pad(s%60)};
const mmss=ms=>fmt(Math.floor(ms/1000));
const kmTxt=k=>(Math.round(k*10)/10).toFixed(1).replace('.',',')+' km';
const clk=t=>new Date(t).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
function curLapInfo(){
  if(!startAt)return null;
  const lapMs=Math.max(0.1,parseFloat($('dur').value)||60)*60000;
  const el=nowT()-startAt;
  return {lap:Math.floor(el/lapMs)+1,inLap:el%lapMs,total:el};
}
function renderLaps(){
  $('lapshow').textContent='📋 Mes tours ('+myLaps.length+')';
  const races=[...new Set(myLaps.map(x=>x.race))].sort((a,b)=>b-a);
  let out='';
  if(!races.length)out='<div class="label" style="padding:8px 0">Aucun tour enregistré pour le moment.</div>';
  races.forEach(r=>{
    const L=myLaps.filter(x=>x.race===r).sort((a,b)=>a.lap-b.lap);
    const avg=L.reduce((s,x)=>s+x.tLap,0)/L.length;
    const d=new Date(r);
    out+='<div class="lhead">Course du '+d.toLocaleDateString('fr-FR')+' à '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+' — '+L.length+' tour'+(L.length>1?'s':'')+' · moy. '+mmss(avg)+' · '+kmTxt(L[L.length-1].km)+'</div>';
    L.forEach(x=>{out+='<div class="lrow"><span>Tour <b>'+x.lap+'</b></span><span><b>'+mmss(x.tLap)+'</b></span><span>cumul '+hms(x.tTot)+'</span><span>'+kmTxt(x.km)+'</span><i>'+clk(x.at)+'</i></div>'});
  });
  $('laplist').innerHTML=out;
}
function markLap(){
  const c=curLapInfo();if(!c)return;
  const km=parseFloat($('km').value)||0;
  const e={race:startAt,lap:c.lap,tLap:Math.round(c.inLap),tTot:Math.round(c.total),at:Date.now(),km:Math.round(c.lap*km*100)/100};
  const i=myLaps.findIndex(x=>x.race===e.race&&x.lap===e.lap);
  if(i>=0)myLaps[i]=e;else myLaps.push(e);
  saveLaps();renderLaps();
  try{if($('vibe').checked)buzz([60])}catch(_){}
  $('lapinfo').textContent='Tour '+c.lap+' marqué à '+mmss(c.inLap)+(i>=0?' (mis à jour)':' ✔');
  if($('scream').checked)jumpscare();
}
$('lapmark').onclick=markLap;
$('lapshow').onclick=()=>{const b=$('lapbox');b.hidden=!b.hidden;if(!b.hidden)renderLaps()};
$('lapundo').onclick=()=>{
  if(!myLaps.length)return;
  let k=0;myLaps.forEach((x,i)=>{if(x.at>myLaps[k].at)k=i});
  const x=myLaps.splice(k,1)[0];saveLaps();renderLaps();
  $('lapinfo').textContent='Tour '+x.lap+' supprimé';
};
$('lapcopy').onclick=()=>{
  const rows=['course;tour;temps_au_tour;temps_total;distance_km;heure'];
  [...myLaps].sort((a,b)=>a.race-b.race||a.lap-b.lap).forEach(x=>rows.push([new Date(x.race).toLocaleString('fr-FR'),x.lap,mmss(x.tLap),hms(x.tTot),String(x.km).replace('.',','),clk(x.at)].join(';')));
  const txt=rows.join('\n');
  const done=()=>{$('lapinfo').textContent='Historique copié ✔'};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(done,()=>{$('laplist').textContent=txt});
  else $('laplist').textContent=txt;
};
$('lapclear').onclick=()=>{
  if(lapClrT){clearTimeout(lapClrT);lapClrT=null;myLaps=[];saveLaps();renderLaps();$('lapclear').textContent='Tout effacer';return}
  $('lapclear').textContent='Confirmer ?';
  lapClrT=setTimeout(()=>{lapClrT=null;$('lapclear').textContent='Tout effacer'},3000);
};
setInterval(()=>{
  const c=curLapInfo(),b=$('lapmark');
  b.disabled=!c;
  b.textContent=c?'✅ Tour '+c.lap+' terminé':'✅ Tour terminé';
},500);
renderLaps();

// ---- Screamer (validation d'un tour) ----
const SCR_SVG='<svg viewBox="0 0 200 180" aria-hidden="true"><ellipse cx="100" cy="100" rx="90" ry="72" fill="#E8671C" stroke="#1A1210" stroke-width="5"/><path d="M100 30C62 48 62 150 100 170C138 150 138 48 100 30Z" fill="#F08A3C" stroke="#1A1210" stroke-width="4"/><rect x="92" y="14" width="16" height="22" rx="3" fill="#4A5A28" stroke="#1A1210" stroke-width="4"/><polygon points="34,62 90,84 46,104" fill="#FFE45C" stroke="#1A1210" stroke-width="4" stroke-linejoin="round"/><polygon points="166,62 110,84 154,104" fill="#FFE45C" stroke="#1A1210" stroke-width="4" stroke-linejoin="round"/><circle cx="62" cy="88" r="7" fill="#1A1210"/><circle cx="138" cy="88" r="7" fill="#1A1210"/><path d="M24 122L50 112L64 138L82 114L100 142L118 114L136 138L150 112L176 122Q170 176 100 176Q30 176 24 122Z" fill="#FFE45C" stroke="#1A1210" stroke-width="5" stroke-linejoin="round"/><path d="M56 132L66 150L78 130M122 130L134 150L144 132" fill="#1A1210" stroke="#1A1210" stroke-width="4" stroke-linejoin="round"/></svg>';
function screamSound(){
  try{
    ensureAudioContext();
    if(ac.state==='suspended')ac.resume();
    const t=ac.currentTime,dur=1.3;
    const out=ac.createGain();out.gain.value=1.6;
    const comp=ac.createDynamicsCompressor();comp.threshold.value=-16;comp.knee.value=8;comp.ratio.value=14;comp.attack.value=.002;comp.release.value=.2;
    out.connect(comp);comp.connect(ac.destination);
    const ws=ac.createWaveShaper(),cv=new Float32Array(512);
    for(let i=0;i<512;i++){cv[i]=Math.tanh((i/256-1)*6)}
    ws.curve=cv;ws.oversample='4x';
    const env=ac.createGain();
    env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(1,t+.015);env.gain.setValueAtTime(1,t+dur-.35);env.gain.linearRampToValueAtTime(0,t+dur);
    ws.connect(env);
    const f1=ac.createBiquadFilter(),f2=ac.createBiquadFilter();
    f1.type=f2.type='bandpass';f1.Q.value=4;f2.Q.value=5;
    f1.frequency.setValueAtTime(800,t);f1.frequency.linearRampToValueAtTime(1500,t+.3);f1.frequency.linearRampToValueAtTime(900,t+dur);
    f2.frequency.setValueAtTime(1900,t);f2.frequency.linearRampToValueAtTime(3000,t+.3);f2.frequency.linearRampToValueAtTime(2000,t+dur);
    const g1=ac.createGain(),g2=ac.createGain();g1.gain.value=1.2;g2.gain.value=.7;
    f1.connect(g1);f2.connect(g2);g1.connect(env);g2.connect(env);
    env.connect(out);
    const lfo=ac.createOscillator(),ld=ac.createGain();lfo.frequency.value=34;ld.gain.value=70;lfo.connect(ld);
    [0,-17,23,40].forEach(dt=>{
      const o=ac.createOscillator();o.type='sawtooth';
      o.frequency.setValueAtTime(420,t);o.frequency.exponentialRampToValueAtTime(1500,t+.25);o.frequency.setValueAtTime(1500,t+.25);o.frequency.exponentialRampToValueAtTime(760,t+dur);
      o.detune.value=dt;ld.connect(o.frequency);
      const og=ac.createGain();og.gain.value=.22;o.connect(og);og.connect(ws);og.connect(f1);og.connect(f2);
      o.start(t);o.stop(t+dur+.05);
    });
    lfo.start(t);lfo.stop(t+dur+.05);
    const n=ac.createBuffer(1,Math.floor(ac.sampleRate*dur),ac.sampleRate),d=n.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    const ns=ac.createBufferSource();ns.buffer=n;
    const hp=ac.createBiquadFilter();hp.type='highpass';hp.frequency.value=2500;
    const ng=ac.createGain();ng.gain.setValueAtTime(.7,t);ng.gain.exponentialRampToValueAtTime(.05,t+dur);
    ns.connect(hp);hp.connect(ng);ng.connect(env);ns.start(t);
  }catch(e){}
}
function jumpscare(){
  try{
    const old=document.getElementById('scream');if(old)old.remove();
    const el=document.createElement('div');el.id='scream';el.innerHTML=SCR_SVG;
    el.onclick=()=>el.remove();
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),1550);
    screamSound();
    try{if($('vibe').checked)buzz([250,60,350])}catch(_){}
  }catch(e){}
}
document.addEventListener('visibilitychange',()=>{if(startAt&&!document.hidden)lock()});
