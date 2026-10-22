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
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronForward, chevronDownOutline } from 'ionicons/icons';
import { GtfsLine, GtfsService } from '../../core/gtfs.service';
import { LineBadgeComponent } from '../../shared/line-badge.component';

@Component({
  selector: 'app-lines',
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
    LineBadgeComponent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar><ion-title>Lignes</ion-title></ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="pad">
        <div class="ion-text-center" *ngIf="loading">
          <ion-spinner name="dots"></ion-spinner>
        </div>

        <ng-container *ngIf="!loading">
          <div class="section-title"><span>Réseau urbain & interurbain</span></div>
          <div class="card list">
            <a
              class="row"
              *ngFor="let l of urban; let last = last"
              [class.last]="last"
              [routerLink]="['/lines', l.id]"
            >
              <app-line-badge [label]="l.short" [color]="l.color" [size]="40"></app-line-badge>
              <div class="txt">
                <div class="name">{{ prettyName(l.long) }}</div>
              </div>
              <ion-icon name="chevron-forward" class="chev"></ion-icon>
            </a>
          </div>

          <div class="section-title" (click)="showSco = !showSco" style="cursor:pointer">
            <span>Lignes scolaires ({{ sco.length }})</span>
            <ion-icon
              name="chevron-down-outline"
              [style.transform]="showSco ? 'rotate(180deg)' : 'none'"
            ></ion-icon>
          </div>
          <div class="card list" *ngIf="showSco">
            <a
              class="row"
              *ngFor="let l of sco; let last = last"
              [class.last]="last"
              [routerLink]="['/lines', l.id]"
            >
              <app-line-badge [label]="l.short" [color]="l.color" [size]="36"></app-line-badge>
              <div class="txt"><div class="name sm">{{ prettyName(l.long) }}</div></div>
              <ion-icon name="chevron-forward" class="chev"></ion-icon>
            </a>
          </div>
        </ng-container>
      </div>
    </ion-content>
  `,
  styles: [
    `
      ion-toolbar {
        border-radius: 0 0 18px 18px;
        overflow: hidden;
      }
      .pad {
        padding: 4px 16px 24px;
      }
      .list {
        overflow: hidden;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 13px 14px;
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
        line-height: 1.25;
      }
      .name.sm {
        font-weight: 500;
        font-size: 0.9rem;
      }
      .chev {
        color: var(--yceo-muted);
        font-size: 1.1rem;
        flex: none;
      }
      .section-title ion-icon {
        transition: transform 0.2s ease;
        color: var(--yceo-primary);
      }
    `,
  ],
})
export class LinesPage {
  private gtfs = inject(GtfsService);
  urban: GtfsLine[] = [];
  sco: GtfsLine[] = [];
  loading = true;
  showSco = false;

  constructor() {
    addIcons({ chevronForward, chevronDownOutline });
    this.gtfs.getLines().subscribe({
      next: (lines) => {
        const seen = new Set<string>();
        const dedup = lines.filter((l) => {
          const k = l.short + l.color;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        const urban = dedup.filter((l) => l.urban);
        let sco = dedup.filter((l) => !l.urban);
        // Force la L13 (interurbaine La Baule / Pornichet / Saint-Nazaire) dans le réseau régulier,
        // comme sur la carte.
        if (!urban.some((l) => l.short === '13')) {
          const l13 =
            lines.find((l) => l.short === '13' && /pornichet/i.test(l.long)) ??
            lines.find((l) => l.short === '13');
          if (l13) {
            sco = sco.filter((l) => l.short !== '13');
            const i = urban.findIndex((l) => l.short === '9');
            urban.splice(i >= 0 ? i + 1 : urban.length, 0, l13);
          }
        }
        this.urban = urban;
        this.sco = sco;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  /** Le nom est déjà formaté par GtfsService ; on n'ajuste que le séparateur. */
  prettyName(n: string): string {
    return (n || '').replace(/ - /g, ' → ');
  }
}
