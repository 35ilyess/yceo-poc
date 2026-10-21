import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { accessibility, closeCircle, locationOutline, navigate, searchOutline, timeOutline } from 'ionicons/icons';
import { Subject, Subscription, debounceTime, forkJoin, switchMap } from 'rxjs';
import { GtfsLine } from '../../core/gtfs.service';
import { JourneyStore } from '../../core/journey-store.service';
import { PlacePoint } from '../../core/models';
import { PlacesService, StopHit, norm } from '../../core/places.service';
import { AccessibilityService } from '../../core/accessibility.service';
import { RecentService } from '../../core/recent.service';
import { LineBadgeComponent } from '../../shared/line-badge.component';

/** Recherche unifiee : lignes, arrets et adresses dans un seul champ. */
@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonContent,
    IonIcon,
    IonSpinner,
    LineBadgeComponent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/home" text=""></ion-back-button></ion-buttons>
        <div class="search">
          <ion-icon name="search-outline"></ion-icon>
          <input
            id="unified-q"
            placeholder="Ligne, arrêt ou adresse"
            [(ngModel)]="q"
            (ngModelChange)="q$.next($event)"
            aria-label="Rechercher une ligne, un arrêt ou une adresse"
            enterkeyhint="search"
          />
          <ion-icon name="close-circle" class="clear" *ngIf="q" (click)="q = ''; q$.next('')"></ion-icon>
        </div>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="body">
        <!-- Récents (champ vide) -->
        <ng-container *ngIf="!q && recent.length">
          <div class="section-title">
            <span>Récents</span>
            <a (click)="clearRecent()">Effacer</a>
          </div>
          <div class="card list">
            <button class="row" *ngFor="let p of recent" (click)="goTo(p)">
              <ion-icon name="time-outline" class="ric"></ion-icon>
              <span class="rtxt"><b>{{ p.name }}</b><small>{{ p.city || (p.kind === 'stop' ? 'Arrêt' : 'Adresse') }}</small></span>
              <ion-icon name="navigate" class="go-ic"></ion-icon>
            </button>
          </div>
        </ng-container>

        <div class="hint" *ngIf="!q && !recent.length">
          Tapez un numéro de ligne (« H1 », « 4 »), un nom d’arrêt (« Gare ») ou une adresse
          (« 12 rue de la Paix »).
        </div>

        <ng-container *ngIf="lines.length">
          <div class="section-title"><span>Lignes</span></div>
          <div class="card list">
            <a class="row" *ngFor="let l of lines" [routerLink]="['/lines', l.id]">
              <app-line-badge [label]="l.short" [color]="l.color" [size]="30"></app-line-badge>
              <span class="rtxt"><b>{{ l.long }}</b></span>
            </a>
          </div>
        </ng-container>

        <ng-container *ngIf="stops.length">
          <div class="section-title"><span>Arrêts</span></div>
          <div class="card list">
            <div class="row" *ngFor="let s of stops">
              <a class="main" [routerLink]="['/stops', s.id]">
                <span class="ric">🚏</span>
                <span class="rtxt"
                  ><b
                    >{{ s.name
                    }}<ion-icon
                      *ngIf="accessible.has(norm(s.name))"
                      name="accessibility"
                      class="a11y"
                      aria-label="Arrêt accessible"
                    ></ion-icon></b
                  ><small>{{ s.city ? s.city + ' · ' : '' }}{{ s.lines.slice(0, 6).join(' · ') }}</small></span
                >
              </a>
              <button class="go" (click)="goTo(places.stopToPlace(s))" [attr.aria-label]="'Itinéraire vers ' + s.name">
                <ion-icon name="navigate"></ion-icon>
              </button>
            </div>
          </div>
        </ng-container>

        <ng-container *ngIf="addresses.length">
          <div class="section-title"><span>Adresses</span></div>
          <div class="card list">
            <button class="row" *ngFor="let a of addresses" (click)="goTo(a)">
              <ion-icon name="location-outline" class="ric"></ion-icon>
              <span class="rtxt"><b>{{ a.name }}</b><small>{{ a.city }}</small></span>
              <ion-icon name="navigate" class="go-ic"></ion-icon>
            </button>
          </div>
        </ng-container>

        <div class="hint" *ngIf="busy"><ion-spinner name="dots"></ion-spinner></div>
        <div class="hint" *ngIf="q.length >= 2 && !busy && !lines.length && !stops.length && !addresses.length">
          Aucun résultat pour « {{ q }} ».
        </div>
        <p class="src muted" *ngIf="addresses.length">Adresses : Géoplateforme IGN (service public)</p>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .search {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--yceo-tile);
        border-radius: 12px;
        padding: 0 12px;
        margin-right: 12px;
      }
      .search ion-icon {
        color: var(--yceo-primary);
        font-size: 1.15rem;
      }
      .search input {
        flex: 1;
        border: none;
        outline: none;
        background: transparent;
        font: inherit;
        font-size: 1rem;
        padding: 10px 0;
        color: var(--yceo-ink);
      }
      .search .clear {
        color: var(--yceo-muted);
      }
      .body {
        padding: 4px 16px 16px;
      }
      .hint {
        color: var(--yceo-muted);
        text-align: center;
        margin: 24px 12px;
        font-size: 0.9rem;
      }
      .list {
        overflow: hidden;
      }
      .row {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        border: none;
        border-bottom: 1px solid var(--yceo-border);
        background: none;
        font: inherit;
        color: var(--yceo-ink);
        text-align: left;
        text-decoration: none;
      }
      .row:last-child {
        border-bottom: none;
      }
      .main {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 12px;
        text-decoration: none;
        color: inherit;
      }
      .ric {
        flex: none;
        width: 24px;
        text-align: center;
        font-size: 1.2rem;
        color: var(--yceo-muted);
      }
      .rtxt {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .rtxt b {
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .rtxt small {
        color: var(--yceo-muted);
        font-size: 0.78rem;
      }
      .a11y {
        font-size: 0.95rem;
        color: var(--yceo-primary);
        vertical-align: -2px;
        margin-left: 5px;
      }
      .go {
        flex: none;
        border: none;
        background: var(--yceo-tile);
        color: var(--yceo-primary-dark);
        border-radius: 10px;
        width: 38px;
        height: 38px;
        display: grid;
        place-items: center;
        font-size: 1.1rem;
      }
      .go-ic {
        color: var(--yceo-primary-dark);
        flex: none;
      }
      .src {
        font-size: 0.74rem;
        text-align: center;
        margin-top: 14px;
      }
    `,
  ],
})
export class SearchPage implements OnDestroy {
  places = inject(PlacesService);
  private a11y = inject(AccessibilityService);
  private recents = inject(RecentService);
  private store = inject(JourneyStore);
  norm = norm;
  private router = inject(Router);

  q = '';
  q$ = new Subject<string>();
  lines: GtfsLine[] = [];
  stops: StopHit[] = [];
  addresses: PlacePoint[] = [];
  busy = false;
  recent: PlacePoint[] = [];
  accessible = new Set<string>();
  private sub: Subscription;

  constructor() {
    addIcons({ accessibility, closeCircle, locationOutline, navigate, searchOutline, timeOutline });
    this.recents.recent$.subscribe((r) => (this.recent = r));
    this.a11y.accessibleNames().subscribe((set) => (this.accessible = set));
    this.sub = this.q$
      .pipe(
        debounceTime(220),
        switchMap((q) => {
          this.busy = q.trim().length >= 3;
          return forkJoin({
            l: this.places.searchLines(q),
            s: this.places.searchStops(q),
            a: this.places.searchAddresses(q),
          });
        }),
      )
      .subscribe(({ l, s, a }) => {
        this.lines = l;
        this.stops = s;
        this.addresses = a;
        this.busy = false;
      });
  }

  ionViewDidEnter(): void {
    (document.getElementById('unified-q') as HTMLInputElement | null)?.focus();
  }

  /** Itinéraire depuis ma position vers ce lieu. */
  goTo(p: PlacePoint): void {
    this.recents.add(p);
    this.store.pendingFrom = null;
    this.store.pendingTo = p;
    this.router.navigate(['/journey']);
  }

  clearRecent(): void {
    this.recents.clear();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
