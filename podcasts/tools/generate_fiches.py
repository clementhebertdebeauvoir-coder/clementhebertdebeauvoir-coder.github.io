#!/usr/bin/env python3
"""Génère les fiches (scripts oraux) des séances avec Mistral Large.

Usage :
  export MISTRAL_API_KEY="..."
  python3 tools/generate_fiches.py                 # toutes les fiches manquantes
  python3 tools/generate_fiches.py --auteur kant   # un seul auteur
  python3 tools/generate_fiches.py --auteur kant --seance 3 --force
  python3 tools/generate_fiches.py --dry-run --auteur kant --seance 1

Chaque fiche vise ~3 200 mots, soit environ 25 minutes de parole
(rythme de lecture ~130 mots/minute), au format Markdown lisible
et directement utilisable par tools/generate_audio.py (Voxtral).
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (api_key, chat, fiche_path, iter_seances, load_data, pad2, pause)

SYSTEM = (
    "Tu es un philosophe universitaire francophone qui écrit des scripts de "
    "podcasts pédagogiques. Tu t'adresses directement à l'auditeur, d'une voix "
    "claire, chaleureuse et posée. Tu ne lis jamais de didascalies : le texte "
    "produit est destiné à être lu à voix haute tel quel par une synthèse vocale."
)

PROMPT = """Écris le script oral complet d'une séance de podcast de philosophie.

Auteur : {nom} ({dates}) — {epoque}
Parcours : 10 séances de 25 minutes pour découvrir l'intégralité de la pensée de cet auteur.
Séance n°{n} sur 10 : « {titre} »
Résumé de la séance : {resume}
Contexte du parcours : {accroche}

Contraintes :
- Longueur : environ 3 200 mots (≈ 25 minutes à voix haute, ~130 mots/min).
- Style oral et pédagogique : phrases courtes, transitions parlées ("Passons maintenant à…", "Mais alors, que répondre ?"), exemples concrets, références précises aux œuvres.
- Structure en Markdown : un titre H1, une courte ligne en italique (auteur, séance, durée visée), puis des sections H2 (Introduction, 2 à 4 parties, Conclusion).
- Contenus : exposer les thèses principales, les arguments, les objections et la portée ; citer les œuvres concernées quand c'est pertinent.
- Conclusion qui renvoie à la séance suivante (sauf séance 10 : bilan du parcours).
- Aucun émoji, aucune didascalie, aucun tableau : uniquement du texte à lire à voix haute.
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--auteur", help="id de l'auteur (ex. kant)")
    ap.add_argument("--seance", type=int, help="numéro de séance (1-10)")
    ap.add_argument("--force", action="store_true", help="régénérer même si la fiche existe")
    ap.add_argument("--limit", type=int, default=0, help="nombre max de fiches à générer")
    ap.add_argument("--model", default="mistral-large-latest")
    ap.add_argument("--dry-run", action="store_true", help="affiche le prompt sans appeler l'API")
    args = ap.parse_args()

    data = load_data()
    key = None if args.dry_run else api_key()
    count = 0
    for auteur, s in iter_seances(data, args.auteur, args.seance):
        path = fiche_path(auteur["id"], s["n"])
        if os.path.exists(path) and not args.force:
            print("[skip] %s existe déjà" % os.path.relpath(path, os.path.dirname(os.path.dirname(path))))
            continue
        if args.limit and count >= args.limit:
            break
        prompt = PROMPT.format(
            nom=auteur["nom"], dates=auteur["dates"], epoque=auteur["epoque"],
            n=s["n"], titre=s["titre"], resume=s["resume"], accroche=auteur["accroche"],
        )
        if args.dry_run:
            print("=== prompt pour %s — séance %s ===\n%s" % (auteur["id"], s["n"], prompt))
            count += 1
            continue
        texte = chat(args.model, SYSTEM, prompt, key, max_tokens=9000, temperature=0.7)
        header = (
            "# Séance %s — %s\n\n*%s · Parcours en 10 séances · Durée visée : 25 minutes*\n\n"
            % (s["n"], s["titre"], auteur["nom"])
        )
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(header + texte + "\n")
        print("[ok] %s — séance %s (%d mots)" % (auteur["id"], pad2(s["n"]), len(texte.split())))
        count += 1
        pause(1.0)
    print("Fiches générées : %d" % count)


if __name__ == "__main__":
    main()
