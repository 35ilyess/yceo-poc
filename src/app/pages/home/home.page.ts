import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  navigateOutline,
  searchOutline,
  locateOutline,
  mapOutline,
  gitBranchOutline,
  timeOutline,
  ticketOutline,
  bicycleOutline,
  informationCircleOutline,
  settingsOutline,
  warningOutline,
  chevronForward,
  star,
  checkmarkCircleOutline,
  carOutline,
} from 'ionicons/icons';
import { GtfsLine, GtfsService } from '../../core/gtfs.service';
import { FavLine, FavStop, FavTrip, FavoritesService } from '../../core/favorites.service';
import { JourneyStore } from '../../core/journey-store.service';
import { TraficAlert, TraficService } from '../../core/trafic.service';
import { LineBadgeComponent } from '../../shared/line-badge.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, IonContent, IonIcon, LineBadgeComponent],
  template: `
    <ion-content>
      <!-- HERO -->
      <div class="hero">
        <div class="top">
          <div>
            <div class="eyebrow">Saint-Nazaire Agglomération</div>
            <h1>Bonjour 👋</h1>
          </div>
          <ion-icon
            name="settings-outline"
            class="gear"
            role="button"
            tabindex="0"
            aria-label="Réglages"
            routerLink="/settings"
          ></ion-icon>
        </div>
        <div class="search-cta" routerLink="/search" role="button" tabindex="0" aria-label="Rechercher une ligne, un arrêt ou une adresse">
          <ion-icon name="search-outline"></ion-icon>
          Où allez-vous ?
        </div>
      </div>

      <div class="body">
        <!-- Accès rapides -->
        <div class="quick">
          <a class="q" routerLink="/journey">
            <span class="qic"><ion-icon name="navigate-outline"></ion-icon></span>
            <span>Itinéraire</span>
          </a>
          <a class="q" routerLink="/nearby">
            <span class="qic"><ion-icon name="locate-outline"></ion-icon></span>
            <span>Autour de moi</span>
          </a>
          <a class="q" routerLink="/departures">
            <span class="qic"><ion-icon name="time-outline"></ion-icon></span>
            <span>Prochains passages</span>
          </a>
        </div>

        <!-- Alerte : perturbation sur mes lignes favorites -->
        <div class="alert-banner alert-fav alert-link" *ngIf="favLinesDisrupted.length" routerLink="/trafic">
          <ion-icon name="warning-outline"></ion-icon>
          <div class="ab-txt">
            <div class="ab-count">Perturbation sur vos lignes favorites</div>
            <div class="ab-title">
              Lignes {{ favLinesDisruptedShorts }} concernées
            </div>
          </div>
          <span class="ab-more">Voir ›</span>
        </div>

        <!-- Info trafic (lié au site officiel) -->
        <div class="alert-banner alert-link" *ngIf="alerts.length; else fluid" routerLink="/trafic">
          <ion-icon name="warning-outline"></ion-icon>
          <div class="ab-txt">
            <div class="ab-count">
              {{ alerts.length }} info{{ alerts.length > 1 ? 's' : '' }} trafic
            </div>
            <div class="ab-title">
              {{ affectedLines.length ? 'Lignes ' + affectedLines.join(', ') + ' concernées' : 'Voir le détail' }}
            </div>
          </div>
          <span class="ab-more">Voir plus ›</span>
        </div>
        <ng-template #fluid>
          <div class="alert-banner ok">
            <ion-icon name="checkmark-circle-outline"></ion-icon>
            <span>Trafic fluide sur l’ensemble du réseau Ycéo aujourd’hui.</span>
          </div>
        </ng-template>

        <!-- Mes favoris (au-dessus des lignes) -->
        <ng-container *ngIf="favorites.length || favLines.length || favTrips.length">
          <div class="section-title"><span>Mes favoris</span></div>

          <div class="hscroll" *ngIf="favLines.length">
            <a class="line-pill card" *ngFor="let l of favLines" [routerLink]="['/lines', l.id]">
              <app-line-badge [label]="l.short" [color]="l.color" [size]="38"></app-line-badge>
            </a>
          </div>

          <div class="card fav-list trips" *ngIf="favTrips.length">
            <a class="fav-row" *ngFor="let t of favTrips; let last = last" [class.last]="last" (click)="openTrip(t)">
              <ion-icon name="navigate-outline" class="fstar trip"></ion-icon>
              <div class="fav-txt">
                <div class="fav-name">{{ t.from.name }} → {{ t.to.name }}</div>
                <div class="fav-city muted">Trajet favori</div>
              </div>
              <ion-icon name="chevron-forward" class="fchev"></ion-icon>
            </a>
          </div>

          <div class="card fav-list" *ngIf="favorites.length">
            <a
              class="fav-row"
              *ngFor="let f of favorites; let last = last"
              [class.last]="last"
              [routerLink]="['/stops', f.id]"
            >
              <ion-icon name="star" class="fstar"></ion-icon>
              <div class="fav-txt">
                <div class="fav-name">{{ f.name }}</div>
                <div class="fav-city muted" *ngIf="f.city">{{ f.city }}</div>
              </div>
              <ion-icon name="chevron-forward" class="fchev"></ion-icon>
            </a>
          </div>
        </ng-container>

        <!-- Lignes -->
        <div class="section-title">
          <span>Les lignes</span>
          <a routerLink="/lines">Tout voir</a>
        </div>
        <div class="hscroll">
          <a class="line-pill card" *ngFor="let l of topLines" [routerLink]="['/lines', l.id]">
            <app-line-badge [label]="l.short" [color]="l.color" [size]="38"></app-line-badge>
          </a>
          <a class="line-pill card more" *ngIf="urbanCount" routerLink="/lines">
            Tout
          </a>
        </div>

        <!-- Microservices -->
        <div class="section-title"><span>Services</span></div>
        <div class="service-grid">
          <a class="service" routerLink="/lines">
            <span class="ic"><ion-icon name="git-branch-outline"></ion-icon></span>
            <span class="lbl">Lignes & horaires</span>
            <span class="sub">{{ urbanCount || '—' }} lignes régulières</span>
          </a>
          <a class="service" routerLink="/map">
            <span class="ic"><ion-icon name="map-outline"></ion-icon></span>
            <span class="lbl">Plan du réseau</span>
            <span class="sub">Arrêts & tracés</span>
          </a>
          <a class="service" routerLink="/tarifs">
            <span class="ic"><ion-icon name="ticket-outline"></ion-icon></span>
            <span class="lbl">Titres & tarifs</span>
            <span class="sub">Prix & où acheter</span>
          </a>
          <a class="service" href="https://www.yceo-mobilite.fr/velyceo/" target="_blank" rel="noopener">
            <span class="ic"><ion-icon name="bicycle-outline"></ion-icon></span>
            <span class="lbl">VéloYcéo</span>
            <span class="sub">Location de vélos</span>
          </a>
          <a class="service" routerLink="/services">
            <span class="ic"><ion-icon name="car-outline"></ion-icon></span>
            <span class="lbl">Parkings relais</span>
            <span class="sub">& points de vente</span>
          </a>
          <a class="service" href="https://www.yceo-mobilite.fr/" target="_blank" rel="noopener">
            <span class="ic"><ion-icon name="information-circle-outline"></ion-icon></span>
            <span class="lbl">Infos & contact</span>
            <span class="sub">yceo-mobilite.fr</span>
          </a>
        </div>

        <p class="foot muted">
          POC non officiel · données ouvertes Saint-Nazaire Agglo, IGN & OpenStreetMap<br />
          <a routerLink="/legal">Mentions légales & données</a>
        </p>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .hero .top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      .hero .gear {
        font-size: 1.5rem;
        color: #fff;
        opacity: 0.9;
        padding: 4px;
      }
      .body {
        padding: 16px;
      }
      .quick {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin: -40px 0 16px;
      }
      .q {
        background: var(--yceo-card);
        border: 1px solid var(--yceo-border);
        border-radius: 16px;
        padding: 14px 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        text-decoration: none;
        color: var(--yceo-ink);
        font-size: 0.82rem;
        font-weight: 600;
        box-shadow: var(--yceo-shadow);
        text-align: center;
      }
      .qic {
        width: 42px;
        height: 42px;
        border-radius: 12px;
        background: var(--yceo-tile);
        color: var(--yceo-primary-dark);
        display: grid;
        place-items: center;
      }
      .qic ion-icon {
        font-size: 1.4rem;
      }
      .line-pill {
        display: grid;
        place-items: center;
        padding: 10px;
        border-radius: 14px;
        text-decoration: none;
        flex: none;
      }
      .line-pill.more {
        font-weight: 700;
        color: var(--yceo-primary-dark);
        min-width: 58px;
        font-family: 'Space Grotesk', sans-serif;
      }
      .service {
        text-decoration: none;
        color: var(--yceo-ink);
      }
      .foot {
        text-align: center;
        font-size: 0.78rem;
        margin: 26px 0 8px;
      }
      .fav-list {
        overflow: hidden;
      }
      .fav-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--yceo-border);
        text-decoration: none;
        color: var(--yceo-ink);
      }
      .fav-row.last {
        border-bottom: none;
      }
      .fav-list.trips {
        margin-bottom: 10px;
      }
      .fav-row {
        cursor: pointer;
      }
      .fav-row .fstar.trip {
        color: var(--yceo-primary);
      }
      .fav-row .fstar {
        color: #f5b301;
        font-size: 1.25rem;
        flex: none;
      }
      .fav-txt {
        flex: 1;
        min-width: 0;
      }
      .fav-name {
        font-weight: 600;
        font-size: 0.95rem;
      }
      .fav-city {
        font-size: 0.78rem;
      }
      .fchev {
        color: var(--yceo-muted);
        flex: none;
      }
      .alert-link {
        text-decoration: none;
        cursor: pointer;
      }
      .alert-link .ab-txt {
        flex: 1;
        min-width: 0;
      }
      .alert-link .ab-count {
        font-weight: 700;
        font-size: 0.82rem;
      }
      .alert-link .ab-title {
        font-size: 0.86rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        opacity: 0.9;
      }
      .alert-link .ab-more {
        flex: none;
        font-weight: 700;
        font-size: 0.82rem;
        white-space: nowrap;
      }
      .alert-banner.ok {
        background: #eafaf0;
        border-color: #bfe8cf;
        color: #1b6b3a;
      }
      .alert-banner.ok ion-icon {
        color: var(--yceo-green);
      }
      .alert-banner.alert-fav {
        background: #fdecec;
        border-color: #f3b9b9;
        color: #9a2222;
        margin-bottom: 6px;
      }
      .alert-banner.alert-fav ion-icon {
        color: #d23b3b;
      }
    `,
  ],
})
export class HomePage {
  private gtfs = inject(GtfsService);
  private favs = inject(FavoritesService);
  private traficSvc = inject(TraficService);
  private store = inject(JourneyStore);
  private router = inject(Router);
  favTrips: FavTrip[] = [];
  topLines: GtfsLine[] = [];
  urbanCount = 0;
  favorites: FavStop[] = [];
  favLines: FavLine[] = [];
  alerts: TraficAlert[] = [];
  affectedLines: string[] = [];

