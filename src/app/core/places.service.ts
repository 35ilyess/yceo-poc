import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { ConfigService } from './config.service';
import { GeoService } from './geo.service';
import { GtfsLine, GtfsService } from './gtfs.service';
import { PlacePoint } from './models';
import { haversine } from './router.service';

export interface StopHit {
  id: string;
  name: string;
  city: string;
  lines: string[];
  lat: number;
  lon: number;
}

const GEOCODER = 'https://data.geopf.fr/geocodage/search';
const MAX_KM = 35; // ignore les adresses hors du territoire

export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-'’]/g, ' ');
}

/**
 * Recherche unifiee : lignes + arrets (GTFS hors-ligne) + adresses
 * (Geoplateforme IGN, service public ouvert, sans cle) + geolocalisation.
 */
@Injectable({ providedIn: 'root' })
export class PlacesService {
  private http = inject(HttpClient);
  private gtfs = inject(GtfsService);
  private cfg = inject(ConfigService);
  private geo = inject(GeoService);

  searchLines(q: string): Observable<GtfsLine[]> {
    const nq = norm(q.trim());
    if (!nq) return of([]);
    return this.gtfs.getLines().pipe(
      map((lines) => {
        const seen = new Set<string>();
        return lines.filter((l) => {
          if (l.id.startsWith('SCOL') || seen.has(l.short)) return false;
          const hit = norm(l.short) === nq || norm(l.short).startsWith(nq) || norm(l.long).includes(nq);
          if (hit) seen.add(l.short);
          return hit;
        });
      }),
      map((ls) => ls.slice(0, 6)),
    );
  }

  /** Arrets dedupliques par nom + commune (un resultat par arret physique). */
  searchStops(q: string, limit = 8): Observable<StopHit[]> {
    const nq = norm(q.trim());
    if (nq.length < 2) return of([]);
    const c = this.cfg.network.map;
    const dist = (h: StopHit) => haversine(c.lat, c.lon, h.lat, h.lon);
    return this.gtfs.getStops().pipe(
      map((stops) => {
        const byName = new Map<string, StopHit>();
        for (const [id, s] of Object.entries(stops)) {
          const n = norm(s.n);
          if (!n.includes(nq)) continue;
          if (haversine(c.lat, c.lon, s.lat, s.lon) / 1000 > MAX_KM) continue;
          const key = n + '|' + s.c;
          const prev = byName.get(key);
          if (prev) {
            prev.lines = [...new Set([...prev.lines, ...s.l])];
            continue;
          }
          byName.set(key, { id, name: s.n, city: s.c, lines: [...s.l], lat: s.lat, lon: s.lon });
        }
        return [...byName.values()]
          .sort((a, b) => +norm(b.name).startsWith(nq) - +norm(a.name).startsWith(nq) || dist(a) - dist(b))
          .slice(0, limit);
      }),
    );
  }

  searchAddresses(q: string, limit = 5): Observable<PlacePoint[]> {
    if (q.trim().length < 3) return of([]);
    const { lat, lon } = this.cfg.network.map;
    const params = { q: q.trim(), lat, lon, limit: limit * 2, index: 'address,poi' };
    return this.http.get<any>(GEOCODER, { params: params as any }).pipe(
      map((fc) =>
        (fc.features ?? [])
          .map((f: any) => ({
            kind: 'address' as const,
            name: f.properties.name || f.properties.label,
            city: f.properties.city,
            lon: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          }))
          .filter((p: PlacePoint) => haversine(lat, lon, p.lat, p.lon) / 1000 <= MAX_KM)
          .filter(
            (p: PlacePoint, i: number, arr: PlacePoint[]) =>
              arr.findIndex((o) => norm(o.name) === norm(p.name) && o.city === p.city) === i,
          )
          .slice(0, limit),
      ),
      catchError(() => of([])),
    );
  }

  stopToPlace(s: StopHit): PlacePoint {
    return { kind: 'stop', name: s.name, city: s.city, lat: s.lat, lon: s.lon, stopId: s.id };
  }

  /** Position courante (plugin Capacitor natif, ou API navigateur en PWA/web). */
  async locate(): Promise<PlacePoint> {
    const p = await this.geo.current();
    return { kind: 'here', name: 'Ma position', lat: p.lat, lon: p.lon };
  }
}
