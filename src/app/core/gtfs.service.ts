import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of, shareReplay, switchMap } from 'rxjs';

export interface GtfsDirection {
  dir: number;
  headsign: string;
  stops: string[];
}
export interface GtfsLine {
  id: string;
  short: string;
  long: string;
  color: string;
  text: string;
  urban: boolean;
  sort: number;
  directions: GtfsDirection[];
}
export interface GtfsStop {
  n: string;
  lat: number;
  lon: number;
  c: string;
  l: string[];
}
export interface TheoreticalDeparture {
  short: string;
  color: string;
  headsign: string;
  time: Date;
  inMin: number;
}

export interface LineTrip {
  s: string; // service_id
  t: (number | null)[]; // heure (sec depuis minuit) alignee a directions[].stops, null si non desservi
}
export interface LineTimetableDir {
  dir: number;
  term: string;
  stops: string[];
  trips: LineTrip[];
}
export interface LineTimetable {
  id: string;
  short: string;
  long: string;
  color: string;
  text: string;
  directions: LineTimetableDir[];
}

interface Calendar {
  services: Record<string, { d: number[]; s: string; e: string }>;
  ex: Record<string, { a: string[]; r: string[] }>;
}

/** Un token est une commune s'il est tout en majuscules (ex. "SAINT-NAZAIRE"). */
const isTownToken = (t: string): boolean => /[A-ZÀ-Ý]/.test(t) && t === t.toUpperCase();

/** Casse de ville propre : "SAINT-NAZAIRE" -> "Saint-Nazaire", particules en minuscule. */
function prettyTown(up: string): string {
  const small = new Set(['de', 'des', 'du', 'la', 'le', 'les', 'aux', 'sur', 'en', 'et']);
  let first = true;
  return up
    .toLowerCase()
    .split(/([ -])/)
    .map((p) => {
      if (p === ' ' || p === '-' || p === '') return p;
      const w = small.has(p) && !first ? p : p.charAt(0).toUpperCase() + p.slice(1);
      first = false;
      return w;
    })
    .join('');
}

/** Arrêts génériques qui gardent la commune pour lever l'ambiguïté (ex. "Gare de Donges"). */
const GENERIC_STOPS = new Set(['gare', 'gares']);

/**
 * Un terminus "COMMUNE Arrêt" : on retire la commune (le nom d'arrêt suffit),
 * sauf pour un arrêt générique comme "Gare" -> "Gare de Commune".
 */
function prettyTerminus(t: string): string {
  const tokens = t.trim().split(/\s+/);
  let i = 0;
  while (i < tokens.length && isTownToken(tokens[i])) i++;
  if (i === 0) return t; // pas de préfixe commune (interurbain déjà propre)
  const town = prettyTown(tokens.slice(0, i).join(' '));
  const stop = tokens.slice(i).join(' ').trim();
  if (!stop) return town;
  if (GENERIC_STOPS.has(stop.toLowerCase())) return `${stop} de ${town}`;
  return stop;
}

/** Nom long d'une ligne "A - B" avec termini reformatés. */
export function prettyLineName(long: string): string {
  if (!long) return long;
  return long.split(' - ').map(prettyTerminus).join(' - ');
}

/** Donnees GTFS pre-traitees (assets/gtfs), 100% hors-ligne, sans token. */
@Injectable({ providedIn: 'root' })
export class GtfsService {
  private http = inject(HttpClient);
  private base = 'assets/gtfs';

  private lines$?: Observable<GtfsLine[]>;
  private stops$?: Observable<Record<string, GtfsStop>>;
  private cal$?: Observable<Calendar>;

  getLines(): Observable<GtfsLine[]> {
    this.lines$ ??= this.http
      .get<GtfsLine[]>(`${this.base}/lines.json`)
      .pipe(
        map((ls) => ls.map((l) => ({ ...l, long: prettyLineName(l.long) }))),
        shareReplay(1),
      );
    return this.lines$;
  }

  getLine(id: string): Observable<GtfsLine | undefined> {
    return this.getLines().pipe(map((ls) => ls.find((l) => l.id === id)));
  }

  getStops(): Observable<Record<string, GtfsStop>> {
    this.stops$ ??= this.http
      .get<Record<string, GtfsStop>>(`${this.base}/stops.json`)
      .pipe(shareReplay(1));
    return this.stops$;
  }

  getStop(id: string): Observable<GtfsStop | undefined> {
    return this.getStops().pipe(map((s) => s[id]));
  }

  private getCalendar(): Observable<Calendar> {
    this.cal$ ??= this.http.get<Calendar>(`${this.base}/calendar.json`).pipe(shareReplay(1));
    return this.cal$;
  }

  /** Fiche horaire complete d'une ligne (courses par direction). */
  getLineTimetable(id: string): Observable<LineTimetable> {
    return this.http
      .get<LineTimetable>(`${this.base}/line/${id}.json`)
      .pipe(map((t) => ({ ...t, long: prettyLineName(t.long) })));
  }

  /** Services actifs a une date (pour filtrer les courses du jour). */
  getActiveServices(when = new Date()): Observable<Set<string>> {
    return this.getCalendar().pipe(map((cal) => this.activeServices(when, cal)));
  }

  /** Prochains passages theoriques a un arret, calcules depuis le calendrier. */
  nextDepartures(stopId: string, count = 12, when = new Date()): Observable<TheoreticalDeparture[]> {
    const schedule$ = this.http
      .get<{ d: [number, string, string, string, string][] }>(`${this.base}/stop/${stopId}.json`)
      .pipe(map((r) => r.d ?? []));
    return forkJoin({ sched: schedule$, cal: this.getCalendar() }).pipe(
      map(({ sched, cal }) => {
        const active = this.activeServices(when, cal);
        const nowSec = when.getHours() * 3600 + when.getMinutes() * 60 + when.getSeconds();
        const midnight = new Date(when.getFullYear(), when.getMonth(), when.getDate());
        return sched
          .filter(([t, , , , svc]) => active.has(svc) && t >= nowSec - 60)
          .sort((a, b) => a[0] - b[0])
          .slice(0, count)
          .map(([t, short, color, headsign]) => ({
            short,
            color,
            headsign,
            time: new Date(midnight.getTime() + t * 1000),
            inMin: Math.max(0, Math.round((t - nowSec) / 60)),
          }));
      }),
    );
  }

  /** Services actifs a une date donnee (jours de circulation + plage + exceptions). */
  private activeServices(d: Date, cal: Calendar): Set<string> {
    const ds = this.ymd(d);
    const jsDay = d.getDay(); // 0=dim..6=sam
    const idx = (jsDay + 6) % 7; // 0=lun..6=dim
    const set = new Set<string>();
    for (const [sid, s] of Object.entries(cal.services)) {
      if (ds >= s.s && ds <= s.e && s.d[idx] === 1) set.add(sid);
    }
    const exc = cal.ex[ds];
    if (exc) {
      exc.r.forEach((s) => set.delete(s));
      exc.a.forEach((s) => set.add(s));
    }
    return set;
  }

  private ymd(d: Date): string {
    return (
      d.getFullYear().toString() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0')
    );
  }

  /** Recherche d'arret par nom (hors-ligne). */
  searchStops(q: string, limit = 12): Observable<{ id: string; stop: GtfsStop }[]> {
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
    const nq = norm(q);
    if (!nq) return of([]);
    return this.getStops().pipe(
      map((stops) =>
        Object.entries(stops)
          .filter(([, s]) => norm(s.n).includes(nq))
          .slice(0, limit)
          .map(([id, stop]) => ({ id, stop })),
      ),
    );
  }
}
