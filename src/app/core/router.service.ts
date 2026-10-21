import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, shareReplay } from 'rxjs';
import { GtfsLine, GtfsService, GtfsStop } from './gtfs.service';
import { Journey, JourneySection, PlacePoint } from './models';

interface RouterData {
  stops: string[];
  svcs: string[];
  trips: [string, number, string][]; // routeId, svcIdx, terminus
  c: number[]; // [dep, arr, from, to, trip] * n, trie par dep
  fp: Record<string, number[]>; // stopIdx -> [voisin, sec, ...]
}

/** Graphe pret pour le calcul (charge une seule fois). */
interface Graph {
  data: RouterData;
  n: number; // nombre de connexions
  stops: Record<string, GtfsStop>;
  lines: Map<string, GtfsLine>;
  tripConns: Int32Array[]; // connexions de chaque course, dans l'ordre
}

type Reach =
  | { k: 'origin'; walk: number }
  | { k: 'trip'; enter: number; exit: number }
  | { k: 'walk'; from: number; sec: number };

const WALK_SPEED = 1.2; // m/s
const DETOUR = 1.3; // vol d'oiseau -> distance reelle
const ACCESS_RADIUS = 700; // m, marche max depart/arrivee
const MIN_CHANGE = 60; // s, correspondance sur le meme arret
const MAX_WALK_ONLY = 30 * 60; // proposer « à pied » sous 30 min

export function walkSec(aLat: number, aLon: number, bLat: number, bLon: number): number {
  return Math.round((haversine(aLat, aLon, bLat, bLon) * DETOUR) / WALK_SPEED);
}

export function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = Math.PI / 180;
  const h =
    Math.sin(((bLat - aLat) * r) / 2) ** 2 +
    Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLon - aLon) * r) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/**
 * Moteur d'itineraire local, sans token ni serveur : Connection Scan Algorithm
 * sur les horaires theoriques GTFS (assets/gtfs/router.json, genere par
 * tools/build-router.py).
 */
@Injectable({ providedIn: 'root' })
export class RouterService {
  private http = inject(HttpClient);
  private gtfs = inject(GtfsService);
  private graph$?: Observable<Graph>;

  /** Precharge le graphe (≈ 0,7 Mo compresse). */
  load(): Observable<Graph> {
    this.graph$ ??= forkJoin({
      data: this.http.get<RouterData>('assets/gtfs/router.json'),
      stops: this.gtfs.getStops(),
      lines: this.gtfs.getLines(),
    }).pipe(
      map(({ data, stops, lines }) => {
        const n = data.c.length / 5;
        const buckets: number[][] = data.trips.map(() => []);
        for (let i = 0; i < n; i++) buckets[data.c[i * 5 + 4]].push(i);
        return {
          data,
          n,
          stops,
          lines: new Map(lines.map((l) => [l.id, l])),
          tripConns: buckets.map((b) => Int32Array.from(b)),
        };
      }),
      shareReplay(1),
    );
    return this.graph$;
  }

  /** Jusqu'a `count` trajets partant apres `when`, du plus tot au plus tard. */
  plan(from: PlacePoint, to: PlacePoint, when = new Date(), count = 3): Observable<Journey[]> {
    return forkJoin({ g: this.load(), active: this.gtfs.getActiveServices(when) }).pipe(
      map(({ g, active }) => {
        const svcOk = g.data.svcs.map((s) => active.has(s));
        const midnight = new Date(when.getFullYear(), when.getMonth(), when.getDate());
        let t = when.getHours() * 3600 + when.getMinutes() * 60;
        const out: Journey[] = [];
        const seen = new Set<string>();
        // Les trajets sont trouves par depart croissant ; plusieurs peuvent arriver a la meme
        // heure. On continue jusqu'a avoir count + 1 heures d'arrivee distinctes, pour que le
        // dernier trajet de chaque arrivee (le depart le plus tardif) soit connu.
        const arrivals = new Set<number>();
        for (let k = 0; k < 12 && arrivals.size <= count; k++) {
          const j = this.scan(g, svcOk, from, to, t, midnight);
          if (!j) break;
          const key = j.sections.map((s) => `${s.label}@${+s.departure!}`).join('|');
          if (!seen.has(key)) {
            seen.add(key);
            out.push(j);
            arrivals.add(+j.arrival);
          }
          // trajet suivant : partir juste apres le premier bus du trajet trouve
          const firstBus = j.sections.find((s) => s.mode === 'bus');
          if (!firstBus) break;
          t = Math.round((+firstBus.departure! - +midnight) / 1000) - firstWalk(j) + 60;
        }
        const direct = walkSec(from.lat, from.lon, to.lat, to.lon);
        if (direct > 60 && direct <= MAX_WALK_ONLY) out.push(walkOnly(from, to, when, direct));
        // retire les trajets domines (partir plus tot pour arriver pareil ou plus tard)
        const kept = out.filter(
          (a) =>
            !out.some(
              (b) =>
                b !== a &&
                +b.departure >= +a.departure &&
                +b.arrival <= +a.arrival &&
                (+b.departure > +a.departure || +b.arrival < +a.arrival),
            ),
        );
        const walking = kept.filter((j) => j.sections.every((s) => s.mode !== 'bus'));
        const bus = kept.filter((j) => !walking.includes(j)).sort((a, b) => +a.arrival - +b.arrival);
        return [...bus.slice(0, count), ...walking].sort((a, b) => +a.arrival - +b.arrival);
      }),
    );
  }

