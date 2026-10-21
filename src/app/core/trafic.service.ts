import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, shareReplay } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface TraficAlert {
  title: string;
  period: string;
  start?: string;
  end?: string;
  body: string;
  lines: string[];
}
export interface TraficData {
  source: string;
  fetchedAt: string;
  affectedLines: string[];
  alerts: TraficAlert[];
}

/**
 * Infos trafic — extraites du site officiel (yceo-mobilite.fr) par tools/build-trafic.py
 * et servies en JSON (assets/trafic.json). Re-générer pour rafraîchir.
 */
@Injectable({ providedIn: 'root' })
export class TraficService {
  private http = inject(HttpClient);
  private cache$?: Observable<TraficData>;

  get(): Observable<TraficData> {
    this.cache$ ??= this.http.get<TraficData>('assets/trafic.json').pipe(
      catchError(() => of({ source: '', fetchedAt: '', affectedLines: [], alerts: [] } as TraficData)),
      shareReplay(1),
    );
    return this.cache$;
  }
}
