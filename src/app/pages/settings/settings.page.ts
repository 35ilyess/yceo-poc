import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonText, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowForward, chevronForward, moon, shieldCheckmarkOutline, sunny } from 'ionicons/icons';
import { ConfigService } from '../../core/config.service';
import { ThemeService } from '../../core/theme.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonText],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar><ion-title>Réglages</ion-title></ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <h3 class="sec">Apparence</h3>
      <button
        class="card action"
        (click)="theme.toggleDark(!theme.isDark)"
        [attr.aria-label]="theme.isDark ? 'Activer le mode clair' : 'Activer le mode sombre'"
      >
        <ion-icon [name]="theme.isDark ? 'moon' : 'sunny'" class="lead" [class.sun]="!theme.isDark"></ion-icon>
        <span class="lbl">{{ theme.isDark ? 'Activer le mode clair' : 'Activer le mode sombre' }}</span>
        <span class="to">
          <ion-icon name="arrow-forward"></ion-icon>
          <ion-icon [name]="theme.isDark ? 'sunny' : 'moon'" [class.sun]="theme.isDark"></ion-icon>
        </span>
      </button>

      <h3 class="sec">Données & calculs</h3>
      <ion-text color="medium">
        <p>
          Tout fonctionne sans clé ni compte : lignes, arrêts et horaires viennent du GTFS
          open data {{ cfg.network.brand }} ; l'<b>itinéraire</b> est calculé directement sur le
          téléphone (moteur local, hors-ligne). Seule la recherche d'adresses interroge la
          Géoplateforme IGN (service public).
        </p>
        <p>
          Les horaires sont <b>théoriques</b> : le réseau ne publie pas de temps réel en open data.
        </p>
      </ion-text>

      <a class="card action link" routerLink="/legal">
        <ion-icon name="shield-checkmark-outline" class="lead"></ion-icon>
        <span class="lbl">Mentions légales & protection des données</span>
        <ion-icon name="chevron-forward" class="chev"></ion-icon>
      </a>
    </ion-content>
  `,
  styles: [
    `
      .sec {
        margin: 18px 2px 10px;
        font-size: 1.05rem;
        color: var(--yceo-ink);
      }
      .sec:first-of-type {
        margin-top: 6px;
      }
      .action {
        display: flex;
        align-items: center;
        gap: 14px;
        width: 100%;
        padding: 15px 16px;
        margin-bottom: 4px;
        font: inherit;
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--yceo-ink);
        text-align: left;
        text-decoration: none;
      }
      button.action {
        cursor: pointer;
      }
      .lead {
        flex: none;
        font-size: 1.4rem;
        color: var(--yceo-primary-dark);
      }
      .lead.sun {
        color: #f5b301;
      }
      .lbl {
        flex: 1;
      }
      .to {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--yceo-muted);
      }
      .to ion-icon {
        font-size: 1.15rem;
      }
      .to .sun {
        color: #f5b301;
      }
      .chev {
        flex: none;
        color: var(--yceo-muted);
      }
      p {
        font-size: 0.92rem;
        line-height: 1.5;
      }
    `,
  ],
})
export class SettingsPage {
  cfg = inject(ConfigService);
  theme = inject(ThemeService);

  constructor() {
    addIcons({ arrowForward, chevronForward, moon, shieldCheckmarkOutline, sunny });
  }
}