  /** Un passage CSA : trajet arrivant le plus tot, depart >= t0. */
  private scan(
    g: Graph,
    svcOk: boolean[],
    from: PlacePoint,
    to: PlacePoint,
    t0: number,
    midnight: Date,
  ): Journey | null {
    const { data, n } = g;
    const ns = data.stops.length;
    const best = new Float64Array(ns).fill(Infinity);
    const viaTrip = new Int32Array(ns).fill(-1);
    const reach: (Reach | undefined)[] = new Array(ns);
    const boarded = new Int32Array(data.trips.length).fill(-1);

    // acces a pied depuis le point de depart
    const access = this.near(g, from);
    for (const [s, w] of access) {
      best[s] = t0 + w;
      reach[s] = { k: 'origin', walk: w };
    }
    const egress = this.near(g, to);
    if (!access.length || !egress.length) return null;

    const targetArr = () => {
      let m = Infinity;
      for (const [s, w] of egress) m = Math.min(m, best[s] + w);
      return m;
    };

    // premiere connexion partant apres t0 (recherche dichotomique)
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (data.c[mid * 5] < t0) lo = mid + 1;
      else hi = mid;
    }

    let bound = Infinity;
    for (let i = lo; i < n; i++) {
      const o = i * 5;
      const dep = data.c[o];
      if (dep >= bound) break;
      const trip = data.c[o + 4];
      if (!svcOk[data.trips[trip][1]]) continue;
      const a = data.c[o + 2];
      if (boarded[trip] < 0) {
        const change = viaTrip[a] >= 0 && viaTrip[a] !== trip ? MIN_CHANGE : 0;
        if (best[a] + change > dep) continue;
        boarded[trip] = i;
      }
      const b = data.c[o + 3];
      const arr = data.c[o + 1];
      if (arr < best[b]) {
        best[b] = arr;
        viaTrip[b] = trip;
        reach[b] = { k: 'trip', enter: boarded[trip], exit: i };
        const fp = data.fp[b];
        if (fp) {
          for (let k = 0; k < fp.length; k += 2) {
            const nb = fp[k];
            if (arr + fp[k + 1] < best[nb]) {
              best[nb] = arr + fp[k + 1];
              viaTrip[nb] = -1;
              reach[nb] = { k: 'walk', from: b, sec: fp[k + 1] };
            }
          }
        }
        bound = targetArr();
      }
    }

