import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ActionSheetController,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowForward,
  chevronDown,
  chevronUp,
  closeCircle,
  locate,
  locationOutline,
  mapOutline,
  navigateOutline,
  openOutline,
  radioButtonOn,
  shareSocialOutline,
  timeOutline,
  star,
  starOutline,
  swapVertical,
  walk,
} from 'ionicons/icons';
import { Subject, Subscription, debounceTime, forkJoin, switchMap } from 'rxjs';
import { FavTrip, FavoritesService } from '../../core/favorites.service';
import { JourneyStore, mapsApps } from '../../core/journey-store.service';
import { RecentService } from '../../core/recent.service';
import { Journey, JourneySection, PlacePoint } from '../../core/models';
import { PlacesService, StopHit } from '../../core/places.service';
import { RouterService } from '../../core/router.service';
import { LineBadgeComponent } from '../../shared/line-badge.component';

type Field = 'from' | 'to';

@Component({
  selector: 'app-journey',
  standalone: true,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonSpinner, LineBadgeComponent],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar><ion-title>Itinéraire</ion-title></ion-toolbar>
    </ion-header>
    <ion-content>
      <!-- Formulaire départ / arrivée -->
      <div class="form card">
        <div class="rows">
          <button class="field" (click)="edit('from')" [class.on]="editing === 'from'" aria-label="Choisir le départ">
            <ion-icon name="radio-button-on" class="pin from"></ion-icon>
            <span [class.ph]="!from">{{ from ? from.name : 'Départ' }}</span>
          </button>
          <div class="divider"></div>
          <button class="field" (click)="edit('to')" [class.on]="editing === 'to'" aria-label="Choisir l'arrivée">
            <ion-icon name="location-outline" class="pin to"></ion-icon>
            <span [class.ph]="!to">{{ to ? to.name : 'Arrivée' }}</span>
          </button>
        </div>
        <div class="side">
          <button class="icon-btn" (click)="swap()" aria-label="Inverser départ et arrivée">
            <ion-icon name="swap-vertical"></ion-icon>
          </button>
          <button
            class="icon-btn"
            *ngIf="from && to"
            (click)="toggleFav()"
            [attr.aria-label]="isFav ? 'Retirer des trajets favoris' : 'Ajouter aux trajets favoris'"
          >
            <ion-icon [name]="isFav ? 'star' : 'star-outline'" [class.fav]="isFav"></ion-icon>
          </button>
        </div>
      </div>

      <div class="when" *ngIf="!editing">
        <label>
          Départ
          <input type="datetime-local" [(ngModel)]="whenStr" (change)="go()" aria-label="Date et heure de départ" />
        </label>
        <button class="now" (click)="setNow()">Maintenant</button>
      </div>

      <!-- Saisie d'un lieu -->
      <div class="picker" *ngIf="editing">
        <div class="search card">
          <input
            #q
            autofocus
            [placeholder]="editing === 'from' ? 'Arrêt ou adresse de départ' : 'Arrêt ou adresse d’arrivée'"
            [(ngModel)]="query"
            (ngModelChange)="onQuery($event)"
            aria-label="Rechercher un arrêt ou une adresse"
          />
          <ion-icon name="close-circle" class="clear" *ngIf="query" (click)="query = ''; onQuery('')"></ion-icon>
        </div>
        <div class="card list">
          <button class="row" (click)="useHere()">
            <ion-icon name="locate" class="ric here"></ion-icon>
            <span class="rtxt"><b>Ma position</b><small *ngIf="locating">Localisation…</small></span>
          </button>
          <button class="row" *ngFor="let s of stopHits" (click)="pickStop(s)">
            <span class="ric bus">🚏</span>
            <span class="rtxt"
              ><b>{{ s.name }}</b><small>{{ s.city ? s.city + ' · ' : '' }}{{ s.lines.slice(0, 6).join(' · ') }}</small></span
            >
          </button>
          <button class="row" *ngFor="let a of addrHits" (click)="pick(a)">
            <ion-icon name="location-outline" class="ric"></ion-icon>
            <span class="rtxt"><b>{{ a.name }}</b><small>{{ a.city }}</small></span>
          </button>
          <div class="hint" *ngIf="query.length >= 2 && !stopHits.length && !addrHits.length && !searching">
            Aucun résultat.
          </div>
          <div class="hint" *ngIf="geoError">{{ geoError }}</div>
        </div>
      </div>

      <div class="body" *ngIf="!editing">
        <!-- Trajets favoris -->
        <ng-container *ngIf="!journeys.length && !loading && favTrips.length">
          <div class="section-title"><span>Trajets favoris</span></div>
          <div class="card list">
            <button class="row" *ngFor="let t of favTrips" (click)="openFav(t)">
              <ion-icon name="star" class="ric fav"></ion-icon>
              <span class="rtxt"><b>{{ t.from.name }}</b><small>→ {{ t.to.name }}</small></span>
            </button>
          </div>
        </ng-container>

        <!-- Récents -->
        <ng-container *ngIf="!journeys.length && !loading && recent.length">
          <div class="section-title"><span>Récents</span></div>
          <div class="card list">
            <button class="row" *ngFor="let p of recent" (click)="useRecent(p)">
              <ion-icon name="time-outline" class="ric"></ion-icon>
              <span class="rtxt"><b>{{ p.name }}</b><small>{{ p.city || (p.kind === 'stop' ? 'Arrêt' : 'Adresse') }}</small></span>
            </button>
          </div>
        </ng-container>

        <div class="state" *ngIf="loading"><ion-spinner name="dots"></ion-spinner> Calcul de l’itinéraire…</div>
        <div class="state" *ngIf="searched && !loading && !journeys.length">
          Aucun trajet trouvé à cet horaire. Essayez un autre départ ou une autre heure.
        </div>

        <!-- Résultats -->
        <div class="card jcard" *ngFor="let j of journeys; let i = index">
          <button class="jhead" (click)="open = open === i ? -1 : i" [attr.aria-expanded]="open === i">
            <div class="times">
              <b>{{ j.departure | date: 'HH:mm' }}</b> <ion-icon name="arrow-forward"></ion-icon>
              <b>{{ j.arrival | date: 'HH:mm' }}</b>
            </div>
            <div class="dur">{{ fmtDur(j.durationMin) }}</div>
          </button>
          <div class="strip">
            <ng-container *ngFor="let s of j.sections; let last = last">
              <span class="walk" *ngIf="s.mode === 'walking'"
                ><ion-icon name="walk"></ion-icon>{{ s.durationMin }}′</span
              >
              <app-line-badge *ngIf="s.mode === 'bus'" [label]="s.label" [color]="s.lineColor || '00a7b5'" [size]="26"></app-line-badge>
              <span class="chev" *ngIf="!last">›</span>
            </ng-container>
            <span class="meta">{{ j.nbTransfers ? j.nbTransfers + ' corresp.' : busCount(j) ? 'Direct' : 'À pied' }}</span>
          </div>

          <!-- Détail -->
          <div class="detail" *ngIf="open === i">
            <div class="step" *ngFor="let s of j.sections">
              <div class="t">{{ s.departure | date: 'HH:mm' }}</div>
              <div class="rail" [style.background]="s.mode === 'bus' ? '#' + (s.lineColor || '00a7b5') : 'transparent'" [class.dashed]="s.mode !== 'bus'"></div>
              <div class="sd">
                <ng-container *ngIf="s.mode === 'bus'; else walkTpl">
                  <div class="sl">
                    <app-line-badge [label]="s.label" [color]="s.lineColor || '00a7b5'" [size]="22"></app-line-badge>
                    <span>direction <b>{{ s.direction }}</b></span>
                  </div>
                  <div>Monter à <b>{{ s.from }}</b></div>
                  <div class="muted">{{ s.stops }} arrêt{{ s.stops! > 1 ? 's' : '' }} · {{ s.durationMin }} min</div>
                  <div>Descendre à <b>{{ s.to }}</b> <span class="muted">({{ s.arrival | date: 'HH:mm' }})</span></div>
                </ng-container>
                <ng-template #walkTpl>
                  <div><ion-icon name="walk"></ion-icon> Marcher {{ s.durationMin }} min</div>
                  <div class="muted">jusqu’à {{ s.to }}</div>
                </ng-template>
              </div>
            </div>
            <div class="step end">
              <div class="t">{{ j.arrival | date: 'HH:mm' }}</div>
              <div class="rail none"></div>
              <div class="sd"><b>Arrivée</b> · {{ j.to?.name }}</div>
            </div>
          </div>

          <div class="actions three">
            <button class="act" (click)="showOnMap(j)"><ion-icon name="map-outline"></ion-icon> Plan</button>
            <button class="act" (click)="share(j)"><ion-icon name="share-social-outline"></ion-icon> Partager</button>
            <button class="act" (click)="openExternal(j)"><ion-icon name="open-outline"></ion-icon> Ouvrir</button>
          </div>
        </div>

        <p class="foot muted" *ngIf="journeys.length">
          Horaires théoriques (GTFS Ycéo), calculés sur le téléphone, sans connexion à un serveur.
        </p>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .form {
        margin: 12px 16px 0;
        display: flex;
        align-items: center;
        padding: 6px 6px 6px 4px;
      }
      .rows {
        flex: 1;
        min-width: 0;
      }
      .field {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 10px;
        background: none;
        border: none;
        padding: 12px 10px;
        font: inherit;
        font-size: 0.98rem;
        font-weight: 600;
        color: var(--yceo-ink);
        text-align: left;
        border-radius: 10px;
      }
      .field span {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .field.on {
        background: var(--yceo-tile);
      }
      .field .ph {
        color: var(--yceo-muted);
        font-weight: 500;
      }
      .pin {
        flex: none;
        font-size: 1.1rem;
      }
      .pin.from {
        color: var(--yceo-primary);
      }
      .pin.to {
        color: #d23b3b;
      }
      .divider {
        height: 1px;
        background: var(--yceo-border);
        margin-left: 38px;
      }
      .side {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .icon-btn {
        background: var(--yceo-tile);
        border: none;
        border-radius: 12px;
        width: 40px;
        height: 40px;
        display: grid;
        place-items: center;
        color: var(--yceo-primary-dark);
        font-size: 1.25rem;
      }
      .icon-btn .fav {
        color: #f5b301;
      }
      .when {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin: 10px 16px 0;
        font-size: 0.86rem;
        color: var(--yceo-muted);
        font-weight: 600;
      }
      .when input {
        margin-left: 6px;
        border: 1px solid var(--yceo-border);
        border-radius: 10px;
        padding: 6px 8px;
        font: inherit;
        color: var(--yceo-ink);
        background: var(--yceo-card, #fff);
      }
      .now {
        border: none;
        background: none;
        color: var(--yceo-primary-dark);
        font-weight: 700;
        font: inherit;
      }
      .picker {
        padding: 12px 16px;
      }
      .search {
        display: flex;
        align-items: center;
        padding: 4px 12px;
        margin-bottom: 10px;
      }
      .search input {
        flex: 1;
        border: none;
        outline: none;
        font: inherit;
        font-size: 1rem;
        padding: 10px 0;
        background: transparent;
        color: var(--yceo-ink);
      }
      .clear {
        color: var(--yceo-muted);
        font-size: 1.2rem;
      }
      .list {
        overflow: hidden;
      }
      .row {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border: none;
        border-bottom: 1px solid var(--yceo-border);
        background: none;
        font: inherit;
        color: var(--yceo-ink);
        text-align: left;
      }
      .row:last-child {
        border-bottom: none;
      }
      .ric {
        flex: none;
        width: 24px;
        text-align: center;
        font-size: 1.2rem;
        color: var(--yceo-muted);
      }
      .ric.here {
        color: var(--yceo-primary);
      }
      .ric.fav {
        color: #f5b301;
      }
      .rtxt {
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
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .hint {
        padding: 14px;
        color: var(--yceo-muted);
        font-size: 0.88rem;
      }
      .body {
        padding: 6px 16px 16px;
      }
      .state {
        text-align: center;
        color: var(--yceo-muted);
        margin: 28px 8px;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 8px;
      }
      .jcard {
        margin-top: 12px;
        overflow: hidden;
      }
      .jhead {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: none;
        background: none;
        padding: 14px 14px 6px;
        font: inherit;
        color: var(--yceo-ink);
      }
      .times {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 1.15rem;
        font-family: 'Space Grotesk', sans-serif;
      }
      .times ion-icon {
        color: var(--yceo-muted);
        font-size: 0.95rem;
      }
      .dur {
        font-weight: 800;
        font-size: 1.05rem;
        color: var(--yceo-primary-dark);
        font-family: 'Space Grotesk', sans-serif;
      }
      .strip {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        padding: 4px 14px 12px;
      }
      .walk {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        font-size: 0.85rem;
        color: var(--yceo-muted);
        font-weight: 600;
      }
      .chev {
        color: var(--yceo-muted);
      }
      .meta {
        margin-left: auto;
        font-size: 0.8rem;
        color: var(--yceo-muted);
        font-weight: 600;
      }
      .detail {
        border-top: 1px solid var(--yceo-border);
        padding: 12px 14px 4px;
      }
      .step {
        display: grid;
        grid-template-columns: 44px 6px 1fr;
        gap: 10px;
        min-height: 44px;
        font-size: 0.88rem;
      }
      .step .t {
        font-weight: 700;
        font-family: 'Space Grotesk', sans-serif;
      }
      .rail {
        border-radius: 3px;
        margin-bottom: 4px;
      }
      .rail.dashed {
        border-left: 3px dotted var(--yceo-muted);
        width: 0;
        margin-left: 1px;
      }
      .sd {
        padding-bottom: 12px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .sl {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 2px;
      }
      .muted {
        color: var(--yceo-muted);
      }
      .actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        border-top: 1px solid var(--yceo-border);
      }
      .actions.three {
        grid-template-columns: 1fr 1fr 1fr;
      }
      .act ion-icon {
        font-size: 1.05rem;
      }
      .act {
        border: none;
        background: none;
        padding: 12px 6px;
        font: inherit;
        font-size: 0.86rem;
        font-weight: 700;
        color: var(--yceo-primary-dark);
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 6px;
      }
      .act + .act {
        border-left: 1px solid var(--yceo-border);
      }
      .foot {
        text-align: center;
        font-size: 0.76rem;
        margin: 18px 8px 4px;
      }
    `,
  ],
})
export class JourneyPage implements OnInit, OnDestroy {
  private routerSvc = inject(RouterService);
  private places = inject(PlacesService);
  private favs = inject(FavoritesService);
  private store = inject(JourneyStore);
  private router = inject(Router);
  private sheet = inject(ActionSheetController);
  private toast = inject(ToastController);
  private recents = inject(RecentService);

  from?: PlacePoint;
  to?: PlacePoint;
  editing: Field | null = null;
  query = '';
  stopHits: StopHit[] = [];
  addrHits: PlacePoint[] = [];
  searching = false;
  locating = false;
  geoError = '';
  whenStr = localIso(new Date());
  journeys: Journey[] = [];
  loading = false;
  searched = false;
  open = -1;
  favTrips: FavTrip[] = [];
  recent: PlacePoint[] = [];

  private q$ = new Subject<string>();
  private subs = new Subscription();

  constructor() {
    addIcons({
      arrowForward,
      chevronDown,
      chevronUp,
      closeCircle,
      locate,
      locationOutline,
      mapOutline,
      navigateOutline,
      openOutline,
      radioButtonOn,
      shareSocialOutline,
      star,
      starOutline,
      swapVertical,
      timeOutline,
      walk,
    });
  }

  ngOnInit(): void {
    this.subs.add(this.favs.favTrips$.subscribe((t) => (this.favTrips = t)));
    this.subs.add(this.recents.recent$.subscribe((r) => (this.recent = r)));
    this.subs.add(
      this.q$
        .pipe(
          debounceTime(250),
          switchMap((q) => {
            this.searching = true;
            return forkJoin({ s: this.places.searchStops(q), a: this.places.searchAddresses(q) });
          }),
        )
        .subscribe(({ s, a }) => {
          this.stopHits = s;
          this.addrHits = a;
          this.searching = false;
        }),
    );
    this.routerSvc.load().subscribe(); // precharge le graphe pendant la saisie
  }

  /** Depart/arrivee transmis par une autre page (recherche, favoris, services). */
  ionViewWillEnter(): void {
    if (!this.store.pendingTo && !this.store.pendingFrom) return;
    this.from = this.store.pendingFrom ?? undefined;
    this.to = this.store.pendingTo ?? undefined;
    this.store.pendingFrom = this.store.pendingTo = null;
    this.editing = null;
    this.journeys = [];
    this.searched = false;
    this.whenStr = localIso(new Date());
    if (!this.from || this.from.kind === 'here') this.useHere(true);
    else if (!this.to) this.edit('to');
    else this.go();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  get isFav(): boolean {
    return !!this.from && !!this.to && this.favs.isFavTrip(this.from, this.to);
  }

  edit(f: Field): void {
    this.editing = this.editing === f ? null : f;
    this.query = '';
    this.stopHits = [];
    this.addrHits = [];
    this.geoError = '';
    setTimeout(() => (document.querySelector('.picker input') as HTMLInputElement | null)?.focus(), 50);
  }

  onQuery(q: string): void {
    this.q$.next(q);
  }

  pickStop(s: StopHit): void {
    this.pick(this.places.stopToPlace(s));
  }

  pick(p: PlacePoint): void {
    if (this.editing === 'from') this.from = p;
    else this.to = p;
    const next: Field | null = !this.from ? 'from' : !this.to ? 'to' : null;
    this.editing = null;
    if (next) this.edit(next);
    else this.go();
  }

  async useHere(auto = false): Promise<void> {
    this.locating = true;
    this.geoError = '';
    try {
      const p = await this.places.locate();
      if (auto || this.editing !== 'to') {
        this.editing = this.editing ?? 'from';
      }
      this.pick(p);
    } catch {
      this.geoError = 'Position indisponible : autorisez la localisation ou choisissez un arrêt.';
      if (auto) this.edit('from');
    } finally {
      this.locating = false;
    }
  }

  swap(): void {
    [this.from, this.to] = [this.to, this.from];
    if (this.from && this.to) this.go();
  }

  setNow(): void {
    this.whenStr = localIso(new Date());
    this.go();
  }

  toggleFav(): void {
    if (this.from && this.to) this.favs.toggleTrip(this.from, this.to);
  }

  openFav(t: FavTrip): void {
    this.from = t.from;
    this.whenStr = localIso(new Date());
    this.to = t.to;
    this.editing = null;
    if (t.from.kind === 'here') {
      this.places
        .locate()
        .then((p) => {
          this.from = p;
          this.go();
        })
        .catch(() => this.go());
      return;
    }
    this.go();
  }

  useRecent(p: PlacePoint): void {
    if (!this.from) this.from = p;
    else this.to = p;
    if (this.from && this.to) this.go();
    else this.edit('to');
  }

  go(): void {
    if (!this.from || !this.to) return;
    this.recents.add(this.from);
    this.recents.add(this.to);
    this.loading = true;
    this.searched = true;
    this.journeys = [];
    this.open = -1;
    const when = this.whenStr ? new Date(this.whenStr) : new Date();
    this.routerSvc.plan(this.from, this.to, when).subscribe({
      next: (j) => {
        this.journeys = j;
        this.open = j.length ? 0 : -1;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  busCount(j: Journey): number {
    return j.sections.filter((s: JourneySection) => s.mode === 'bus').length;
  }

  fmtDur(min: number): string {
    return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
  }

  /** Résumé texte du trajet pour le partage. */
  private summary(j: Journey): string {
    const hm = (d?: Date) => (d ? d.toTimeString().slice(0, 5) : '');
    const steps = j.sections
      .map((s) => (s.mode === 'bus' ? `🚌 ${s.label} (${s.from} → ${s.to})` : `🚶 ${s.durationMin} min`))
      .join('\n');
    return (
      `Trajet Ycéo — ${j.from?.name} → ${j.to?.name}\n` +
      `Départ ${hm(j.departure)}, arrivée ${hm(j.arrival)} (${this.fmtDur(j.durationMin)})\n${steps}` +
      (j.from && j.to
        ? `\n\nSur une carte : ${mapsApps(j.from, j.to).find((a) => a.id === 'google')?.url ?? ''}`
        : '')
    );
  }

  async share(j: Journey): Promise<void> {
    const text = this.summary(j);
    try {
      // Plugin Capacitor natif sur mobile (feuille de partage iOS/Android).
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title: 'Trajet Ycéo', text, dialogTitle: 'Partager l’itinéraire' });
        return;
      }
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      if (nav.share) {
        await nav.share({ title: 'Trajet Ycéo', text });
        return;
      }
      await navigator.clipboard.writeText(text);
      (await this.toast.create({ message: 'Itinéraire copié', duration: 1600 })).present();
    } catch {
      /* partage annulé par l'utilisateur : rien à faire */
    }
  }

  showOnMap(j: Journey): void {
    this.store.shown = j;
    this.router.navigate(['/map'], { queryParams: { journey: 1 } });
  }

  async openExternal(j: Journey): Promise<void> {
    if (!j.from || !j.to) return;
    const apps = mapsApps(j.from, j.to);
    const s = await this.sheet.create({
      header: 'Voir le trajet dans…',
      buttons: [
        { text: 'Plan Ycéo (dans l’app)', handler: () => this.showOnMap(j) },
        ...apps.map((a) => ({ text: a.label, handler: () => void window.open(a.url, '_blank') })),
        { text: 'Annuler', role: 'cancel' },
      ],
    });
    await s.present();
  }
}

/** Date locale au format attendu par <input type="datetime-local">. */
function localIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
