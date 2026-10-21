import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonText,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronForward, shieldCheckmarkOutline } from 'ionicons/icons';
import { ConfigService } from '../../core/config.service';
import { NfcService } from '../../core/nfc.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonText,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar><ion-title>Réglages</ion-title></ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-text color="medium">
        <h3>Données & calculs</h3>
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

      <ion-item button detail="false" routerLink="/legal" lines="full" class="legal-link">
        <ion-icon name="shield-checkmark-outline" slot="start" color="primary"></ion-icon>
        <ion-label>Mentions légales & protection des données</ion-label>
        <ion-icon name="chevron-forward" slot="end" color="medium"></ion-icon>
      </ion-item>

      <hr />
      <ion-text color="medium">
        <h3>Lecture carte NFC</h3>
        <p>
          État : <b>{{ nfcState }}</b
          >. La lecture d'une carte billettique Calypso (SELECT AID <code>1TIC.ICA</code> → READ
          RECORD) exige un plugin Capacitor natif (CoreNFC sur iOS, IsoDep sur Android) sur un
          appareil équipé NFC. Non disponible dans ce POC web — l'API est stubbée et prête à être
          branchée.
        </p>
      </ion-text>
    </ion-content>
  `,
})
export class SettingsPage {
  cfg = inject(ConfigService);
  private nfc = inject(NfcService);

  nfcState = this.nfc.isAvailable() ? 'disponible' : 'indisponible (POC web)';

  constructor() {
    addIcons({ chevronForward, shieldCheckmarkOutline });
  }
}
