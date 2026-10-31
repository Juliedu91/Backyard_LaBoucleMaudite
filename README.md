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

## Créer plusieurs salles et suivre les équipes

Depuis une page de contrôle `index.html`, ouvre **Réglages**, saisis le nom d’un groupe dans **Créer plusieurs salles**, puis clique **Créer la salle**. Répète l’action pour chaque groupe. Chaque salle reçoit un code indépendant et deux liens : envoie **Ouvrir le lien spectateur** au groupe concerné et garde **Ouvrir le contrôle** pour les organisateurs.

Les salles créées sont ajoutées automatiquement au tableau `admin.html` dans le même navigateur. Si le tableau est déjà ouvert, il se met à jour; sinon ouvre-le après la création. La liste est conservée dans le stockage local de l’organisateur et ne se partage pas entre appareils. Pour suivre ces salles sur un autre navigateur/appareil, ajoute manuellement chaque nom et code de salle dans le tableau.

Le tableau se met à jour à partir des mêmes salles ntfy.sh que les pages de contrôle et de spectateur. Les codes de salle donnent accès à ces flux; partage-les uniquement avec les personnes qui en ont besoin.

## Contribuer

Travaille sur une branche dédiée, fais des commits courts par sujet, puis pousse la branche sur GitHub et ouvre une pull request vers `main`. Demande à la propriétaire du dépôt de relire et fusionner la PR.
