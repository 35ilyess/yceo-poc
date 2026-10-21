import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ConfigService } from './config.service';
import { Line, Stop } from './models';

/**
 * Donnees geographiques ouvertes via l'API Opendatasoft du reseau (sans cle, CORS-friendly).
 * Meme modele que l'app STAR avec keolis-rennes.opendatasoft.com.
 */
@Injectable({ providedIn: 'root' })
export class OdsService {
  private http = inject(HttpClient);
  private cfg = inject(ConfigService);

  private recordsUrl(dataset: string): string {
    return `${this.cfg.network.odsBaseUrl}/catalog/datasets/${dataset}/records`;
  }

  /** Tous les arrets du reseau (coordonnees pour la carte). */
  getStops(): Observable<Stop[]> {
    const url = this.recordsUrl(this.cfg.network.odsDatasets.stops);
    return this.http
      .get<any>(url, { params: { limit: '100', select: 'stop_id,stop_name,stop_coordinates' } })
      .pipe(
        // L'API pagine a 100 ; pour le POC on charge la 1re page puis on complete en parallele.
        map((res) => this.mapStops(res)),
      );
  }

  /** Chargement pagine complet des arrets (jusqu'a `max`). */
  getAllStops(max = 2000): Observable<Stop[]> {
    const url = this.recordsUrl(this.cfg.network.odsDatasets.stops);
    // ODS v2.1 autorise limit<=100 ; on enchaine les offsets.
    return new Observable<Stop[]>((sub) => {
      const all: Stop[] = [];
      const step = 100;
      const fetchPage = (offset: number) => {
        this.http
          .get<any>(url, {
            params: {
              limit: String(step),
              offset: String(offset),
              select: 'stop_id,stop_name,stop_coordinates',
            },
          })
          .subscribe({
            next: (res) => {
              const page = this.mapStops(res);
              all.push(...page);
              const total = res?.total_count ?? all.length;
              if (all.length < Math.min(total, max) && page.length === step) {
                fetchPage(offset + step);
              } else {
                sub.next(all);
                sub.complete();
              }
            },
            error: (e) => sub.error(e),
          });
      };
      fetchPage(0);
    });
  }

  /** Lignes avec couleur + trace (geo_shape) pour la carte. */
  getLines(): Observable<Line[]> {
    const url = this.recordsUrl(this.cfg.network.odsDatasets.lines);
    return this.http
      .get<any>(url, {
        params: { limit: '100', select: 'route_short_name,route_long_name,route_color,shape' },
      })
      .pipe(
        map((res) =>
          (res?.results ?? []).map(
            (r: any): Line => ({
              shortName: r.route_short_name ?? '',
              longName: r.route_long_name ?? '',
              color: (r.route_color ?? '888888').replace('#', ''),
              shape: r.shape,
            }),
          ),
        ),
      );
  }

  private mapStops(res: any): Stop[] {
    return (res?.results ?? [])
      .filter((r: any) => r.stop_coordinates)
      .map(
        (r: any): Stop => ({
          id: r.stop_id,
          name: r.stop_name,
          lat: r.stop_coordinates.lat,
          lon: r.stop_coordinates.lon,
        }),
      );
  }
}