    // meilleur arret d'arrivee
    let end = -1;
    let endWalk = 0;
    let endArr = Infinity;
    for (const [s, w] of egress) {
      if (best[s] + w < endArr) {
        endArr = best[s] + w;
        end = s;
        endWalk = w;
      }
    }
    if (end < 0 || !isFinite(endArr)) return null;
    return this.build(g, reach, end, endWalk, from, to, midnight);
  }

  /** Arrets a distance de marche d'un point : [stopIdx, secondes]. */
  private near(g: Graph, p: PlacePoint): [number, number][] {
    const res: [number, number][] = [];
    const ids = g.data.stops;
    for (let r = ACCESS_RADIUS; r <= ACCESS_RADIUS * 2 && !res.length; r += ACCESS_RADIUS) {
      for (let i = 0; i < ids.length; i++) {
        const s = g.stops[ids[i]];
        if (!s) continue;
        if (p.stopId === ids[i]) {
          res.push([i, 0]);
          continue;
        }
        const d = haversine(p.lat, p.lon, s.lat, s.lon);
        if (d <= r) res.push([i, Math.round((d * DETOUR) / WALK_SPEED)]);
      }
    }
    return res;
  }

  /** Reconstruit le trajet en remontant les predecesseurs. */
  private build(
    g: Graph,
    reach: (Reach | undefined)[],
    end: number,
    endWalk: number,
    from: PlacePoint,
    to: PlacePoint,
    midnight: Date,
  ): Journey | null {
    const { data } = g;
    const at = (sec: number) => new Date(+midnight + sec * 1000);
    const stopOf = (i: number) => g.stops[data.stops[i]];
    const sections: JourneySection[] = [];
    let cur = end;
    let guard = 0;
    while (guard++ < 50) {
      const r = reach[cur];
      if (!r) return null;
      if (r.k === 'origin') {
        const s = stopOf(cur);
        const dep = data.c[firstDep(sections) * 5];
        if (r.walk > 30) {
          sections.unshift(walk(from.name, s.n, [from, s], at(dep - r.walk), r.walk));
        }
        break;
      }
      if (r.k === 'walk') {
        const a = stopOf(r.from);
        const b = stopOf(cur);
        const arr = data.c[(reach[r.from] as { exit: number }).exit * 5 + 1];
        if (a.n !== b.n) sections.unshift(walk(a.n, b.n, [a, b], at(arr), r.sec));
        cur = r.from;
        continue;
      }
      const ent = r.enter * 5;
      const ex = r.exit * 5;
      const trip = data.trips[data.c[ent + 4]];
      const line = g.lines.get(trip[0]);
      const conns = g.tripConns[data.c[ent + 4]];
      const path: { lat: number; lon: number; n: string }[] = [];
      for (const ci of conns) {
        if (ci < r.enter) continue;
        if (!path.length) path.push(stopOf(data.c[ci * 5 + 2]));
        path.push(stopOf(data.c[ci * 5 + 3]));
        if (ci === r.exit) break;
      }
      sections.unshift({
        mode: 'bus',
        label: line?.short ?? trip[0],
        lineId: trip[0],
        lineColor: line?.color,
        direction: trip[2],
        from: stopOf(data.c[ent + 2]).n,
        to: stopOf(data.c[ex + 3]).n,
        departure: at(data.c[ent]),
        arrival: at(data.c[ex + 1]),
        durationMin: Math.max(1, Math.round((data.c[ex + 1] - data.c[ent]) / 60)),
        stops: Math.max(1, path.length - 1),
        path: path.map((p) => [p.lon, p.lat]),
        _first: r.enter,
      } as JourneySection);
      cur = data.c[ent + 2];
    }

    const last = sections[sections.length - 1];
    const s = stopOf(end);
    if (endWalk > 30 && last) sections.push(walk(s.n, to.name, [s, to], last.arrival!, endWalk));
    if (!sections.some((x) => x.mode === 'bus')) return null;
    sections.forEach((x) => delete (x as { _first?: number })._first);
    const departure = sections[0].departure!;
    const arrival = new Date(+sections[sections.length - 1].arrival!);
    return {
      departure,
      arrival,
      durationMin: Math.round((+arrival - +departure) / 60000),
      nbTransfers: sections.filter((x) => x.mode === 'bus').length - 1,
      sections,
      from,
      to,
    };
  }
}

function walk(
  from: string,
  to: string,
  pts: { lat: number; lon: number }[],
  departure: Date,
  sec: number,
): JourneySection {
  return {
    mode: 'walking',
    label: 'Marche',
    from,
    to,
    departure,
    arrival: new Date(+departure + sec * 1000),
    durationMin: Math.max(1, Math.round(sec / 60)),
    path: pts.map((p) => [p.lon, p.lat]),
  };
}

function walkOnly(from: PlacePoint, to: PlacePoint, when: Date, sec: number): Journey {
  const s = walk(from.name, to.name, [from, to], when, sec);
  return {
    departure: when,
    arrival: s.arrival!,
    durationMin: s.durationMin,
    nbTransfers: 0,
    sections: [s],
    from,
    to,
  };
}

/** Index de la premiere connexion bus deja reconstruite (pour l'heure de depart). */
function firstDep(sections: JourneySection[]): number {
  const b = sections.find((s) => s.mode === 'bus') as { _first?: number } | undefined;
  return b?._first ?? 0;
}

function firstWalk(j: Journey): number {
  const s = j.sections[0];
  return s.mode === 'walking' ? Math.round((+s.arrival! - +s.departure!) / 1000) : 0;
}
