#!/usr/bin/env python3
"""
Arrêts accessibles PMR -> src/assets/pmr.json
Usage: python3 -I tools/build-pmr.py <dossier_assets>

Source : open data Saint-Nazaire Agglo (244400644_arrets_stran_pmr).
Les identifiants d'arrêt diffèrent du GTFS : on associe par nom normalisé.
"""
import json, os, subprocess, sys, unicodedata

OUT = sys.argv[1]
URL = ("https://data.saintnazaireagglo.fr/api/explore/v2.1/catalog/datasets/"
       "244400644_arrets_stran_pmr/records?limit=100&offset={off}")


def norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    for ch in "-'’":
        s = s.replace(ch, " ")
    return " ".join(s.split())


def get(off):
    cmd = ["curl", "-sfS", "--max-time", "60", "-A", "yceo-poc/1.0", URL.format(off=off)]
    return json.loads(subprocess.run(cmd, check=True, capture_output=True).stdout)


names, details = set(), {}
off = 0
while True:
    page = get(off)
    rows = page["results"]
    if not rows:
        break
    for r in rows:
        if r.get("accessibilite") != "Oui" or r.get("etat") == "Supprimé":
            continue
        n = norm(r["nom_arret"])
        names.add(n)
        details[n] = {
            "podotactile": r.get("bande_podotactile") == "Oui",
            "ufr": r.get("marquage_ufr") == "Oui",
            "prioritaire": r.get("arret_prioritaire") == "Oui",
        }
    off += len(rows)
    if off >= page["total_count"]:
        break

json.dump({"stops": sorted(names), "details": details,
           "source": "Saint-Nazaire Agglo — open data (244400644_arrets_stran_pmr)"},
          open(os.path.join(OUT, "pmr.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print(f"arrets_accessibles={len(names)}")
