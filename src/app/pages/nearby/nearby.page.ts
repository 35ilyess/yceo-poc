import { GeoService } from '../../core/geo.service';
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSpinner,
  IonIcon,
  IonButton,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { locateOutline, chevronForward, warningOutline } from 'ionicons/icons';
import { forkJoin } from 'rxjs';
import { GtfsService } from '../../core/gtfs.service';
import { LineBadgeComponent } from '../../shared/line-badge.component';
import { ConfigService } from '../../core/config.service';

interface NearStop {
  id: string;
  name: string;
  city: string;
  lines: string[];
  dist: number; // mètres
}

@Component({
  selector: 'app-nearby',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSpinner,
    IonIcon,
    IonButton,
    LineBadgeComponent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar><ion-title>Autour de moi</ion-title></ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="pad">
        <div class="center" *ngIf="loading">
          <ion-spinner name="dots"></ion-spinner>
          <p class="muted">Localisation en cours…</p>
        </div>

        <div class="center" *ngIf="error">
          <ion-icon name="warning-outline" class="big"></ion-icon>
          <p>{{ error }}</p>
          <ion-button (click)="locate()">Réessayer</ion-button>
          <ion-button fill="clear" (click)="useCenter()">Voir le centre de Saint-Nazaire</ion-button>
        </div>

        <ng-container *ngIf="!loading && !error">
          <p class="muted src">
            {{ fromCenter ? 'Depuis le centre de Saint-Nazaire' : 'Arrêts les plus proches de vous' }}
          </p>
          <div class="card list">
            <a
              class="row"
              *ngFor="let s of stops; let last = last"
              [class.last]="last"
              [routerLink]="['/stops', s.id]"
            >
              <div class="d">{{ fmtDist(s.dist) }}</div>
              <div class="txt">
                <div class="name">{{ s.name }}</div>
                <div class="city muted" *ngIf="s.city">{{ s.city }}</div>
              </div>
              <div class="badges">
                <app-line-badge
                  *ngFor="let ln of s.lines.slice(0, 3)"
                  [label]="ln"
                  [color]="lineColor(ln)"
                  [size]="24"
                ></app-line-badge>
              </div>
              <ion-icon name="chevron-forward" class="chev"></ion-icon>
            </a>
          </div>
        </ng-container>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .pad {
        padding: 10px 16px 24px;
      }
      .center {
        text-align: center;
        margin-top: 50px;
      }
      .center .big {
        font-size: 2.6rem;
        color: var(--yceo-orange);
      }
      .src {
        margin: 2px 4px 12px;
        font-size: 0.85rem;
      }
      .list {
        overflow: hidden;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--yceo-border);
        text-decoration: none;
        color: var(--yceo-ink);
      }
      .row.last {
        border-bottom: none;
      }
      .d {
        flex: none;
        min-width: 52px;
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        font-size: 0.85rem;
        color: var(--yceo-primary-dark);
      }
      .txt {
        flex: 1;
        min-width: 0;
      }
      .name {
        font-weight: 600;
        font-size: 0.95rem;
      }
      .city {
        font-size: 0.78rem;
      }
      .badges {
        display: flex;
        gap: 4px;
        flex: none;
      }
      .chev {
        color: var(--yceo-muted);
        flex: none;
      }
    `,
  ],
})
export class NearbyPage {
  private gtfs = inject(GtfsService);
  private cfg = inject(ConfigService);
  private geo = inject(GeoService);
  stops: NearStop[] = [];
  loading = true;
  error = '';
  fromCenter = false;
  private colorByShort = new Map<string, string>();

  constructor() {
    addIcons({ locateOutline, chevronForward, warningOutline });
    this.gtfs.getLines().subscribe((lines) => {
      for (const l of lines) if (!this.colorByShort.has(l.short)) this.colorByShort.set(l.short, l.color);
    });
    this.locate();
  }

  locate(): void {
    this.loading = true;
    this.error = '';
    this.fromCenter = false;
    this.geo
      .current()
      .then((pos) => this.compute(pos.lat, pos.lon))
      .catch(() => this.fail('Position indisponible (autorisation refusée ou GPS inactif).'));
  }

  useCenter(): void {
    this.error = '';
    this.loading = true;
    this.fromCenter = true;
    this.compute(this.cfg.network.map.lat, this.cfg.network.map.lon);
  }

  private fail(msg: string): void {
    this.loading = false;
    this.error = msg;
  }

  private compute(lat: number, lon: number): void {
    this.gtfs.getStops().subscribe((stops) => {
      const list: NearStop[] = Object.entries(stops).map(([id, s]) => ({
        id,
        name: s.n,
        city: s.c,
        lines: s.l,
        dist: this.haversine(lat, lon, s.lat, s.lon),
      }));
      // dédup par nom en gardant le plus proche
      const byName = new Map<string, NearStop>();
      for (const s of list.sort((a, b) => a.dist - b.dist)) {
        if (!byName.has(s.name)) byName.set(s.name, s);
      }
      this.stops = [...byName.values()].slice(0, 25);
      this.loading = false;
    });
  }

  private haversine(la1: number, lo1: number, la2: number, lo2: number): number {
    const R = 6371000;
    const dLa = ((la2 - la1) * Math.PI) / 180;
    const dLo = ((lo2 - lo1) * Math.PI) / 180;
    const a =
      Math.sin(dLa / 2) ** 2 +
      Math.cos((la1 * Math.PI) / 180) * Math.cos((la2 * Math.PI) / 180) * Math.sin(dLo / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  fmtDist(m: number): string {
    return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
  }

  lineColor(short: string): string {
    return this.colorByShort.get(short) ?? '00a7b5';
  }
}
