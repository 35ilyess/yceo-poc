#!/usr/bin/env python3
"""
Pretraitement GTFS Ycéo -> JSON compacts pour le POC.
Usage: python3 -I tools/build-gtfs.py <dossier_gtfs_extrait> <dossier_sortie_assets>

Produit (dans <sortie>/):
  lines.json          : lignes (resume) + sequence d'arrets par direction
  stops.json          : arrets (nom, coord, ville, lignes desservies)
  calendar.json       : services actifs (jours + plage) + exceptions
  stop/<stopId>.json  : horaires theoriques (departs) par arret
  line/<routeId>.json : fiche horaire par course (trip) et par direction
"""
import csv, json, os, sys
from collections import defaultdict

csv.field_size_limit(10_000_000)
SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(os.path.join(OUT, "stop"), exist_ok=True)
os.makedirs(os.path.join(OUT, "line"), exist_ok=True)


def read(name):
    with open(os.path.join(SRC, name), encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def tsec(t):
    if not t:
        return None
    h, m, s = t.split(":")
    return int(h) * 3600 + int(m) * 60 + int(s)


# ---- routes ----
routes = {}
for r in read("routes.txt"):
    routes[r["route_id"]] = {
        "short": r["route_short_name"],
        "long": r["route_long_name"],
        "color": (r.get("route_color") or "888888").strip() or "888888",
        "text": (r.get("route_text_color") or "FFFFFF").strip() or "FFFFFF",
        "sort": int(r.get("route_sort_order") or 999),
    }

# ---- trips ----
trips = {}
for t in read("trips.txt"):
    trips[t["trip_id"]] = {
        "route": t["route_id"],
        "service": t["service_id"],
        "dir": t.get("direction_id") or "0",
        "headsign": (t.get("trip_headsign") or "").strip(),
    }

# ---- stops : noms ----
stop_name = {}
stop_meta = {}
for s in read("stops.txt"):
    stop_name[s["stop_id"]] = s["stop_name"]
    if s.get("location_type") in (None, "", "0"):
        try:
            stop_meta[s["stop_id"]] = (
                s["stop_name"], round(float(s["stop_lat"]), 5),
                round(float(s["stop_lon"]), 5), s.get("city_name") or "",
            )
        except (ValueError, KeyError):
            pass

# ---- stop_times : index par trip + horaires par arret ----
trip_stops = defaultdict(list)      # trip_id -> [(seq, stop_id)]
trip_time = defaultdict(dict)       # trip_id -> {stop_id: dep_sec}
stop_dep = defaultdict(list)        # stop_id -> [[sec, short, color, headsign, service]]
for st in read("stop_times.txt"):
    tid, sid, seq = st["trip_id"], st["stop_id"], int(st["stop_sequence"])
    dep = tsec(st.get("departure_time") or st.get("arrival_time"))
    trip_stops[tid].append((seq, sid))
    if dep is not None:
        trip_time[tid][sid] = dep
    tr = trips.get(tid)
    if tr and dep is not None:
        ro = routes.get(tr["route"], {})
        hs = st.get("stop_headsign") or tr["headsign"]
        stop_dep[sid].append([dep, ro.get("short", "?"), ro.get("color", "888888"), hs, tr["service"]])

for tid in trip_stops:
    trip_stops[tid].sort()

# ---- sequence canonique (trip le plus long) par (route, direction) ----
canon = {}
for tid, tr in trips.items():
    key = (tr["route"], tr["dir"])
    seqstops = [s for _, s in trip_stops.get(tid, [])]
    if len(seqstops) > len(canon.get(key, [])):
        canon[key] = seqstops

# ---- lines.json (resume) + line/<id>.json (fiches horaires) ----
lines = []
for rid, ro in routes.items():
    dirs_summary = []
    dirs_full = []
    for d in ("0", "1"):
        stops = canon.get((rid, d))
        if not stops:
            continue
        dirs_summary.append({"dir": int(d), "headsign": "", "stops": stops})
        # courses de cette (route, direction)
        trs = []
        for tid, tr in trips.items():
            if tr["route"] != rid or tr["dir"] != d:
                continue
            tmap = trip_time.get(tid, {})
            if not tmap:
                continue
            times = [tmap.get(s) for s in stops]  # aligne a la sequence canonique
            if not any(v is not None for v in times):
                continue
            dep0 = next((v for v in times if v is not None), None)
            trs.append({"s": tr["service"], "t": times, "d0": dep0})
        trs.sort(key=lambda x: x["d0"])
        term = stop_name.get(stops[-1], stops[-1]) if stops else ""
        dirs_full.append({"dir": int(d), "term": term, "stops": stops,
                          "trips": [{"s": t["s"], "t": t["t"]} for t in trs]})
    if not dirs_summary:
        continue
    lines.append({"id": rid, "short": ro["short"], "long": ro["long"],
                  "color": ro["color"], "text": ro["text"],
                  "urban": ro["sort"] < 100, "sort": ro["sort"], "directions": dirs_summary})
    json.dump({"id": rid, "short": ro["short"], "long": ro["long"], "color": ro["color"],
               "text": ro["text"], "directions": dirs_full},
              open(os.path.join(OUT, "line", f"{rid}.json"), "w"),
              ensure_ascii=False, separators=(",", ":"))
lines.sort(key=lambda x: x["sort"])

# ---- stops.json ----
stops_out = {}
for sid, meta in stop_meta.items():
    if sid not in stop_dep:
        continue
    served = sorted({d[1] for d in stop_dep[sid]})
    stops_out[sid] = {"n": meta[0], "lat": meta[1], "lon": meta[2], "c": meta[3], "l": served}

# ---- calendar.json ----
services = {}
for c in read("calendar.txt"):
    services[c["service_id"]] = {
        "d": [int(c[day]) for day in ("monday","tuesday","wednesday","thursday","friday","saturday","sunday")],
        "s": c["start_date"], "e": c["end_date"],
    }
ex = defaultdict(lambda: {"a": [], "r": []})
for e in read("calendar_dates.txt"):
    ex[e["date"]]["a" if e["exception_type"] == "1" else "r"].append(e["service_id"])

# ---- ecriture ----
dump = lambda obj, p: json.dump(obj, open(os.path.join(OUT, p), "w"), ensure_ascii=False, separators=(",", ":"))
dump(lines, "lines.json")
dump(stops_out, "stops.json")
dump({"services": services, "ex": ex}, "calendar.json")

nf = 0
for sid, deps in stop_dep.items():
    if sid not in stops_out:
        continue
    deps.sort(key=lambda x: x[0])
    dump({"d": deps}, f"stop/{sid}.json")
    nf += 1

print(f"lines={len(lines)} stops={len(stops_out)} stop_files={nf} services={len(services)}")
