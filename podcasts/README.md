# Philosopher en podcasts

Site statique (zéro serveur, zéro base de données) publié sur GitHub Pages :
**20 grands auteurs de la philosophie, 10 séances de 25 minutes par auteur**,
soit 200 épisodes. Chaque séance est une fiche écrite pour être lue à voix
haute — la voix est assurée par **Voxtral** (synthèse vocale de Mistral), et les
fiches peuvent être produites par **Mistral Large**.

- Accueil : [`podcasts/index.html`](index.html) → liste des 20 parcours, filtre, progression
- Parcours d'un auteur : `podcasts/parcours.html?auteur=kant` → 10 séances, lecteur audio fixe
  (lecture, reprise, vitesse, enchaînement automatique), fiches dépliables
- Flux RSS compatible Apple Podcasts : [`podcasts/feed.xml`](feed.xml)

## Structure

```
podcasts/
  index.html / parcours.html   pages
  css/podcasts.css             style (même identité que le site racine)
  js/player.js                 données + lecteur + progression (localStorage)
  js/app.js / js/parcours.js   rendu des deux pages
  data/auteurs.json            les 20 auteurs × 10 séances (titre, résumé, durée)
  data/audio.json              manifeste des épisodes dont le mp3 existe (régénéré par tools/build_feed.py) ; l'interface affiche « audio à générer » pour les autres
  fiches/<auteur>/<NN>.md      fiches lues à voix haute (Kant rédigé en exemple)
  audio/<auteur>/<NN>.mp3      épisodes générés par Voxtral (à produire)
  feed.xml                     flux RSS (régénéré par tools/build_feed.py)
  tools/                       scripts de génération (voir ci-dessous)
```

Convention de nommage : `fiches/kant/01.md` ↔ `audio/kant/01.mp3`.

## Produire le contenu (une seule fois, avec votre clé Mistral)

Jamais de clé dans le dépôt : tout se lit dans la variable d'environnement
`MISTRAL_API_KEY`.

```bash
cd podcasts
export MISTRAL_API_KEY="..."   # votre clé, sur votre machine uniquement

# 1. Générer les fiches (scripts oraux ~25 min) avec Mistral Large
python3 tools/generate_fiches.py                  # toutes les fiches manquantes
python3 tools/generate_fiches.py --auteur kant    # un seul auteur
# (les fiches de Kant sont déjà rédigées à la main dans fiches/kant/ ;
#  --force les régénère via l'API)

# 2. Lire les fiches avec Voxtral → épisodes mp3
python3 tools/generate_audio.py                   # tous les épisodes manquants
python3 tools/generate_audio.py --auteur kant    # un auteur
python3 tools/generate_audio.py --auteur kant --seance 1 --force

# 3. Régénérer le flux RSS + le manifeste de disponibilité audio
python3 tools/build_feed.py    # écrit feed.xml ET data/audio.json
```

Astuces :
- `--dry-run` sur les deux scripts affiche ce qui serait envoyé à l'API sans rien appeler.
- `--model` permet de changer de modèle (`mistral-large-latest` pour les fiches,
  `voxtral-small-latest` / `voxtral-mini-latest` pour la voix) ; `--voice` choisit la voix Voxtral.
- Les scripts n'utilisent que la bibliothèque standard de Python : aucun `pip install`.
- Test rapide du prompt de fiche : `python3 tools/generate_fiches.py --dry-run --auteur kant --seance 1`

## Hébergement de l'audio

GitHub Pages accepte des dépôts jusqu'à ~1 Go. 200 épisodes de 25 min en mp3
(~128 kbit/s) représentent plusieurs gigaoctets : pour la production complète,
héberger les mp3 ailleurs (hébergement de fichiers, CDN) ou utiliser Git LFS,
puis régler `--base` de `tools/build_feed.py` et/ou les chemins `audio/` dans
`data/auteurs.json`. Pour tester, quelques épisodes suffisent dans `audio/`.

## Tester en local

```bash
cd podcasts
python3 -m http.server 8765
# ouvrir http://localhost:8765/
```

Le lecteur fonctionne dès qu'un fichier `audio/<auteur>/<NN>.mp3` existe ;
sinon la séance affiche une notice indiquant de lancer `tools/generate_audio.py`.
La progression d'écoute se sauvegarde dans le navigateur (localStorage).

## Publier

Commit + push sur `main` (ou merge de la PR) : GitHub Pages republish
automatiquement en 1–2 minutes à l'adresse
`https://clementhebertdebeauvoir-coder.github.io/podcasts/`.
