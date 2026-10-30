# La Boucle Maudite

Petit chronomètre web pour la backyard. L’application reste volontairement sans étape de compilation.

## Fichiers

- `index.html` : structure de la page et réglages visibles.
- `style.css` : styles et animations.
- `app.js` : chronomètre, synchronisation, messages, audio et historique des tours.
- `assets/` : logo et son du rire.

## Lancer en local

Dans VS Code, ouvre le dossier du dépôt et lance `index.html` avec l’extension **Live Server**. Le serveur local permet au navigateur de charger le son du dossier `assets/`.

La synchronisation utilise ntfy.sh et les polices sont chargées depuis Google Fonts : une connexion Internet est nécessaire pour ces fonctions.

## Contribuer

Travaille sur une branche dédiée, fais des commits courts par sujet, puis pousse la branche sur GitHub et ouvre une pull request vers `main`. Demande à la propriétaire du dépôt de relire et fusionner la PR.
