#!/usr/bin/env python3
"""
Construit le graphe du moteur d'itinéraire local (Connection Scan Algorithm)
a partir des assets GTFS deja pretraites (assets/gtfs/line/*.json + stops.json).
Usage: python3 -I tools/build-router.py <dossier_assets_gtfs>

Produit <dossier>/router.json :
  stops : [stopId]                       (index -> id)
  svcs  : [serviceId]
  trips : [routeId, svcIdx, terminus]    (une entree par course)
  c     : [dep, arr, from, to, trip, ...] (connexions a plat, triees par dep)
  fp    : {stopIdx: [voisin, sec, ...]}  (correspondances a pied < 400 m)
"""
import glob, json, math, os, sys

GTFS = sys.argv[1]
# Lignes exclues du calcul : scolaires, evenementielles, TER longue distance.
EXCLUDE_PREFIX = ("SCOL",)
EXCLUDE = {"233", "EXT19", "EXT21", "EXT148"}
WALK_MAX_M = 400
WALK_SPEED = 1.2  # m/s
DETOUR = 1.3      # distance a vol d'oiseau -> distance reelle

stops = json.load(open(os.path.join(GTFS, "stops.json")))
stop_ids = list(stops.keys())
sidx = {s: i for i, s in enumerate(stop_ids)}

svcs, svc_idx = [], {}
trips, conns = [], []
for path in sorted(glob.glob(os.path.join(GTFS, "line", "*.json"))):
    line = json.load(open(path))
    rid = line["id"]
    if rid in EXCLUDE or rid.startswith(EXCLUDE_PREFIX):
        continue
    for d in line["directions"]:
        seq = d["stops"]
        for tr in d["trips"]:
            pts = [(sidx[s], t) for s, t in zip(seq, tr["t"]) if t is not None and s in sidx]
            if len(pts) < 2:
                continue
            if tr["s"] not in svc_idx:
                svc_idx[tr["s"]] = len(svcs)
                svcs.append(tr["s"])
            ti = len(trips)
            trips.append([rid, svc_idx[tr["s"]], d["term"]])
            for (a, ta), (b, tb) in zip(pts, pts[1:]):
                if tb < ta or a == b:
                    continue
                conns.append((ta, tb, a, b, ti))

conns.sort(key=lambda c: (c[0], c[1]))


def dist(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a["lat"], a["lon"], b["lat"], b["lon"]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


fp = {}
for i, a in enumerate(stop_ids):
    sa = stops[a]
    out = []
    for j, b in enumerate(stop_ids):
        if i == j:
            continue
        sb = stops[b]
        if abs(sa["lat"] - sb["lat"]) > 0.005 or abs(sa["lon"] - sb["lon"]) > 0.007:
            continue
        m = dist(sa, sb)
        if m <= WALK_MAX_M:
            out += [j, max(60, round(m * DETOUR / WALK_SPEED))]
    if out:
        fp[i] = out

flat = [v for c in conns for v in c]
json.dump({"stops": stop_ids, "svcs": svcs, "trips": trips, "c": flat, "fp": fp},
          open(os.path.join(GTFS, "router.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print(f"stops={len(stop_ids)} trips={len(trips)} connections={len(conns)} footpaths={sum(len(v)//2 for v in fp.values())}")
