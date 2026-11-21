#!/usr/bin/env python3
"""Lit les fiches avec Voxtral (TTS Mistral) et produit les épisodes mp3.

Usage :
  export MISTRAL_API_KEY="..."
  python3 tools/generate_audio.py                 # tous les épisodes manquants
  python3 tools/generate_audio.py --auteur kant   # un auteur
  python3 tools/generate_audio.py --auteur kant --seance 1 --force
  python3 tools/generate_audio.py --dry-run --auteur kant --seance 1

Les mp3 sont écrits dans audio/<auteur>/<NN>.mp3, servis tels quels
par GitHub Pages et référencés dans feed.xml.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (
    api_key, audio_path, chunk_text, fiche_path, iter_seances,
    load_data, pad2, pause, post_json, strip_markdown, API_BASE,
)


def tts(model, voice, text, key):
    payload = {"model": model, "input": text, "response_format": "mp3"}
    if voice:
        payload["voice"] = voice
    return post_json("/audio/speech", payload, key, timeout=300)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--auteur", help="id de l'auteur (ex. kant)")
    ap.add_argument("--seance", type=int, help="numéro de séance (1-10)")
    ap.add_argument("--force", action="store_true", help="régénérer même si le mp3 existe")
    ap.add_argument("--limit", type=int, default=0, help="nombre max d'épisodes à produire")
    ap.add_argument("--model", default="voxtral-small-latest",
                    help="modèle Voxtral (ex. voxtral-mini-latest, voxtral-small-latest)")
    ap.add_argument("--voice", default="", help="voix Voxtral (laisser vide = voix par défaut)")
    ap.add_argument("--dry-run", action="store_true", help="affiche les fichiers traités sans appeler l'API")
    args = ap.parse_args()

    data = load_data()
    key = None if args.dry_run else api_key()
    count = 0
    for auteur, s in iter_seances(data, args.auteur, args.seance):
        fpath = fiche_path(auteur["id"], s["n"])
        apath = audio_path(auteur["id"], s["n"])
        if not os.path.exists(fpath):
            print("[skip] pas de fiche pour %s séance %s (lancez d'abord generate_fiches.py)" % (auteur["id"], s["n"]))
            continue
        if os.path.exists(apath) and not args.force:
            print("[skip] %s existe déjà" % os.path.relpath(apath))
            continue
        if args.limit and count >= args.limit:
            break
        with open(fpath, encoding="utf-8") as f:
            texte = strip_markdown(f.read())
        chunks = chunk_text(texte)
        if args.dry_run:
            print("[dry-run] %s séance %s : %d mots, %d chunk(s) TTS, modèle %s"
                  % (auteur["id"], pad2(s["n"]), len(texte.split()), len(chunks), args.model))
            count += 1
            continue
        audio = b""
        for i, ch in enumerate(chunks, 1):
            audio += tts(args.model, args.voice, ch, key)
            print("  chunk %d/%d synthétisé" % (i, len(chunks)))
            pause(0.5)
        os.makedirs(os.path.dirname(apath), exist_ok=True)
        with open(apath, "wb") as f:
            f.write(audio)
        print("[ok] %s → %s (%.1f Ko)"
              % (auteur["id"] + "/" + pad2(s["n"]), os.path.relpath(apath), len(audio) / 1024))
        count += 1
        pause(1.0)
    print("Épisodes produits : %d" % count)


if __name__ == "__main__":
    main()
