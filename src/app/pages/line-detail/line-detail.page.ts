import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonSpinner,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonIcon,
  IonButton,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  chevronForwardOutline,
  swapVerticalOutline,
  mapOutline,
  star,
  starOutline,
} from 'ionicons/icons';
import { forkJoin } from 'rxjs';
import { FavoritesService } from '../../core/favorites.service';
import {
  GtfsService,
  GtfsStop,
  LineTimetable,
  LineTimetableDir,
  LineTrip,
} from '../../core/gtfs.service';
import { LineBadgeComponent } from '../../shared/line-badge.component';

@Component({
  selector: 'app-line-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonSpinner,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonIcon,
    IonButton,
    LineBadgeComponent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/lines"></ion-back-button></ion-buttons>
        <ion-title>Horaires</ion-title>
        <ion-buttons slot="end">
          <ion-button
            (click)="toggleFavLine()"
            [attr.aria-label]="isFavLine ? 'Retirer la ligne des favoris' : 'Ajouter la ligne aux favoris'"
            [attr.aria-pressed]="isFavLine"
          >
            <ion-icon
              slot="icon-only"
              [name]="isFavLine ? 'star' : 'star-outline'"
              [style.color]="isFavLine ? '#f5b301' : null"
            ></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="ion-text-center ion-padding" *ngIf="loading"><ion-spinner name="dots"></ion-spinner></div>

      <div *ngIf="tt as l">
        <div class="head" [style.background]="'#' + l.color">
          <app-line-badge [label]="l.short" [color]="'ffffff'" [size]="44"></app-line-badge>
          <div class="dest" [style.color]="headText(l.color)">
            <span class="to">vers</span> {{ curDir?.term }}
          </div>
        </div>

        <div class="pad">
          <ion-button
            class="map-btn"
            expand="block"
            fill="outline"
            [routerLink]="['/map']"
            [queryParams]="{ line: l.short }"
          >
            <ion-icon name="map-outline" slot="start"></ion-icon>
            Voir la ligne sur le plan
          </ion-button>

          <!-- Sens -->
          <ion-segment
            *ngIf="l.directions.length > 1"
            [value]="dirIndex"
            (ionChange)="setDir(+$any($event).detail.value)"
            mode="md"
          >
            <ion-segment-button *ngFor="let d of l.directions; let i = index" [value]="i">
              <ion-label>{{ d.term }}</ion-label>
            </ion-segment-button>
          </ion-segment>

          <!-- Navigation entre courses -->
          <div class="trip-nav card" *ngIf="trips.length">
            <button class="nav" [disabled]="tripIdx <= 0" (click)="prev()">
              <ion-icon name="chevron-back-outline"></ion-icon>
            </button>
            <div class="trip-label">
              <div class="dep">Départ {{ fmt(depOf(curTrip)) }}</div>
              <div class="idx muted">course {{ tripIdx + 1 }} / {{ trips.length }}</div>
            </div>
            <button class="nav" [disabled]="tripIdx >= trips.length - 1" (click)="next()">
              <ion-icon name="chevron-forward-outline"></ion-icon>
            </button>
          </div>

          <div class="empty card" *ngIf="!trips.length">Aucune course aujourd’hui sur ce sens.</div>

          <!-- Trajet de haut en bas avec horaires -->
          <div class="timeline card" *ngIf="curDir">
            <a
              class="stop"
              *ngFor="let sid of curDir.stops; let i = index; let last = last"
              [routerLink]="['/stops', sid]"
            >
              <span class="time" [class.off]="!hasTime(i)">{{ timeAt(i) }}</span>
              <span class="rail" [style.color]="'#' + l.color" [class.first]="i === 0" [class.last]="last">
                <span class="dot" [class.off]="!hasTime(i)"></span>
              </span>
              <span class="sname" [class.off]="!hasTime(i)">{{ stopName(sid) }}</span>
            </a>
          </div>
        </div>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .head {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 16px;
      }
      .dest {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        font-size: 1.15rem;
        line-height: 1.15;
      }
      .dest .to {
        font-weight: 500;
        opacity: 0.8;
        font-size: 0.9rem;
      }
      .pad {
        padding: 12px 16px 28px;
      }
      .trip-nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        margin: 14px 0;
      }
      .trip-nav .nav {
        width: 46px;
        height: 46px;
        border-radius: 12px;
        border: none;
        background: var(--yceo-tile);
        color: var(--yceo-primary-dark);
        font-size: 1.3rem;
        display: grid;
        place-items: center;
      }
      .trip-nav .nav:disabled {
        opacity: 0.35;
      }
      .trip-label {
        text-align: center;
      }
      .trip-label .dep {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        font-size: 1.1rem;
      }
      .trip-label .idx {
        font-size: 0.8rem;
      }
      .empty {
        padding: 16px;
        text-align: center;
        color: var(--yceo-muted);
        margin: 14px 0;
      }
      .timeline {
        overflow: hidden;
        padding: 6px 0;
      }
      .stop {
        display: flex;
        align-items: stretch;
        text-decoration: none;
        color: var(--yceo-ink);
        padding: 0 16px;
      }
      .time {
        width: 48px;
        flex: none;
        display: flex;
        align-items: center;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        font-size: 0.9rem;
        padding: 10px 0;
      }
      .time.off {
        color: var(--yceo-border);
      }
      .rail {
        position: relative;
        width: 20px;
        flex: none;
        margin: 0 12px;
      }
      .rail::before {
        content: '';
        position: absolute;
        left: 50%;
        top: 0;
        bottom: 0;
        width: 4px;
        transform: translateX(-50%);
        background: currentColor;
      }
      .rail.first::before {
        top: 50%;
      }
      .rail.last::before {
        bottom: 50%;
      }
      .dot {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #fff;
        border: 3px solid currentColor;
        z-index: 1;
      }
      .dot.off {
        border-color: var(--yceo-border);
      }
      .sname {
        padding: 11px 0;
        font-weight: 500;
        font-size: 0.95rem;
        display: flex;
        align-items: center;
      }
      .sname.off {
        color: var(--yceo-muted);
      }
    `,
  ],
})
export class LineDetailPage {
  private gtfs = inject(GtfsService);
  private route = inject(ActivatedRoute);
  private favs = inject(FavoritesService);
  private id = this.route.snapshot.paramMap.get('id')!;
  tt?: LineTimetable;
  stops: Record<string, GtfsStop> = {};
  active = new Set<string>();
  loading = true;
  dirIndex = 0;
  tripIdx = 0;
  isFavLine = this.favs.isFavLine(this.id);

  constructor() {
    addIcons({ chevronBackOutline, chevronForwardOutline, swapVerticalOutline, mapOutline, star, starOutline });
    const id = this.id;
    forkJoin({
      tt: this.gtfs.getLineTimetable(id),
      stops: this.gtfs.getStops(),
      active: this.gtfs.getActiveServices(),
    }).subscribe({
      next: ({ tt, stops, active }) => {
        this.tt = tt;
        this.stops = stops;
        this.active = active;
        this.selectNow();
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  toggleFavLine(): void {
    if (!this.tt) return;
    this.isFavLine = this.favs.toggleLine({
      id: this.tt.id,
      short: this.tt.short,
      color: this.tt.color,
      long: this.tt.long,
    });
  }

  get curDir(): LineTimetableDir | undefined {
    return this.tt?.directions[this.dirIndex];
  }

  get trips(): LineTrip[] {
    return (this.curDir?.trips ?? []).filter((t) => this.active.has(t.s));
  }

  get curTrip(): LineTrip | undefined {
    return this.trips[this.tripIdx];
  }

  setDir(i: number): void {
    this.dirIndex = i;
    this.selectNow();
  }

  prev(): void {
    if (this.tripIdx > 0) this.tripIdx--;
  }

  next(): void {
    if (this.tripIdx < this.trips.length - 1) this.tripIdx++;
  }

  /** Selectionne la course en cours / prochaine selon l'heure. */
  private selectNow(): void {
    const now = new Date();
    const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const trips = this.trips;
    const idx = trips.findIndex((t) => (this.depOf(t) ?? 0) >= nowSec);
    this.tripIdx = idx >= 0 ? idx : Math.max(0, trips.length - 1);
  }

  depOf(t?: LineTrip): number | null {
    if (!t) return null;
    return t.t.find((v) => v !== null) ?? null;
  }

  hasTime(i: number): boolean {
    return this.curTrip?.t[i] != null;
  }

  timeAt(i: number): string {
    const v = this.curTrip?.t[i];
    return v == null ? '—' : this.fmt(v);
  }

  fmt(sec: number | null): string {
    if (sec == null) return '—';
    const h = Math.floor(sec / 3600) % 24;
    const m = Math.floor((sec % 3600) / 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  stopName(id: string): string {
    return this.stops[id]?.n ?? id;
  }

  headText(color: string): string {
    const c = (color || '888888').replace('#', '');
    const r = parseInt(c.slice(0, 2), 16),
      g = parseInt(c.slice(2, 4), 16),
      b = parseInt(c.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#0f2a2d' : '#ffffff';
  }
}
