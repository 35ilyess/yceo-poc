import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

/** Mentions légales, protection des données (RGPD) et attributions open data. */
@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/settings" text=""></ion-back-button></ion-buttons>
        <ion-title>Mentions & données</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="doc">
        <h2>À propos</h2>
        <p>
          Application <b>non officielle</b>, réalisée comme démonstration (POC). Elle n’émane pas de
          Saint-Nazaire Agglomération ni de l’exploitant du réseau Ycéo, et n’a aucun lien
          contractuel avec eux. Les marques et logos cités appartiennent à leurs titulaires.
        </p>

        <h2>Protection des données (RGPD)</h2>
        <ul>
          <li>
            <b>Aucun compte, aucun traçage.</b> L’application ne crée pas de profil et n’envoie
            aucune donnée personnelle à un serveur.
          </li>
          <li>
            <b>Géolocalisation :</b> utilisée uniquement quand vous le demandez (« Autour de moi »,
            « Ma position »), pour calculer un trajet ou trouver les arrêts proches. La position est
            traitée sur l’appareil et <b>n’est ni stockée ni transmise</b>.
          </li>
          <li>
            <b>Stockage local :</b> favoris, trajets et recherches récentes sont conservés
            uniquement sur votre appareil (stockage local) et supprimables à tout moment.
          </li>
          <li>
            <b>Recherche d’adresses :</b> le texte saisi est envoyé au géocodeur public de l’IGN
            (Géoplateforme) pour obtenir des suggestions. Aucun identifiant n’y est joint.
          </li>
        </ul>

        <h2>Sources de données (open data)</h2>
        <ul>
          <li>Lignes, arrêts et horaires — GTFS Ycéo, <b>Saint-Nazaire Agglomération</b> (open data).</li>
          <li>Arrêts accessibles PMR et points de vente — <b>Saint-Nazaire Agglomération</b> (open data).</li>
          <li>Parkings — <b>© contributeurs OpenStreetMap</b> (ODbL).</li>
          <li>Recherche d’adresses et fonds de carte de secours — <b>IGN Géoplateforme</b> / OpenStreetMap.</li>
          <li>
            Les horaires sont <b>théoriques</b> : le réseau ne diffuse pas d’information temps réel en
            open data.
          </li>
        </ul>

        <h2>Responsabilité</h2>
        <p>
          Les informations sont fournies à titre indicatif, sans garantie d’exactitude ni de
          disponibilité. Vérifiez toujours auprès des sources officielles avant un déplacement.
        </p>

        <p class="ver">Version POC · données open data mises à jour manuellement.</p>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .doc {
        max-width: 640px;
        margin: 0 auto;
      }
      h2 {
        font-size: 1.05rem;
        margin: 22px 0 8px;
        color: var(--yceo-primary-dark);
      }
      p,
      li {
        font-size: 0.92rem;
        line-height: 1.5;
        color: var(--yceo-ink);
      }
      ul {
        padding-left: 18px;
      }
      li {
        margin-bottom: 8px;
      }
      .ver {
        margin-top: 24px;
        font-size: 0.8rem;
        color: var(--yceo-muted);
      }
    `,
  ],
})
export class LegalPage {}
