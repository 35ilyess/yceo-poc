import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { carOutline, mapOutline, navigate, ticketOutline } from 'ionicons/icons';
import { JourneyStore } from '../../core/journey-store.service';
import { haversine } from '../../core/router.service';
import { PlacesService } from '../../core/places.service';
import { Parking, SalePoint, ServicesData, ServicesDataService } from '../../core/services-data.service';

type Tab = 'parkings' | 'sales';

/** Parkings proches d'un arrêt (usage parc relais) et points de vente Ycéo. */
@Component({
  selector: 'app-services',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonIcon,
    IonSegment,
    IonSegmentButton,
    IonLabel,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/home" text=""></ion-back-button></ion-buttons>
        <ion-title>Parkings & points de vente</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="tab" (ionChange)="tab = $any($event.detail.value)">
          <ion-segment-button value="parkings"><ion-label>Parkings relais</ion-label></ion-segment-button>
          <ion-segment-button value="sales"><ion-label>Points de vente</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="body" *ngIf="data">
        <ng-container *ngIf="tab === 'parkings'">
          <p class="intro muted">
            Garez-vous près d’un arrêt et finissez en bus. Ycéo ne publie pas de liste officielle
            de parcs relais : voici les grands parkings publics à moins de 400 m d’un arrêt.
          </p>
          <div class="card item" *ngFor="let p of parkings">
            <div class="ihead">
              <span class="ico park">P</span>
              <div class="itxt">
                <b>{{ p.name === 'Parking' ? 'Parking · ' + p.stop : p.name }}</b>
                <small>
                  {{ p.capacity }} places · {{ p.free ? 'gratuit' : 'payant ou non renseigné' }}
                </small>
                <small>🚏 {{ p.stop }} à {{ p.stopDist }} m<span *ngIf="dist(p) as d"> · à {{ d }} de vous</span></small>
              </div>
            </div>
            <div class="actions">
              <button (click)="onMap('parkings', p)"><ion-icon name="map-outline"></ion-icon> Plan</button>
              <button (click)="goTo(p.name === 'Parking' ? 'Parking ' + p.stop : p.name, p)">
                <ion-icon name="navigate"></ion-icon> Y aller
              </button>
            </div>
          </div>
          <p class="src muted">{{ data.sources.parkings }}</p>
        </ng-container>

        <ng-container *ngIf="tab === 'sales'">
          <p class="intro muted">Achetez vos tickets et recharges chez les dépositaires du réseau.</p>
          <div class="card item" *ngFor="let s of sales">
            <div class="ihead">
              <span class="ico sale"><ion-icon name="ticket-outline"></ion-icon></span>
              <div class="itxt">
                <b>{{ s.name }}</b>
                <small>{{ s.address }}, {{ s.city }}<span *ngIf="dist(s) as d"> · {{ d }}</span></small>
                <small class="prod">{{ s.products }}</small>
              </div>
            </div>
            <div class="actions">
              <button (click)="onMap('sales', s)"><ion-icon name="map-outline"></ion-icon> Plan</button>
              <button (click)="goTo(s.name, s)"><ion-icon name="navigate"></ion-icon> Y aller</button>
            </div>
          </div>
          <p class="src muted">{{ data.sources.sales }}</p>
        </ng-container>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .body {
        padding: 12px 16px 16px;
      }
      .intro {
        font-size: 0.86rem;
        margin: 0 2px 12px;
      }
      .item {
        margin-bottom: 10px;
        overflow: hidden;
      }
      .ihead {
        display: flex;
        gap: 12px;
        padding: 12px 14px;
      }
      .ico {
        flex: none;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        display: grid;
        place-items: center;
        font-weight: 800;
        color: #fff;
        font-family: 'Space Grotesk', sans-serif;
        font-size: 1.1rem;
      }
      .ico.park {
        background: #2a6fdb;
      }
      .ico.sale {
        background: var(--yceo-orange, #f39200);
      }
      .itxt {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .itxt small {
        color: var(--yceo-muted);
        font-size: 0.8rem;
      }
      .prod {
        font-size: 0.74rem !important;
      }
      .actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        border-top: 1px solid var(--yceo-border);
      }
      .actions button {
        border: none;
        background: none;
        padding: 10px;
        font: inherit;
        font-size: 0.86rem;
        font-weight: 700;
        color: var(--yceo-primary-dark);
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 6px;
      }
      .actions button + button {
        border-left: 1px solid var(--yceo-border);
      }
      .src {
        font-size: 0.74rem;
        text-align: center;
        margin-top: 14px;
      }
    `,
  ],
})
export class ServicesPage {
  private svc = inject(ServicesDataService);
  private places = inject(PlacesService);
  private store = inject(JourneyStore);
  private router = inject(Router);

  tab: Tab = 'parkings';
  data?: ServicesData;
  parkings: Parking[] = [];
  sales: SalePoint[] = [];
  private here?: { lat: number; lon: number };

  constructor() {
    addIcons({ carOutline, mapOutline, navigate, ticketOutline });
    this.svc.get().subscribe((d) => {
      this.data = d;
      this.parkings = d.parkings;
      this.sales = d.sales;
      this.places
        .locate()
        .then((p) => {
          this.here = p;
          const by = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
            haversine(p.lat, p.lon, a.lat, a.lon) - haversine(p.lat, p.lon, b.lat, b.lon);
          this.parkings = [...d.parkings].sort(by);
          this.sales = [...d.sales].sort(by);
        })
        .catch(() => undefined);
    });
  }

  dist(p: { lat: number; lon: number }): string {
    if (!this.here) return '';
    const m = haversine(this.here.lat, this.here.lon, p.lat, p.lon);
    return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
  }

  onMap(layer: Tab, p: { lat: number; lon: number }): void {
    this.router.navigate(['/map'], { queryParams: { layer, at: `${p.lat},${p.lon}` } });
  }

  goTo(name: string, p: { lat: number; lon: number }): void {
    this.store.pendingFrom = null;
    this.store.pendingTo = { kind: 'address', name, lat: p.lat, lon: p.lon };
    this.router.navigate(['/journey']);
  }
}
