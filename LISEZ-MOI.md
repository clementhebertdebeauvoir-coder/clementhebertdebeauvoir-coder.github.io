# Comment publier cette nouvelle version sur GitHub

Les 4 fichiers de cette refonte sont dans ce dossier `site/` :

```
site/
  index.html
  style.css
  posts/
    bienvenue.html
    comment-publier-un-article.html
```

## Méthode 1 — Édition directe sur github.com (la plus simple)

1. Aller sur https://github.com/clementhebertdebeauvoir-coder/clementhebertdebeauvoir-coder.github.io
2. Pour chaque fichier (index.html, style.css, posts/bienvenue.html, posts/comment-publier-un-article.html) :
   - cliquer sur le fichier → bouton crayon « Edit this file »
   - tout sélectionner (Ctrl+A) et coller le contenu du fichier local correspondant
   - en bas, choisir « Commit changes »
3. Attendre 1 à 2 minutes : GitHub Pages republie automatiquement le site.

## Méthode 2 — En local avec git

```bash
git clone https://github.com/clementhebertdebeauvoir-coder/clementhebertdebeauvoir-coder.github.io
# copier les 4 fichiers de ce dossier dans le clone, puis :
cd clementhebertdebeauvoir-coder.github.io
git add .
git commit -m "Refonte visuelle du carnet"
git push
```

## Aperçu local

Un serveur local tourne pendant la session sur http://localhost:8765/
(il sert ce dossier `site/`). Ouvrir cette adresse dans un navigateur
pour voir le rendu avant publication.
