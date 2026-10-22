import { Component } from '@angular/core';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  homeOutline,
  gitBranchOutline,
  mapOutline,
  navigateOutline,
} from 'ionicons/icons';

/**
 * Shell des onglets : ion-tabs fournit son propre router-outlet interne,
 * les pages sont des routes ENFANTS (voir app.routes.ts). C'est la structure
 * attendue par Ionic — la bascule de page et le masquage fonctionnent correctement.
 */
@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="home">
          <ion-icon name="home-outline"></ion-icon>
          <ion-label>Accueil</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="lines">
          <ion-icon name="git-branch-outline"></ion-icon>
          <ion-label>Lignes</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="map">
          <ion-icon name="map-outline"></ion-icon>
          <ion-label>Carte</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="journey">
          <ion-icon name="navigate-outline"></ion-icon>
          <ion-label>Itinéraire</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
  styles: [
    `
      ion-tab-bar {
        --background: var(--yceo-card);
        --border: 0;
        height: 54px;
        padding-top: 3px;
        border-radius: 20px 20px 0 0;
        border-top: 1px solid var(--yceo-border);
        overflow: hidden;
        box-shadow: 0 -4px 18px rgba(15, 42, 45, 0.08);
      }
      ion-tab-button {
        --color: var(--yceo-muted);
        --color-selected: var(--yceo-primary);
      }
      ion-label {
        font-size: 0.7rem;
        font-weight: 600;
      }
      ion-icon {
        font-size: 1.3rem;
      }
    `,
  ],
})
export class TabsComponent {
  constructor() {
    addIcons({ homeOutline, gitBranchOutline, mapOutline, navigateOutline });
  }
}
