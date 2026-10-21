import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ConfigService } from './config.service';
import { Departure, Journey, JourneySection, Place } from './models';

/**
 * Client API Navitia (itineraire + prochains passages).
 * Auth : header `Authorization: <token>` — exactement le schema observe dans l'app STAR
 * (`headers: { Authorization: navitiaToken }`). Le token vient des Reglages (navitia.io, gratuit).
 */
@Injectable({ providedIn: 'root' })
export class NavitiaService {
  private http = inject(HttpClient);
  private cfg = inject(ConfigService);

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: this.cfg.navitiaToken });
  }

  private cov(): string {
    return this.cfg.coverage;
  }

  /** Resout la couverture regionale a partir d'un point (lon;lat). */
  resolveCoverage(lon: number, lat: number): Observable<string | null> {
    const url = `${this.cfg.network.navitia.baseUrl}/coverage/${lon};${lat}`;
    return this.http.get<any>(url, { headers: this.headers() }).pipe(
      map((res) => res?.regions?.[0]?.id ?? null),
    );
  }

  /** Autocompletion de lieux (arrets, adresses). */
  searchPlaces(q: string): Observable<Place[]> {
    const url = `${this.cfg.network.navitia.baseUrl}/coverage/${this.cov()}/places`;
    const params = new HttpParams().set('q', q).set('count', '8');
    return this.http.get<any>(url, { headers: this.headers(), params }).pipe(
      map((res) =>
        (res?.places ?? []).map((p: any): Place => {
          const emb = p[p.embedded_type] ?? {};
          const coord = emb.coord ?? emb.stop_point?.coord;
          return {
            id: p.id,
            name: p.name,
            lat: coord ? parseFloat(coord.lat) : undefined,
            lon: coord ? parseFloat(coord.lon) : undefined,
          };
        }),
      ),
    );
  }

  /** Prochains passages a un arret (stop_area id Navitia), temps reel si disponible. */
  getDepartures(stopAreaId: string): Observable<Departure[]> {
    const base = this.cfg.network.navitia.baseUrl;
    const url = `${base}/coverage/${this.cov()}/stop_areas/${encodeURIComponent(stopAreaId)}/departures`;
    const params = new HttpParams().set('count', '12').set('data_freshness', 'realtime');
    return this.http.get<any>(url, { headers: this.headers(), params }).pipe(
      map((res) =>
        (res?.departures ?? []).map((d: any): Departure => {
          const di = d.display_informations ?? {};
          const sdt = d.stop_date_time ?? {};
          return {
            line: di.code || di.label || di.commercial_mode || '?',
            lineColor: di.color,
            direction: di.direction || di.headsign || '',
            time: parseNavitiaDate(sdt.departure_date_time),
            realtime: (sdt.data_freshness ?? di.data_freshness) === 'realtime',
          };
        }),
      ),
    );
  }

  /** Recherche d'itineraire entre deux lieux (ids ou "lon;lat"). */
  getJourneys(from: string, to: string): Observable<Journey[]> {
    const url = `${this.cfg.network.navitia.baseUrl}/coverage/${this.cov()}/journeys`;
    const params = new HttpParams().set('from', from).set('to', to).set('count', '5');
    return this.http.get<any>(url, { headers: this.headers(), params }).pipe(
      map((res) =>
        (res?.journeys ?? []).map((j: any): Journey => ({
          departure: parseNavitiaDate(j.departure_date_time),
          arrival: parseNavitiaDate(j.arrival_date_time),
          durationMin: Math.round((j.duration ?? 0) / 60),
          nbTransfers: j.nb_transfers ?? 0,
          sections: (j.sections ?? [])
            .filter((s: any) => s.type === 'public_transport' || s.type === 'street_network')
            .map((s: any): JourneySection => {
              const di = s.display_informations ?? {};
              return {
                mode:
                  s.type === 'street_network'
                    ? s.mode || 'walking'
                    : di.commercial_mode || 'bus',
                label: di.code || di.label || (s.type === 'street_network' ? 'Marche' : 'Bus'),
                from: s.from?.name ?? '',
                to: s.to?.name ?? '',
                durationMin: Math.round((s.duration ?? 0) / 60),
                lineColor: di.color,
              };
            }),
        })),
      ),
    );
  }
}

/** Parse le format Navitia "YYYYMMDDTHHMMSS" en Date locale. */
export function parseNavitiaDate(s?: string): Date {
  if (!s || s.length < 15) return new Date(NaN);
  const y = +s.slice(0, 4);
  const mo = +s.slice(4, 6) - 1;
  const d = +s.slice(6, 8);
  const h = +s.slice(9, 11);
  const mi = +s.slice(11, 13);
  const se = +s.slice(13, 15);
  return new Date(y, mo, d, h, mi, se);
}
