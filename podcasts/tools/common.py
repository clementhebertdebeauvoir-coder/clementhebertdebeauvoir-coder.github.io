"""Utilitaires communs : chargement des données et appels à l'API Mistral.

Aucun paquet externe requis (bibliothèque standard uniquement).
La clé se lit dans la variable d'environnement MISTRAL_API_KEY —
ne jamais l'écrire en dur dans un fichier.
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(ROOT, "data", "auteurs.json")
FICHES_DIR = os.path.join(ROOT, "fiches")
AUDIO_DIR = os.path.join(ROOT, "audio")

API_BASE = "https://api.mistral.ai/v1"


def load_data():
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


def pad2(n):
    return "%02d" % n


def fiche_path(auteur_id, n):
    return os.path.join(FICHES_DIR, auteur_id, pad2(n) + ".md")


def audio_path(auteur_id, n):
    return os.path.join(AUDIO_DIR, auteur_id, pad2(n) + ".mp3")


def api_key():
    key = os.environ.get("MISTRAL_API_KEY", "").strip()
    if not key:
        sys.exit(
            "Variable d'environnement MISTRAL_API_KEY absente.\n"
            "Exportez votre clé Mistral (ne la commitez jamais) :\n"
            '  export MISTRAL_API_KEY="..."'
        )
    return key


def post_json(path, payload, key, timeout=120):
    url = API_BASE + path
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:500]
        sys.exit("Erreur API Mistral (%s) sur %s : %s" % (e.code, path, detail))


def chat(model, system, user, key, max_tokens=8192, temperature=0.7, timeout=180):
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    raw = post_json("/chat/completions", payload, key, timeout=timeout)
    data = json.loads(raw.decode("utf-8"))
    return data["choices"][0]["message"]["content"].strip()


def text_to_speech(model, voice, text, key, timeout=300):
    """Renvoie les octets audio (mp3) pour `text`."""
    payload = {
        "model": model,
        "input": text,
        "response_format": "mp3",
    }
    if voice:
        payload["voice"] = voice
    return post_json("/audio/speech", payload, key, timeout=timeout)


def chunk_text(text, max_chars=6000):
    """Découpe un texte long aux frontières de paragraphes."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks, current = [], ""
    for p in paragraphs:
        if len(current) + len(p) + 2 > max_chars and current:
            chunks.append(current.strip())
            current = ""
        current += p + "\n\n"
    if current.strip():
        chunks.append(current.strip())
    return chunks


def strip_markdown(md):
    """Texte brut d'une fiche markdown, prêt pour la synthèse vocale."""
    out = []
    for line in md.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("#"):
            out.append(line.lstrip("#").strip())
        else:
            out.append(line.replace("**", "").replace("*", ""))
    return "\n\n".join(out)


def iter_seances(data, auteur_id=None, only_n=None):
    for auteur in data["auteurs"]:
        if auteur_id and auteur["id"] != auteur_id:
            continue
        for s in auteur["seances"]:
            if only_n and s["n"] != only_n:
                continue
            yield auteur, s


def pause(sec=1.0):
    time.sleep(sec)
