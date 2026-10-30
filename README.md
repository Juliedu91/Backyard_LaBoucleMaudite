# La Boucle Maudite

Petit chronomètre web pour la backyard. L’application reste volontairement sans étape de compilation.

## Fichiers

- `index.html` : structure de la page et réglages visibles.
- `style.css` : styles et animations.
- `app.js` : chronomètre, synchronisation, messages, audio et historique des tours.
- `admin.html`, `admin.css`, `admin.js` : tableau de bord des équipes.
- `assets/` : logo et son du rire.

## Lancer en local

Dans VS Code, ouvre le dossier du dépôt et lance `index.html` avec l’extension **Live Server**. Le serveur local permet au navigateur de charger le son du dossier `assets/`.

La synchronisation utilise ntfy.sh et les polices sont chargées depuis Google Fonts : une connexion Internet est nécessaire pour ces fonctions.

## Tableau des équipes

Ouvre `admin.html` sur l’appareil de l’organisateur. Pour chaque équipe, ajoute un nom et le code affiché après « Diffusion active — salle » sur sa page de contrôle. La liste est conservée dans le stockage local du navigateur de l’organisateur; elle n’est pas partagée avec les participants ni avec ses autres appareils.

Le tableau se met à jour à partir des mêmes salles ntfy.sh que les pages de contrôle et de spectateur. Les codes de salle donnent accès à ces flux; partage-les uniquement avec les personnes qui en ont besoin.

## Contribuer

Travaille sur une branche dédiée, fais des commits courts par sujet, puis pousse la branche sur GitHub et ouvre une pull request vers `main`. Demande à la propriétaire du dépôt de relire et fusionner la PR.
