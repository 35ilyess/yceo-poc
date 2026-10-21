import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PlacePoint } from './models';

export interface FavStop {
  id: string;
  name: string;
  city?: string;
}
export interface FavLine {
  id: string;
  short: string;
  color: string;
  long?: string;
}

export interface FavTrip {
  id: string;
  from: PlacePoint;
  to: PlacePoint;
}

/** Favoris (arrêts, lignes, trajets) persistés en localStorage. */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly STOPS_KEY = 'yceo.fav.stops';
  private readonly LINES_KEY = 'yceo.fav.lines';
  private readonly TRIPS_KEY = 'yceo.fav.trips';
  private stops = new BehaviorSubject<FavStop[]>(this.load<FavStop>(this.STOPS_KEY));
  private lines = new BehaviorSubject<FavLine[]>(this.load<FavLine>(this.LINES_KEY));
  readonly favorites$ = this.stops.asObservable();
  readonly favLines$ = this.lines.asObservable();
  private trips = new BehaviorSubject<FavTrip[]>(this.load<FavTrip>(this.TRIPS_KEY));
  readonly favTrips$ = this.trips.asObservable();

  private load<T>(key: string): T[] {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  }

  private persist<T>(key: string, list: T[], subject: BehaviorSubject<T[]>): void {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch {
      /* mode privé : ignore */
    }
    subject.next(list);
  }

  // ---- Arrêts ----
  isFav(id: string): boolean {
    return this.stops.value.some((f) => f.id === id);
  }
  toggle(fav: FavStop): boolean {
    const l = this.stops.value;
    if (l.some((f) => f.id === fav.id)) {
      this.persist(this.STOPS_KEY, l.filter((f) => f.id !== fav.id), this.stops);
      return false;
    }
    this.persist(this.STOPS_KEY, [...l, fav], this.stops);
    return true;
  }

  // ---- Lignes ----
  listLines(): FavLine[] {
    return this.lines.value;
  }
  isFavLine(id: string): boolean {
    return this.lines.value.some((f) => f.id === id);
  }
  toggleLine(fav: FavLine): boolean {
    const l = this.lines.value;
    if (l.some((f) => f.id === fav.id)) {
      this.persist(this.LINES_KEY, l.filter((f) => f.id !== fav.id), this.lines);
      return false;
    }
    this.persist(this.LINES_KEY, [...l, fav], this.lines);
    return true;
  }

  // ---- Trajets ----
  tripId(from: PlacePoint, to: PlacePoint): string {
    const k = (p: PlacePoint) => p.stopId ?? (p.kind === 'here' ? 'here' : `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`);
    return `${k(from)}>${k(to)}`;
  }
  getTrip(id: string): FavTrip | undefined {
    return this.trips.value.find((t) => t.id === id);
  }
  isFavTrip(from: PlacePoint, to: PlacePoint): boolean {
    return !!this.getTrip(this.tripId(from, to));
  }
  toggleTrip(from: PlacePoint, to: PlacePoint): boolean {
    const id = this.tripId(from, to);
    const l = this.trips.value;
    if (l.some((t) => t.id === id)) {
      this.persist(this.TRIPS_KEY, l.filter((t) => t.id !== id), this.trips);
      return false;
    }
    this.persist(this.TRIPS_KEY, [...l, { id, from, to }], this.trips);
    return true;
  }
}
