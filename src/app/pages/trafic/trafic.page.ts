import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonSpinner,
  IonIcon,
  IonNote,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { warningOutline, timeOutline, openOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { forkJoin } from 'rxjs';
import { TraficAlert, TraficService } from '../../core/trafic.service';
import { GtfsService } from '../../core/gtfs.service';
import { LineBadgeComponent } from '../../shared/line-badge.component';

@Component({
  selector: 'app-trafic',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonSpinner,
    IonIcon,
    IonNote,
    LineBadgeComponent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/home"></ion-back-button></ion-buttons>
        <ion-title>Infos trafic</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="pad">
        <div class="ion-text-center" *ngIf="loading"><ion-spinner name="dots"></ion-spinner></div>

        <ng-container *ngIf="!loading">
          <div class="ok" *ngIf="!alerts.length">
            <ion-icon name="checkmark-circle-outline"></ion-icon>
            <p>Trafic fluide sur l’ensemble du réseau.</p>
          </div>

          <p class="count" *ngIf="alerts.length">
            {{ alerts.length }} perturbation{{ alerts.length > 1 ? 's' : '' }} en cours
          </p>
          <div class="affected" *ngIf="affectedLines.length">
            <span class="muted">Lignes concernées :</span>
            <span
              class="lchip"
              *ngFor="let ln of affectedLines"
              [style.background]="'#' + lineColor(ln)"
              [style.color]="textColor(ln)"
              >{{ ln }}</span
            >
          </div>

          <div class="card alert" *ngFor="let a of alerts">
            <div class="a-top">
              <ion-icon name="warning-outline"></ion-icon>
              <div class="a-head">
                <div class="a-title">{{ a.title }}</div>
                <div class="a-period muted" *ngIf="a.period">
                  <ion-icon name="time-outline"></ion-icon> {{ a.period }}
                </div>
              </div>
            </div>
            <div class="a-lines" *ngIf="a.lines.length">
              <app-line-badge
                *ngFor="let ln of a.lines"
                [label]="ln"
                [color]="lineColor(ln)"
                [size]="26"
              ></app-line-badge>
            </div>
            <p class="a-body" *ngIf="a.body">{{ a.body }}</p>
          </div>

          <a class="source" [href]="source" target="_blank" rel="noopener" *ngIf="source">
            <ion-icon name="open-outline"></ion-icon> Voir sur yceo-mobilite.fr
          </a>
          <ion-note color="medium" class="foot" *ngIf="fetchedAt">
            Source : site officiel Ycéo · relevé du {{ fetchedAt | date: 'dd/MM/yyyy à HH:mm' }}
          </ion-note>
        </ng-container>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .pad {
        padding: 10px 16px 28px;
      }
      .ok {
        text-align: center;
        margin-top: 50px;
        color: var(--yceo-muted);
      }
      .ok ion-icon {
        font-size: 2.6rem;
        color: var(--yceo-green);
      }
      .count {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 600;
        margin: 4px 4px 2px;
      }
      .affected {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin: 2px 4px 14px;
        font-size: 0.82rem;
      }
      .lchip {
        font-weight: 700;
        border-radius: 8px;
        padding: 3px 9px;
        font-size: 0.8rem;
      }
      .alert {
        padding: 14px;
        margin-bottom: 12px;
      }
      .a-top {
        display: flex;
        gap: 10px;
      }
      .a-top > ion-icon {
        color: var(--yceo-orange);
        font-size: 1.4rem;
        flex: none;
        margin-top: 2px;
      }
      .a-title {
        font-weight: 600;
        font-size: 0.98rem;
        line-height: 1.25;
      }
      .a-period {
        font-size: 0.8rem;
        margin-top: 4px;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .a-lines {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin: 10px 0 0 34px;
      }
      .a-body {
        margin: 10px 0 0 34px;
        font-size: 0.88rem;
        color: var(--yceo-ink);
        line-height: 1.35;
      }
      .source {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 8px 4px;
        color: var(--yceo-primary);
        font-weight: 600;
        text-decoration: none;
        font-size: 0.9rem;
      }
      .foot {
        display: block;
        margin: 8px 4px;
        font-size: 0.76rem;
      }
    `,
  ],
})
export class TraficPage {
  private trafic = inject(TraficService);
  private gtfs = inject(GtfsService);
  alerts: TraficAlert[] = [];
  affectedLines: string[] = [];
  source = '';
  fetchedAt = '';
  loading = true;
  private colorByShort: Record<string, string> = {};

  constructor() {
    addIcons({ warningOutline, timeOutline, openOutline, checkmarkCircleOutline });
    forkJoin({ data: this.trafic.get(), lines: this.gtfs.getLines() }).subscribe({
      next: ({ data, lines }) => {
        for (const l of lines) this.colorByShort[l.short] ??= l.color;
        this.alerts = data.alerts;
        this.affectedLines = data.affectedLines;
        this.source = data.source;
        this.fetchedAt = data.fetchedAt;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  lineColor(short: string): string {
    return this.colorByShort[short] ?? '00a7b5';
  }

  textColor(short: string): string {
    const c = this.lineColor(short);
    const r = parseInt(c.slice(0, 2), 16),
      g = parseInt(c.slice(2, 4), 16),
      b = parseInt(c.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#0f2a2d' : '#ffffff';
  }
}
