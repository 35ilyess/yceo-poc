import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cardOutline, mapOutline, openOutline, ticketOutline } from 'ionicons/icons';
import { TarifGroup, TarifsData, TarifsService } from '../../core/tarifs.service';

type Bucket = 'titres' | 'abos';

/** Titres & tarifs du réseau Ycéo (open data) + accès aux points de vente. */
@Component({
  selector: 'app-tarifs',
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonIcon],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/home" text=""></ion-back-button></ion-buttons>
        <ion-title>Titres & tarifs</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="body" *ngIf="data">
        <!-- Où acheter -->
        <button class="card cta" (click)="onMap()">
          <span class="dot"><img src="assets/icon/yceo-mark.png" alt="" /></span>
          <span class="cta-txt">
            <b>Où acheter ?</b>
            <small>Points de vente du réseau sur le plan</small>
          </span>
          <ion-icon name="map-outline"></ion-icon>
        </button>

        <!-- 2 gros boutons : Titres / Abonnements -->
        <div class="tiles">
          <button class="tile" [class.on]="bucket === 'titres'" (click)="bucket = 'titres'" [attr.aria-pressed]="bucket === 'titres'">
            <span class="ic"><ion-icon name="ticket-outline"></ion-icon></span>
            <span class="lbl">Titres</span>
            <span class="sub">dès {{ minPrice(titres) }}</span>
          </button>
          <button class="tile" [class.on]="bucket === 'abos'" (click)="bucket = 'abos'" [attr.aria-pressed]="bucket === 'abos'">
            <span class="ic"><ion-icon name="card-outline"></ion-icon></span>
            <span class="lbl">Abonnements</span>
            <span class="sub">dès {{ minPrice(abos) }}</span>
          </button>
        </div>

        <!-- Détail du choix -->
        <ng-container *ngFor="let g of shown">
          <h3 class="sec">{{ g.category }}</h3>
          <div class="card list">
            <div class="row" *ngFor="let t of g.items">
              <span class="t-txt">
                <b>{{ t.name }}</b>
                <small *ngIf="t.condition">{{ t.condition }}</small>
              </span>
              <span class="price" *ngIf="t.price != null">{{ fmt(t.price) }}</span>
            </div>
          </div>
        </ng-container>

        <a class="shop" href="https://www.yceo-mobilite.fr/mes-titres-et-tarifs/" target="_blank" rel="noopener">
          <ion-icon name="open-outline"></ion-icon> Acheter en ligne (site officiel)
        </a>
        <p class="src muted">{{ data.source }} · maj {{ data.updated }}</p>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .body {
        padding: 14px 16px 18px;
      }
      .cta {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 12px 14px;
        font: inherit;
        color: var(--yceo-ink);
        text-align: left;
        cursor: pointer;
      }
      .dot {
        flex: none;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #fff;
        display: grid;
        place-items: center;
        box-shadow: inset 0 0 0 1px var(--yceo-border);
      }
      .dot img {
        width: 28px;
        height: 28px;
      }
      .cta-txt {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .cta-txt small {
        color: var(--yceo-muted);
        font-size: 0.8rem;
      }
      .cta ion-icon {
        flex: none;
        font-size: 1.3rem;
        color: var(--yceo-primary-dark);
      }
      .tiles {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin: 16px 0 2px;
      }
      .tile {
        background: var(--yceo-card);
        border: 1px solid var(--yceo-border);
        border-radius: 16px;
        box-shadow: var(--yceo-shadow);
        padding: 16px 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        font: inherit;
        color: var(--yceo-ink);
        cursor: pointer;
      }
      .tile.on {
        outline: 2px solid var(--yceo-primary);
        border-color: transparent;
      }
      .tile .ic {
        width: 46px;
        height: 46px;
        border-radius: 13px;
        background: var(--yceo-tile);
        color: var(--yceo-primary-dark);
        display: grid;
        place-items: center;
      }
      .tile.on .ic {
        background: var(--yceo-primary);
        color: #fff;
      }
      .tile .ic ion-icon {
        font-size: 1.5rem;
      }
      .tile .lbl {
        font-weight: 700;
        font-size: 0.98rem;
      }
      .tile .sub {
        font-size: 0.78rem;
        color: var(--yceo-muted);
      }
      .sec {
        margin: 20px 2px 8px;
        font-size: 1rem;
        color: var(--yceo-ink);
      }
      .list {
        overflow: hidden;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--yceo-border);
      }
      .row:last-child {
        border-bottom: none;
      }
      .t-txt {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .t-txt b {
        font-weight: 600;
        font-size: 0.93rem;
      }
      .t-txt small {
        color: var(--yceo-muted);
        font-size: 0.78rem;
      }
      .price {
        flex: none;
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 800;
        font-size: 1.05rem;
        color: var(--yceo-primary-dark);
      }
      .shop {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 20px;
        padding: 13px;
        border-radius: 14px;
        background: var(--yceo-primary);
        color: #fff;
        font-weight: 700;
        text-decoration: none;
      }
      .src {
        text-align: center;
        font-size: 0.74rem;
        margin-top: 14px;
      }
    `,
  ],
})
export class TarifsPage {
  private svc = inject(TarifsService);
  private router = inject(Router);
  data?: TarifsData;
  bucket: Bucket = 'titres';

  constructor() {
    addIcons({ cardOutline, mapOutline, openOutline, ticketOutline });
    this.svc.get().subscribe((d) => (this.data = d));
  }

  get titres(): TarifGroup[] {
    return (this.data?.groups ?? []).filter((g) => g.category !== 'Abonnements');
  }
  get abos(): TarifGroup[] {
    return (this.data?.groups ?? []).filter((g) => g.category === 'Abonnements');
  }
  get shown(): TarifGroup[] {
    return this.bucket === 'titres' ? this.titres : this.abos;
  }

  /** Prix minimum d'un ensemble de groupes, formaté. */
  minPrice(groups: TarifGroup[]): string {
    const prices = groups.flatMap((g) => g.items.map((i) => i.price)).filter((p): p is number => p != null);
    return prices.length ? this.fmt(Math.min(...prices)) : '—';
  }

  fmt(p: number): string {
    return p.toFixed(2).replace('.', ',').replace(',00', '') + ' €';
  }

  /** Plan pré-filtré sur les points de vente. */
  onMap(): void {
    this.router.navigate(['/map'], { queryParams: { layer: 'sales' } });
  }
}
