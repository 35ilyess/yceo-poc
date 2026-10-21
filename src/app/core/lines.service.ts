import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { OdsService } from './ods.service';
import { Line } from './models';

/** Lignes du reseau, chargees une fois et mises en cache, triees intelligemment. */
@Injectable({ providedIn: 'root' })
export class LinesService {
  private ods = inject(OdsService);
  private cache$?: Observable<Line[]>;

  getLines(): Observable<Line[]> {
    if (!this.cache$) {
      this.cache$ = this.ods.getLines().pipe(
        map((lines) => [...lines].sort((a, b) => this.rank(a.shortName) - this.rank(b.shortName))),
        shareReplay(1),
      );
    }
    return this.cache$;
  }

  /** Tri numerique quand possible, alphabetique sinon. */
  private rank(name: string): number {
    const n = parseInt(name, 10);
    return isNaN(n) ? 1000 + (name.charCodeAt(0) || 0) : n;
  }
}
