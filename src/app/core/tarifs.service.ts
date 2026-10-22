import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';

export interface TarifItem {
  name: string;
  price: number | null;
  condition: string;
  vente: string;
}
export interface TarifGroup {
  category: string;
  items: TarifItem[];
}
export interface TarifsData {
  updated: string;
  source: string;
  groups: TarifGroup[];
}

/** Titres & tarifs Ycéo (assets/tarifs.json, tools/build-tarifs.py). */
@Injectable({ providedIn: 'root' })
export class TarifsService {
  private http = inject(HttpClient);
  private data$?: Observable<TarifsData>;

  get(): Observable<TarifsData> {
    this.data$ ??= this.http.get<TarifsData>('assets/tarifs.json').pipe(shareReplay(1));
    return this.data$;
  }
}
