import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PlacePoint } from './models';

const KEY = 'yceo.recent.places';
const MAX = 8;

/** Lieux récemment utilisés comme départ/arrivée d'itinéraire (localStorage). */
@Injectable({ providedIn: 'root' })
export class RecentService {
  private subject = new BehaviorSubject<PlacePoint[]>(this.load());
  readonly recent$ = this.subject.asObservable();

  list(): PlacePoint[] {
    return this.subject.value;
  }

  /** Ajoute un lieu en tête (hors « ma position »), dédoublonné. */
  add(p: PlacePoint): void {
    if (p.kind === 'here') return;
    const key = this.key(p);
    const next = [p, ...this.subject.value.filter((o) => this.key(o) !== key)].slice(0, MAX);
    this.persist(next);
  }

  clear(): void {
    this.persist([]);
  }

  private key(p: PlacePoint): string {
    return p.stopId ?? `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`;
  }

  private load(): PlacePoint[] {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  }

  private persist(list: PlacePoint[]): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      /* mode privé : ignore */
    }
    this.subject.next(list);
  }
}
