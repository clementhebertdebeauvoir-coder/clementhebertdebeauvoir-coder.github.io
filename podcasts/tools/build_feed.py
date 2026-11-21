#!/usr/bin/env python3
"""Régénère feed.xml (flux RSS podcast) à partir de data/auteurs.json.

Usage :
  python3 tools/build_feed.py
  python3 tools/build_feed.py --base https://exemple.github.io/podcasts/

À relancer après chaque ajout d'épisodes audio (generate_audio.py).
"""
import argparse
import json
import os
import sys
import xml.sax.saxutils as sx
from email.utils import formatdate

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import AUDIO_DIR, ROOT, audio_path, iter_seances, load_data

DEFAULT_BASE = "https://clementhebertdebeauvoir-coder.github.io/podcasts/"


def write_manifest():
    """Écrit data/audio.json : liste des épisodes dont le mp3 existe vraiment."""
    episodes = []
    if os.path.isdir(AUDIO_DIR):
        for auteur_id in sorted(os.listdir(AUDIO_DIR)):
            d = os.path.join(AUDIO_DIR, auteur_id)
            if not os.path.isdir(d):
                continue
            for fname in sorted(os.listdir(d)):
                if fname.endswith(".mp3"):
                    episodes.append("%s/%s" % (auteur_id, fname[:-4]))
    out = os.path.join(ROOT, "data", "audio.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"episodes": episodes}, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return len(episodes)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--base", default=DEFAULT_BASE, help="URL publique du dossier podcasts/ (avec / final)")
    ap.add_argument("--out", default=os.path.join(ROOT, "feed.xml"))
    args = ap.parse_args()

    base = args.base if args.base.endswith("/") else args.base + "/"
    data = load_data()
    site = data["site"]
    now = formatdate(usegmt=True)

    items = []
    for auteur, s in iter_seances(data):
        apath = audio_path(auteur["id"], s["n"])
        url = base + "audio/%s/%02d.mp3" % (auteur["id"], s["n"])
        length = os.path.getsize(apath) if os.path.exists(apath) else s["duree_sec"] * 16000
        pub = formatdate(os.path.getmtime(apath), usegmt=True) if os.path.exists(apath) else now
        titre = "%s — Séance %d : %s" % (auteur["nom"], s["n"], s["titre"])
        items.append(
            "    <item>\n"
            "      <title>%s</title>\n"
            "      <description>%s</description>\n"
            "      <pubDate>%s</pubDate>\n"
            "      <guid isPermaLink=\"true\">%s</guid>\n"
            "      <enclosure url=\"%s\" length=\"%d\" type=\"audio/mpeg\"/>\n"
            "      <itunes:duration>%d</itunes:duration>\n"
            "      <itunes:episode>%d</itunes:episode>\n"
            "      <itunes:subtitle>%s</itunes:subtitle>\n"
            "    </item>"
            % (
                sx.escape(titre), sx.escape(s["resume"]), pub, sx.escape(url), url,
                length, s["duree_sec"], s["n"], sx.escape(auteur["nom"]),
            )
        )

    xml = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>%s</title>
    <link>%s</link>
    <atom:link href="%sfeed.xml" rel="self" type="application/rss+xml"/>
    <description>%s</description>
    <language>fr</language>
    <pubDate>%s</pubDate>
    <itunes:summary>%s</itunes:summary>
    <itunes:category text="Education"/>
%s
  </channel>
</rss>
""" % (
        sx.escape(site["titre"]), sx.escape(base), sx.escape(base),
        sx.escape(site["sous_titre"]), now, sx.escape(site["sous_titre"]),
        "\n".join(items),
    )

    with open(args.out, "w", encoding="utf-8") as f:
        f.write(xml)
    print("feed.xml écrit : %d épisodes → %s" % (len(items), os.path.relpath(args.out, ROOT)))
    n_audio = write_manifest()
    print("data/audio.json écrit : %d épisode(s) audio disponible(s)" % n_audio)


if __name__ == "__main__":
    main()
