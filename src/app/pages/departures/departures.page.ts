import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSearchbar,
  IonSpinner,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronForward, timeOutline } from 'ionicons/icons';
import { GtfsService, GtfsStop } from '../../core/gtfs.service';
import { LineBadgeComponent } from '../../shared/line-badge.component';

@Component({
  selector: 'app-departures',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSearchbar,
    IonSpinner,
    IonIcon,
    LineBadgeComponent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar><ion-title>Prochains passages</ion-title></ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="pad">
        <ion-searchbar
          placeholder="Rechercher un arrêt…"
          [debounce]="200"
          (ionInput)="search($any($event).target.value)"
        ></ion-searchbar>

        <ion-spinner *ngIf="searching" name="dots"></ion-spinner>

        <div class="card list" *ngIf="results.length">
          <a
            class="row"
            *ngFor="let r of results; let last = last"
            [class.last]="last"
            [routerLink]="['/stops', r.id]"
          >
            <div class="txt">
              <div class="name">{{ r.stop.n }}</div>
              <div class="city muted" *ngIf="r.stop.c">{{ r.stop.c }}</div>
            </div>
            <div class="badges">
              <app-line-badge
                *ngFor="let ln of r.stop.l.slice(0, 4)"
                [label]="ln"
                [color]="lineColor(ln)"
                [size]="26"
              ></app-line-badge>
            </div>
            <ion-icon name="chevron-forward" class="chev"></ion-icon>
          </a>
        </div>

        <div class="hint muted" *ngIf="!results.length && !searching">
          <ion-icon name="time-outline"></ion-icon>
          <p>Cherchez un arrêt pour voir ses prochains passages (horaires théoriques, hors-ligne).</p>
        </div>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .pad {
        padding: 6px 16px 24px;
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
      .hint {
        text-align: center;
        margin-top: 40px;
      }
      .hint ion-icon {
        font-size: 2.4rem;
        opacity: 0.5;
      }
    `,
  ],
})
export class DeparturesPage {
  private gtfs = inject(GtfsService);
  results: { id: string; stop: GtfsStop }[] = [];
  searching = false;
  lineColors: Record<string, string> = {};

  constructor() {
    addIcons({ chevronForward, timeOutline });
    this.gtfs.getLines().subscribe((lines) => {
      for (const l of lines) this.lineColors[l.short] ??= l.color;
    });
  }

  search(q: string): void {
    if (!q || q.length < 2) {
      this.results = [];
      return;
    }
    this.searching = true;
    this.gtfs.searchStops(q).subscribe({
      next: (r) => {
        this.results = r;
        this.searching = false;
      },
      error: () => (this.searching = false),
    });
  }

  lineColor(short: string): string {
    return this.lineColors[short] ?? '00a7b5';
  }
}
