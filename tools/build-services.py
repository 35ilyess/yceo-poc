#!/usr/bin/env python3
"""
Points de service autour du réseau -> src/assets/services.json
Usage: python3 -I tools/build-services.py <dossier_assets> [osm_parkings.json]

  - Points de vente Ycéo : open data officielle Saint-Nazaire Agglo
    (dataset 244400644_depositaire_stran).
  - Parkings proches d'un arrêt (usage « parc relais ») : OpenStreetMap (ODbL),
    parkings publics >= 50 places a moins de 400 m d'un arrêt Ycéo.
    Ycéo ne publie pas de liste officielle de P+R en open data.
"""
import json, math, os, subprocess, sys, urllib.parse

OUT = sys.argv[1]
ODS = ("https://data.saintnazaireagglo.fr/api/explore/v2.1/catalog/datasets/"
       "244400644_depositaire_stran/records?limit=100")
OVERPASS = ["https://overpass-api.de/api/interpreter",
            "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
            "https://overpass.private.coffee/api/interpreter"]
BBOX = "47.22,-2.36,47.40,-2.0"
QUERY = (f'[out:json][timeout:60];nwr["amenity"="parking"]'
         f'["access"!~"private|customers|no"]({BBOX});out center tags;')


def get(url, data=None):
    # curl : utilise le magasin de certificats systeme (TLS verifie).
    cmd = ["curl", "-sfS", "--max-time", "90", "-A", "yceo-poc/1.0", url]
    if data:
        cmd += ["--data", data]
    return json.loads(subprocess.run(cmd, check=True, capture_output=True).stdout)


def dist(la1, lo1, la2, lo2):
    la1, lo1, la2, lo2 = map(math.radians, (la1, lo1, la2, lo2))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


stops = json.load(open(os.path.join(OUT, "gtfs", "stops.json")))

sales = []
for r in get(ODS)["results"]:
    sales.append({"name": r["point_vente"], "address": r["adresse"], "city": r["commune"].title(),
                  "lat": round(float(r["latitude"]), 5), "lon": round(float(r["longitude"]), 5),
                  "products": r.get("titres_vendus") or ""})

parkings = []


def fetch_osm():
    # Optionnel : reponse Overpass deja telechargee (les serveurs publics saturent souvent).
    if len(sys.argv) > 2:
        return json.load(open(sys.argv[2]))
    for url in OVERPASS:
        try:
            return get(url, urllib.parse.urlencode({"data": QUERY}))
        except (subprocess.CalledProcessError, json.JSONDecodeError):
            print(f"overpass indisponible : {url}", file=sys.stderr)
    sys.exit("aucun serveur Overpass disponible")


osm = fetch_osm()
for e in osm["elements"]:
    t = e.get("tags", {})
    cap = t.get("capacity", "")
    if not cap.isdigit() or int(cap) < 50:
        continue
    c = e.get("center") or {"lat": e.get("lat"), "lon": e.get("lon")}
    best = min(((dist(c["lat"], c["lon"], s["lat"], s["lon"]), s["n"]) for s in stops.values()),
               default=(1e9, ""))
    if best[0] > 400:
        continue
    parkings.append({"name": t.get("name") or "Parking", "capacity": int(cap),
                     "free": t.get("fee") == "no", "pr": t.get("park_ride") not in (None, "no"),
                     "lat": round(c["lat"], 5), "lon": round(c["lon"], 5),
                     "stop": best[1], "stopDist": round(best[0])})
parkings.sort(key=lambda p: -p["capacity"])

json.dump({"sales": sales, "parkings": parkings,
           "sources": {"sales": "Saint-Nazaire Agglo — open data (244400644_depositaire_stran)",
                       "parkings": "© contributeurs OpenStreetMap (ODbL)"}},
          open(os.path.join(OUT, "services.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print(f"points_de_vente={len(sales)} parkings={len(parkings)}")
