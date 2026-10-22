#!/usr/bin/env python3
"""
Titres & tarifs Ycéo -> src/assets/tarifs.json
Usage: python3 -I tools/build-tarifs.py <dossier_assets>

Source : open data Saint-Nazaire Agglo (dataset tarifs-reseau-yceo).
"""
import datetime, json, os, subprocess, sys

OUT = sys.argv[1]
URL = ("https://data.saintnazaireagglo.fr/api/explore/v2.1/catalog/datasets/"
       "tarifs-reseau-yceo/records?limit=100")

raw = json.loads(subprocess.run(
    ["curl", "-sfS", "--max-time", "60", "-A", "yceo-poc/1.0", URL],
    check=True, capture_output=True).stdout)

# Libellés de catégorie plus courts.
CAT = {
    "Ticket dématérialisé (appli YCEO, m-ticket)": "Tickets (appli / m-ticket)",
    "Titres billetique (billet sans contact)": "Titres sans contact",
    "Abonnement": "Abonnements",
}

groups = {}
for r in raw["results"]:
    # Pas de m-ticket dans l'app -> on exclut cette catégorie (titres identiques en sans-contact).
    if r.get("type_de_titre") == "Ticket dématérialisé (appli YCEO, m-ticket)":
        continue
    cat = CAT.get(r.get("type_de_titre", ""), r.get("type_de_titre") or "Autres")
    item = {
        "name": (r.get("denomination_au_1er_juillet_2026") or "").strip(),
        "price": r.get("montant_au_1_07_2026"),
        "condition": (r.get("condition") or "").strip(),
        "vente": (r.get("vente") or "").strip(),
    }
    groups.setdefault(cat, []).append(item)

# Ordre : tickets, sans contact, abonnements, puis le reste.
order = ["Tickets (appli / m-ticket)", "Titres sans contact", "Abonnements"]
cats = [c for c in order if c in groups] + [c for c in groups if c not in order]
out = {
    "updated": datetime.date.today().isoformat(),
    "source": "Saint-Nazaire Agglo — open data (tarifs-reseau-yceo)",
    "groups": [
        {"category": c, "items": sorted(groups[c], key=lambda i: (i["price"] is None, i["price"] or 0))}
        for c in cats
    ],
}
json.dump(out, open(os.path.join(OUT, "tarifs.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print(f"titres={sum(len(g['items']) for g in out['groups'])} categories={len(out['groups'])}")