  constructor() {
    addIcons({
      navigateOutline,
      searchOutline,
      locateOutline,
      mapOutline,
      gitBranchOutline,
      timeOutline,
      ticketOutline,
      bicycleOutline,
      informationCircleOutline,
      settingsOutline,
      warningOutline,
      chevronForward,
      star,
      checkmarkCircleOutline,
      carOutline,
    });
    this.favs.favorites$.subscribe((f) => (this.favorites = f));
    this.favs.favLines$.subscribe((l) => (this.favLines = l));
    this.favs.favTrips$.subscribe((t) => (this.favTrips = t));
    this.gtfs.getLines().subscribe((lines) => {
      const seen = new Set<string>();
      const urban = lines.filter((l) => {
        if (!l.urban) return false;
        const k = l.short + l.color;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      this.urbanCount = urban.length;
      this.topLines = urban.slice(0, 8);
    });
    this.traficSvc.get().subscribe((d) => {
      this.alerts = d.alerts;
      this.affectedLines = d.affectedLines;
    });
  }

  /** Lignes favorites actuellement perturbées (intersection favoris ∩ trafic). */
  get favLinesDisrupted(): FavLine[] {
    return this.favLines.filter((l) => this.affectedLines.includes(l.short));
  }

  get favLinesDisruptedShorts(): string {
    return this.favLinesDisrupted.map((l) => l.short).join(', ');
  }

  /** Relance un trajet favori dans l'itinéraire. */
  openTrip(t: FavTrip): void {
    this.store.pendingFrom = t.from;
    this.store.pendingTo = t.to;
    this.router.navigate(['/journey']);
  }

}
