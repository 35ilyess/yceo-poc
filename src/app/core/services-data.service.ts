import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';

export interface SalePoint {
  name: string;
  address: string;
  city: string;
  lat: number;
  lon: number;
  products: string;
}

export interface Parking {
  name: string;
  capacity: number;
  free: boolean;
  pr: boolean;
  lat: number;
  lon: number;
  /** Arret Ycéo le plus proche. */
  stop: string;
  stopDist: number;
}

export interface ServicesData {
  sales: SalePoint[];
  parkings: Parking[];
  sources: { sales: string; parkings: string };
}

/** Parkings proches d'un arret + points de vente (assets/services.json, tools/build-services.py). */
@Injectable({ providedIn: 'root' })
export class ServicesDataService {
  private http = inject(HttpClient);
  private data$?: Observable<ServicesData>;

  get(): Observable<ServicesData> {
    this.data$ ??= this.http.get<ServicesData>('assets/services.json').pipe(shareReplay(1));
    return this.data$;
  }
}
