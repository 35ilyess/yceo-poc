import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, shareReplay } from 'rxjs';
import { norm } from './places.service';

export interface PmrDetail {
  podotactile: boolean;
  ufr: boolean;
  prioritaire: boolean;
}
interface PmrData {
  stops: string[];
  details: Record<string, PmrDetail>;
  source: string;
}

/** Arrêts accessibles PMR (assets/pmr.json, tools/build-pmr.py). Associé par nom normalisé. */
@Injectable({ providedIn: 'root' })
export class AccessibilityService {
  private http = inject(HttpClient);
  private data$?: Observable<PmrData>;

  private load(): Observable<PmrData> {
    this.data$ ??= this.http.get<PmrData>('assets/pmr.json').pipe(shareReplay(1));
    return this.data$;
  }

  /** Ensemble des noms d'arrêts accessibles (normalisés), pour un test rapide. */
  accessibleNames(): Observable<Set<string>> {
    return this.load().pipe(map((d) => new Set(d.stops)));
  }

  detail(stopName: string): Observable<PmrDetail | null> {
    return this.load().pipe(map((d) => d.details[norm(stopName)] ?? null));
  }
}

export const isAccessible = (set: Set<string>, name: string): boolean => set.has(norm(name));
