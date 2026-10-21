import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonSpinner,
  IonButton,
  IonIcon,
  IonNote,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { accessibility, refreshOutline, locationOutline, navigate, radioButtonOn, star, starOutline } from 'ionicons/icons';
import { forkJoin } from 'rxjs';
import { GtfsService, GtfsStop, TheoreticalDeparture } from '../../core/gtfs.service';
import { FavoritesService } from '../../core/favorites.service';
import { AccessibilityService, PmrDetail } from '../../core/accessibility.service';
import { JourneyStore } from '../../core/journey-store.service';
import { PlacePoint } from '../../core/models';
import { LineBadgeComponent } from '../../shared/line-badge.component';

@Component({
  selector: 'app-stop-detail',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonSpinner,
    IonButton,
    IonIcon,
    IonNote,
    LineBadgeComponent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/home"></ion-back-button></ion-buttons>
        <ion-title>Arrêt</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="ion-text-center ion-padding" *ngIf="loading"><ion-spinner name="dots"></ion-spinner></div>

      <div *ngIf="stop as s">
        <div class="hero">
          <ion-icon
            class="fav"
            role="button"
            tabindex="0"
            [attr.aria-label]="isFav ? 'Retirer cet arrêt des favoris' : 'Ajouter cet arrêt aux favoris'"
            [attr.aria-pressed]="isFav"
            [name]="isFav ? 'star' : 'star-outline'"
            (click)="toggleFav(s)"
            (keyup.enter)="toggleFav(s)"
          ></ion-icon>
          <div class="eyebrow"><ion-icon name="location-outline"></ion-icon> {{ s.c || 'Arrêt' }}</div>
          <h1>{{ s.n }}</h1>
          <div class="badges">
            <app-line-badge *ngFor="let ln of s.l" [label]="ln" [color]="lineColor(ln)" [size]="30"></app-line-badge>
          </div>
          <div class="pmr-chip" *ngIf="pmr">
            <ion-icon name="accessibility"></ion-icon>
            <span>Arrêt accessible<span *ngIf="pmrLabel"> · {{ pmrLabel }}</span></span>
          </div>
          <div class="go-row">
            <button class="go" (click)="goHere(s)"><ion-icon name="navigate"></ion-icon> Y aller</button>
            <button class="go ghost" (click)="fromHere(s)"><ion-icon name="radio-button-on"></ion-icon> Partir d’ici</button>
          </div>
        </div>

        <div class="pad">
          <div class="section-title">
            <span>Prochains passages</span>
            <button class="icon-btn" (click)="refresh()" aria-label="Rafraîchir les passages">
              <ion-icon name="refresh-outline"></ion-icon>
            </button>
          </div>

          <div class="ion-text-center" *ngIf="loadingDep"><ion-spinner name="dots"></ion-spinner></div>

          <div class="card list" *ngIf="!loadingDep">
            <!-- groupé par ligne + direction -->
            <div class="grp" *ngFor="let g of groups; let last = last" [class.last]="last">
              <app-line-badge [label]="g.short" [color]="g.color" [size]="34"></app-line-badge>
              <div class="info">
                <div class="dir">{{ g.headsign }}</div>
                <div class="times">
                  <span class="t" *ngFor="let d of g.items">
                    <ng-container *ngIf="d.inMin <= 60; else hhmm">{{ d.inMin }} min</ng-container>
                    <ng-template #hhmm>{{ d.time | date: 'HH:mm' }}</ng-template>
                  </span>
                </div>
              </div>
            </div>
            <div class="empty" *ngIf="!groups.length">
              Plus de passage aujourd’hui à cet arrêt.
            </div>
          </div>

          <ion-note color="medium" class="foot">
            Horaires théoriques (GTFS Ycéo). Temps réel non disponible en open data.
          </ion-note>
        </div>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .pmr-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 12px;
        padding: 5px 11px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.18);
        color: #fff;
        font-size: 0.82rem;
        font-weight: 600;
      }
      .pmr-chip ion-icon {
        font-size: 1.05rem;
      }
      .go-row {
        display: flex;
        gap: 8px;
        margin-top: 14px;
      }
      .go {
        border: none;
        border-radius: 999px;
        padding: 9px 16px;
        font: inherit;
        font-weight: 700;
        font-size: 0.88rem;
        background: #fff;
        color: #005872;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .go.ghost {
        background: rgba(255, 255, 255, 0.18);
        color: #fff;
      }
      .hero {
        position: relative;
        background: linear-gradient(145deg, #00a7b5 0%, #005872 100%);
        color: #fff;
        padding: 16px 18px 20px;
        border-radius: 0 0 22px 22px;
      }
      .hero .fav {
        position: absolute;
        top: 14px;
        right: 16px;
        font-size: 1.7rem;
        color: #ffcf33;
        cursor: pointer;
        padding: 4px;
      }
      .hero .eyebrow {
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        opacity: 0.9;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .hero h1 {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        font-size: 1.5rem;
        margin: 4px 0 12px;
      }
      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .pad {
        padding: 6px 16px 28px;
      }
      .list {
        overflow: hidden;
      }
      .grp {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--yceo-border);
      }
      .grp.last {
        border-bottom: none;
      }
      .info {
        flex: 1;
        min-width: 0;
      }
      .dir {
        font-weight: 600;
        font-size: 0.92rem;
      }
      .times {
        display: flex;
        gap: 8px;
        margin-top: 4px;
        flex-wrap: wrap;
      }
      .times .t {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        font-size: 0.85rem;
        color: var(--yceo-primary-dark);
        background: var(--yceo-tile);
        border-radius: 7px;
        padding: 2px 8px;
      }
      .icon-btn {
        background: none;
        border: none;
        color: var(--yceo-primary);
        font-size: 1.2rem;
        padding: 4px;
        display: inline-flex;
      }
      .empty {
        padding: 18px 14px;
        color: var(--yceo-muted);
        text-align: center;
      }
      .foot {
        display: block;
        margin-top: 12px;
        font-size: 0.78rem;
      }
    `,
  ],
})
export class StopDetailPage {
  private gtfs = inject(GtfsService);
  private route = inject(ActivatedRoute);
  private favs = inject(FavoritesService);
  private a11y = inject(AccessibilityService);
  private store = inject(JourneyStore);
  private router = inject(Router);
  private id = this.route.snapshot.paramMap.get('id')!;
  stop?: GtfsStop;
  departures: TheoreticalDeparture[] = [];
  groups: { short: string; color: string; headsign: string; items: TheoreticalDeparture[] }[] = [];
  lineColors: Record<string, string> = {};
  loading = true;
  loadingDep = true;
  isFav = this.favs.isFav(this.id);
  pmr: PmrDetail | null = null;

  constructor() {
    addIcons({ accessibility, refreshOutline, locationOutline, navigate, radioButtonOn, star, starOutline });
    forkJoin({ stop: this.gtfs.getStop(this.id), lines: this.gtfs.getLines() }).subscribe({
      next: ({ stop, lines }) => {
        this.stop = stop;
        for (const l of lines) this.lineColors[l.short] ??= l.color;
        this.loading = false;
        if (stop) this.a11y.detail(stop.n).subscribe((d) => (this.pmr = d));
        this.refresh();
      },
      error: () => (this.loading = false),
    });
  }

  refresh(): void {
    this.loadingDep = true;
    this.gtfs.nextDepartures(this.id, 30).subscribe({
      next: (d) => {
        this.departures = d;
        this.groups = this.group(d);
        this.loadingDep = false;
      },
      error: () => (this.loadingDep = false),
    });
  }

  /** Regroupe les passages par ligne + direction, 3 prochains par groupe. */
  private group(
    deps: TheoreticalDeparture[],
  ): { short: string; color: string; headsign: string; items: TheoreticalDeparture[] }[] {
    const map = new Map<string, { short: string; color: string; headsign: string; items: TheoreticalDeparture[] }>();
    for (const d of deps) {
      const key = d.short + '|' + d.headsign;
      if (!map.has(key))
        map.set(key, { short: d.short, color: d.color, headsign: d.headsign, items: [] });
      const g = map.get(key)!;
      if (g.items.length < 3) g.items.push(d);
    }
    return [...map.values()].sort((a, b) => a.items[0].time.getTime() - b.items[0].time.getTime());
  }

  get pmrLabel(): string {
    if (!this.pmr) return '';
    const bits: string[] = [];
    if (this.pmr.ufr) bits.push('place UFR');
    if (this.pmr.podotactile) bits.push('bande podotactile');
    return bits.join(' · ');
  }

  lineColor(short: string): string {
    return this.lineColors[short] ?? '00a7b5';
  }

  toggleFav(s: GtfsStop): void {
    this.isFav = this.favs.toggle({ id: this.id, name: s.n, city: s.c });
  }

  private place(s: GtfsStop): PlacePoint {
    return { kind: 'stop', name: s.n, city: s.c, lat: s.lat, lon: s.lon, stopId: this.id };
  }

  /** Itinéraire de ma position vers cet arrêt. */
  goHere(s: GtfsStop): void {
    this.store.pendingFrom = null;
    this.store.pendingTo = this.place(s);
    this.router.navigate(['/journey']);
  }

  /** Itinéraire au départ de cet arrêt (arrivée à choisir). */
  fromHere(s: GtfsStop): void {
    this.store.pendingFrom = this.place(s);
    this.store.pendingTo = null;
    this.router.navigate(['/journey']);
  }
}
