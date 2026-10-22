import { Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBack, close, searchOutline } from 'ionicons/icons';
import maplibregl from 'maplibre-gl';
import * as L from 'leaflet';
import { forkJoin } from 'rxjs';
import { ConfigService } from '../../core/config.service';
import { GtfsLine, GtfsService, GtfsStop } from '../../core/gtfs.service';
import { JourneyStore } from '../../core/journey-store.service';
import { Journey } from '../../core/models';
import { OdsService } from '../../core/ods.service';
import { ServicesData, ServicesDataService } from '../../core/services-data.service';
import { LineBadgeComponent } from '../../shared/line-badge.component';

interface DrawStop {
  id: string;
  lat: number;
  lon: number;
  color: string;
  stroke: string;
}

type Layer = 'parkings' | 'sales';

const esc = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, RouterLink, IonContent, IonIcon, IonSpinner, LineBadgeComponent],
  template: `
    <ion-content [fullscreen]="true">
      <div class="map-root" id="map"></div>

      <div class="top" *ngIf="journey">
        <div class="jcard">
          <button class="jback" (click)="back()" aria-label="Retour à l’itinéraire">
            <ion-icon name="arrow-back"></ion-icon>
          </button>
          <div class="jinfo">
            <div class="jt">
              {{ journey.departure | date: 'HH:mm' }} → {{ journey.arrival | date: 'HH:mm' }}
              <span class="jd">· {{ journey.durationMin }} min</span>
            </div>
            <div class="jlines">
              <ng-container *ngFor="let s of journey.sections">
                <app-line-badge
                  *ngIf="s.mode === 'bus'"
                  [label]="s.label"
                  [color]="s.lineColor || '00a7b5'"
                  [size]="22"
                ></app-line-badge>
                <span class="jw" *ngIf="s.mode !== 'bus'">🚶{{ s.durationMin }}′</span>
              </ng-container>
            </div>
          </div>
          <button class="jback" (click)="exitJourney()" aria-label="Fermer le trajet">
            <ion-icon name="close"></ion-icon>
          </button>
        </div>
      </div>

      <div class="top" *ngIf="!journey">
        <div class="floating-search" routerLink="/search">
          <ion-icon name="search-outline"></ion-icon>
          <span>Ligne, arrêt ou adresse…</span>
        </div>
        <div class="filters" role="group" aria-label="Filtrer par ligne">
          <button
            class="fchip all"
            [class.active]="allMode"
            [attr.aria-pressed]="allMode"
            aria-label="Afficher tout le réseau"
            (click)="toggleAll()"
          >
            Tout
          </button>
          <button
            class="fchip svc"
            [class.active]="layers.has('parkings')"
            [attr.aria-pressed]="layers.has('parkings')"
            aria-label="Afficher les parkings relais"
            (click)="toggleLayer('parkings')"
          >
            <span class="pk">P</span> Parkings
          </button>
          <button
            class="fchip svc"
            [class.active]="layers.has('sales')"
            [attr.aria-pressed]="layers.has('sales')"
            aria-label="Afficher les points de vente"
            (click)="toggleLayer('sales')"
          >
            <span class="pv"><img src="assets/icon/yceo-mark.png" alt="" /></span> Ventes
          </button>
          <button
            class="fchip"
            *ngFor="let l of filterable"
            [class.active]="filter.has(l.short)"
            [attr.aria-pressed]="filter.has(l.short)"
            [attr.aria-label]="'Ligne ' + l.short"
            (click)="toggle(l.short)"
          >
            <app-line-badge [label]="l.short" [color]="l.color" [size]="30"></app-line-badge>
          </button>
        </div>
      </div>

      <div class="legend" *ngIf="!loading && !journey">
        <ng-container *ngIf="serviceCount !== null; else stopsLegend">
          <span class="dot" [style.background]="layers.has('parkings') ? '#2a6fdb' : 'var(--yceo-primary)'"></span>
          {{ serviceCount }} {{ layers.has('parkings') ? 'parkings relais' : 'points de vente' }}
        </ng-container>
        <ng-template #stopsLegend>
          <span class="dot" [style.background]="legendDotColor"></span>{{ stopCount }} arrêts
          <span class="sep" *ngIf="allMode">· plan du réseau</span>
          <span class="sep" *ngIf="!allMode && filter.size">· {{ filterLabel }}</span>
          <span class="sep" *ngIf="!allMode && !filter.size">· choisissez une ligne</span>
        </ng-template>
      </div>
      <div class="legend loading" *ngIf="loading">
        <ion-spinner name="dots"></ion-spinner>&nbsp;Chargement…
      </div>
    </ion-content>
  `,
  styles: [
    `
      .top {
        position: absolute;
        top: calc(12px + env(safe-area-inset-top));
        left: 0;
        right: 0;
        z-index: 1000;
        padding: 0 12px;
      }
      .floating-search {
        background: var(--yceo-card);
        border-radius: 14px;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--yceo-muted);
        font-weight: 500;
        font-size: 0.95rem;
        box-shadow: var(--yceo-shadow-lg);
      }
      .floating-search ion-icon {
        color: var(--yceo-primary);
        font-size: 1.25rem;
      }
      .filters {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        padding: 10px 2px 2px;
        -webkit-overflow-scrolling: touch;
      }
      .filters::-webkit-scrollbar {
        display: none;
      }
      .fchip {
        flex: none;
        border: none;
        background: var(--yceo-card);
        border-radius: 999px;
        padding: 4px;
        box-shadow: var(--yceo-shadow);
        display: flex;
        align-items: center;
        opacity: 0.55;
        transition: opacity 0.12s ease;
      }
      .fchip.active {
        opacity: 1;
        outline: 2px solid var(--yceo-primary);
      }
      .fchip.all {
        padding: 8px 14px;
        font-weight: 700;
        color: var(--yceo-primary-dark);
        font-family: 'Space Grotesk', sans-serif;
      }
      .fchip.svc {
        padding: 6px 12px 6px 6px;
        gap: 6px;
        font-weight: 700;
        font-size: 0.82rem;
        color: var(--yceo-ink);
      }
      .pk,
      .pv {
        width: 22px;
        height: 22px;
        border-radius: 6px;
        display: grid;
        place-items: center;
        color: #fff;
        font-weight: 800;
        font-size: 0.8rem;
      }
      .pk {
        background: #2a6fdb;
      }
      .pv {
        background: #fff;
        border-radius: 50%;
        box-shadow: inset 0 0 0 1px var(--yceo-border);
      }
      .pv img {
        width: 16px;
        height: 16px;
      }
      .jcard {
        background: var(--yceo-card);
        border-radius: 16px;
        box-shadow: var(--yceo-shadow-lg);
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
      }
      .jback {
        flex: none;
        border: none;
        background: var(--yceo-tile);
        color: var(--yceo-primary-dark);
        width: 38px;
        height: 38px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        font-size: 1.2rem;
      }
      .jinfo {
        flex: 1;
        min-width: 0;
      }
      .jt {
        font-weight: 800;
        font-family: 'Space Grotesk', sans-serif;
        color: var(--yceo-ink);
      }
      .jd {
        color: var(--yceo-muted);
        font-weight: 600;
      }
      .jlines {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
        margin-top: 2px;
      }
      .jw {
        font-size: 0.78rem;
        color: var(--yceo-muted);
        font-weight: 600;
      }
      .legend {
        position: absolute;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        background: var(--yceo-card);
        border-radius: 999px;
        padding: 8px 16px;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--yceo-ink);
        box-shadow: var(--yceo-shadow-lg);
        display: flex;
        align-items: center;
        white-space: nowrap;
        max-width: 90%;
      }
      .legend .dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        margin-right: 8px;
      }
      .legend .sep {
        margin-left: 6px;
        color: var(--yceo-muted);
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ],
})
export class MapPage implements OnInit, OnDestroy {
  cfg = inject(ConfigService);
  private gtfs = inject(GtfsService);
  private ods = inject(OdsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private zone = inject(NgZone);
  private store = inject(JourneyStore);
  private servicesSvc = inject(ServicesDataService);
  private services?: ServicesData;
  private lJourney?: L.LayerGroup;
  private lServices?: L.LayerGroup;
  private mlSaleMarkers: maplibregl.Marker[] = [];
  private ready = false;
  private pendingAt: [number, number] | null = null;
  journey: Journey | null = null;
  layers = new Set<Layer>();
  private pendingLine: string | null = null;
  private pendingApplied = false;
  private mlMap?: maplibregl.Map;
  private lMap?: L.Map;
  private lStops?: L.LayerGroup;
  private lShapes?: L.LayerGroup;
  private stopsRec: Record<string, GtfsStop> = {};
  private shapes = new Map<string, { geom: any; color: string }>();
  private colorByShort = new Map<string, string>();
  loading = true;
  stopCount = 0;
  webgl = hasWebGL();
  filterable: GtfsLine[] = [];
  filter = new Set<string>();
  allMode = true;
  singleLine: GtfsLine | null = null;

  constructor() {
    addIcons({ arrowBack, close, searchOutline });
  }

  ngOnInit(): void {
    document.addEventListener('click', this.onGoClick);
    // La page est conservée par les onglets Ionic : on réagit à chaque changement de paramètres.
    this.route.queryParamMap.subscribe((p) => {
      this.pendingLine = p.get('line');
      this.pendingApplied = false;
      this.journey = p.get('journey') ? this.store.shown : null;
      const layer = p.get('layer') as Layer | null;
      if (layer === 'parkings' || layer === 'sales') {
        this.layers = new Set([layer]);
        this.allMode = false;
        this.filter.clear();
        this.singleLine = null;
      }
      const at = p.get('at')?.split(',').map(Number);
      this.pendingAt = at && at.length === 2 && at.every(isFinite) ? [at[0], at[1]] : null;
      this.applyParams();
    });
    this.servicesSvc.get().subscribe((d) => {
      this.services = d;
      this.drawServices();
    });
    this.gtfs.getLines().subscribe((lines) => {
      const seen = new Set<string>();
      const urban = lines.filter((l) => {
        if (!l.urban) return false;
        if (seen.has(l.short)) return false;
        seen.add(l.short);
        return true;
      });
      // Force l'inclusion de la L13 (interurbaine La Baule / Pornichet / Saint-Nazaire).
      if (!urban.some((l) => l.short === '13')) {
        const l13 =
          lines.find((l) => l.short === '13' && /pornichet/i.test(l.long)) ??
          lines.find((l) => l.short === '13');
        if (l13) {
          const i = urban.findIndex((l) => l.short === '9');
          urban.splice(i >= 0 ? i + 1 : urban.length, 0, l13);
        }
      }
      this.filterable = urban;
      for (const l of lines) if (!this.colorByShort.has(l.short)) this.colorByShort.set(l.short, l.color);
      this.maybeApplyPending();
    });
    setTimeout(() => {
      if (this.webgl) {
        try {
          this.initMapLibre();
          return;
        } catch {
          this.webgl = false;
          const el = document.getElementById('map');
          if (el) el.innerHTML = '';
        }
      }
      this.initLeaflet();
    }, 150);
  }

  get filterLabel(): string {
    return [...this.filter].join(', ');
  }

  get legendDotColor(): string {
    return this.singleLine ? '#' + this.singleLine.color : 'var(--yceo-primary)';
  }

  /** Calque de services actif seul (parkings/ventes) : masque lignes & arrêts. */
  get serviceCount(): number | null {
    if (this.allMode || this.filter.size || this.layers.size !== 1) return null;
    const d = this.services;
    if (!d) return 0;
    return this.layers.has('parkings') ? d.parkings.length : d.sales.length;
  }

  toggleAll(): void {
    this.allMode = !this.allMode;
    this.filter.clear();
    this.singleLine = null;
    this.layers.clear();
    this.applyFilter();
    this.drawServices();
  }

  toggle(short: string): void {
    this.allMode = false;
    this.layers.clear();
    if (this.filter.has(short)) this.filter.delete(short);
    else this.filter.add(short);
    this.singleLine =
      this.filter.size === 1 ? this.filterable.find((l) => l.short === [...this.filter][0]) ?? null : null;
    this.applyFilter();
    this.drawServices();
  }

  /** Parkings / Ventes : exclusif, masque le reste (comme sélectionner une ligne). */
  toggleLayer(l: Layer): void {
    if (this.layers.has(l) && this.layers.size === 1) {
      this.layers.clear();
      this.allMode = true;
    } else {
      this.layers = new Set([l]);
      this.allMode = false;
    }
    this.filter.clear();
    this.singleLine = null;
    this.applyFilter();
    this.drawServices();
  }

  /** Arrêts à dessiner, colorés et dédupliqués (1 par arrêt). */
  private drawStops(): DrawStop[] {
    if (this.allMode) {
      return Object.entries(this.stopsRec).map(([id, s]) => ({
        id,
        lat: s.lat,
        lon: s.lon,
        color: '#ffffff',
        stroke: '#005872',
      }));
    }
    if (!this.filter.size) return [];

    const seen = new Set<string>();
    const out: DrawStop[] = [];
    const push = (id: string, color: string) => {
      const s = this.stopsRec[id];
      if (!s || seen.has(s.n)) return;
      seen.add(s.n);
      out.push({ id, lat: s.lat, lon: s.lon, color, stroke: '#ffffff' });
    };

    if (this.singleLine) {
      const col = '#' + this.singleLine.color;
      for (const d of this.singleLine.directions) for (const id of d.stops) push(id, col);
    } else {
      for (const [id, s] of Object.entries(this.stopsRec)) {
        const short = s.l.find((ln) => this.filter.has(ln));
        if (short) push(id, '#' + (this.colorByShort.get(short) ?? '00a7b5'));
      }
    }
    return out;
  }

  /** Lignes dont on affiche le tracé : toutes en mode "Tout" (plan), sinon la sélection. */
  private shapeShorts(): string[] {
    return this.allMode ? [...this.shapes.keys()] : [...this.filter];
  }

  private toStopsFC(stops: DrawStop[]): any {
    return {
      type: 'FeatureCollection',
      features: stops.map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: { id: s.id, color: s.color, stroke: s.stroke },
      })),
    };
  }

  private toShapesFC(): any {
    const features: any[] = [];
    for (const short of this.shapeShorts()) {
      const sh = this.shapes.get(short);
      if (sh?.geom) features.push({ type: 'Feature', geometry: sh.geom, properties: { color: '#' + sh.color } });
    }
    return { type: 'FeatureCollection', features };
  }

  private applyFilter(): void {
    const stops = this.drawStops();
    this.stopCount = stops.length;
    if (this.mlMap) {
      (this.mlMap.getSource('stops') as maplibregl.GeoJSONSource | undefined)?.setData(this.toStopsFC(stops));
      (this.mlMap.getSource('hl-lines') as maplibregl.GeoJSONSource | undefined)?.setData(this.toShapesFC());
      this.styleMlShapes();
    } else if (this.lMap) {
      this.drawLeafletStops(stops);
      this.drawLeafletShapes();
    }
  }

  /** Casing épais seulement pour une sélection ; en "Tout" (plan) : traits fins sans liseré. */
  private styleMlShapes(): void {
    if (!this.mlMap) return;
    const casing = this.allMode ? 'none' : 'visible';
    if (this.mlMap.getLayer('hl-lines-casing'))
      this.mlMap.setLayoutProperty('hl-lines-casing', 'visibility', casing);
    if (this.mlMap.getLayer('hl-lines'))
      this.mlMap.setPaintProperty('hl-lines', 'line-width', this.allMode ? 3 : 5);
  }

  /** Pré-sélectionne une ligne passée en paramètre d'URL (?line=…) une fois tout chargé. */
  private maybeApplyPending(): void {
    if (this.pendingApplied || !this.pendingLine) return;
    if (!this.filterable.length || !Object.keys(this.stopsRec).length) return;
    if (!this.mlMap && !this.lMap) return;
    this.pendingApplied = true;
    const short = this.pendingLine;
    this.allMode = false;
    this.filter = new Set([short]);
    this.singleLine = this.filterable.find((l) => l.short === short) ?? null;
    this.applyFilter();
  }

  /** Applique trajet / calques / centrage demandés une fois la carte prête. */
  private applyParams(): void {
    if (!this.ready) return;
    this.drawJourney();
    this.drawServices();
    if (this.journey) {
      this.allMode = false;
      this.filter.clear();
      this.singleLine = null;
      this.applyFilter();
    } else {
      if (!this.pendingLine && !this.allMode && !this.filter.size && !this.layers.size) {
        this.allMode = true;
        this.applyFilter();
      }
      this.maybeApplyPending();
    }
    if (this.pendingAt) {
      const [lat, lon] = this.pendingAt;
      this.pendingAt = null;
      this.mlMap?.flyTo({ center: [lon, lat], zoom: 16 });
      this.lMap?.setView([lat, lon], 16);
    }
  }

  back(): void {
    this.router.navigate(['/journey']);
  }

  exitJourney(): void {
    this.store.shown = null;
    this.router.navigate(['/map']);
  }

  private journeyFC(): any {
    const features: any[] = [];
    const j = this.journey;
    if (!j) return { type: 'FeatureCollection', features };
    for (const s of j.sections) {
      if (!s.path || s.path.length < 2) continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: s.path },
        properties: { walk: s.mode !== 'bus', color: '#' + (s.lineColor || '00a7b5') },
      });
    }
    return { type: 'FeatureCollection', features };
  }

  /** Départ, arrivée et points de correspondance du trajet. */
  private journeyPoints(): { lon: number; lat: number; kind: 'start' | 'end' | 'change'; label: string }[] {
    const j = this.journey;
    if (!j) return [];
    const pts: { lon: number; lat: number; kind: 'start' | 'end' | 'change'; label: string }[] = [];
    j.sections.forEach((s) => {
      if (s.mode !== 'bus' || !s.path?.length) return;
      const a = s.path[0];
      const b = s.path[s.path.length - 1];
      pts.push({ lon: a[0], lat: a[1], kind: 'change', label: `Monter · ${s.label} · ${s.from}` });
      pts.push({ lon: b[0], lat: b[1], kind: 'change', label: `Descendre · ${s.to}` });
    });
    if (j.from) pts.push({ lon: j.from.lon, lat: j.from.lat, kind: 'start', label: j.from.name });
    if (j.to) pts.push({ lon: j.to.lon, lat: j.to.lat, kind: 'end', label: j.to.name });
    return pts;
  }

  private drawJourney(): void {
    const pts = this.journeyPoints();
    const coords: [number, number][] = [
      ...(this.journey?.sections.flatMap((s) => s.path ?? []) ?? []),
      ...pts.map((p) => [p.lon, p.lat] as [number, number]),
    ];
    const ptsFC = {
      type: 'FeatureCollection',
      features: pts.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
        properties: {
          kind: p.kind,
          label: p.label,
          color: p.kind === 'start' ? '#00a7b5' : p.kind === 'end' ? '#d23b3b' : '#ffffff',
          stroke: p.kind === 'change' ? '#005872' : '#ffffff',
          r: p.kind === 'change' ? 5 : 9,
        },
      })),
    };
    if (this.mlMap) {
      (this.mlMap.getSource('journey') as maplibregl.GeoJSONSource | undefined)?.setData(this.journeyFC());
      (this.mlMap.getSource('journey-pts') as maplibregl.GeoJSONSource | undefined)?.setData(ptsFC as any);
    }
    if (this.lJourney) {
      this.lJourney.clearLayers();
      for (const f of this.journeyFC().features) {
        const ll = f.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
        if (f.properties.walk) {
          L.polyline(ll, { color: '#5b6b75', weight: 4, dashArray: '2 8', lineCap: 'round' }).addTo(this.lJourney);
        } else {
          L.polyline(ll, { color: '#ffffff', weight: 10, opacity: 0.95 }).addTo(this.lJourney);
          L.polyline(ll, { color: f.properties.color, weight: 6 }).addTo(this.lJourney);
        }
      }
      for (const f of ptsFC.features) {
        const [lon, lat] = f.geometry.coordinates;
        L.circleMarker([lat, lon], {
          radius: f.properties.r,
          color: f.properties.stroke,
          weight: 3,
          fillColor: f.properties.color,
          fillOpacity: 1,
        })
          .bindPopup(esc(f.properties.label))
          .addTo(this.lJourney);
      }
    }
    if (this.journey && coords.length) {
      const lons = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      const sw: [number, number] = [Math.min(...lons), Math.min(...lats)];
      const ne: [number, number] = [Math.max(...lons), Math.max(...lats)];
      const pad = { top: 130, bottom: 60, left: 40, right: 40 };
      this.mlMap?.fitBounds([sw, ne], { padding: pad, maxZoom: 16, duration: 600 });
      this.lMap?.fitBounds(
        [
          [sw[1], sw[0]],
          [ne[1], ne[0]],
        ],
        { paddingTopLeft: [40, 130], paddingBottomRight: [40, 60], maxZoom: 16 },
      );
    }
  }

  /** Bouton « S'y rendre » (itinéraire vers ce lieu) injecté dans la popup. */
  private goBtn(name: string, lat: number, lon: number): string {
    return (
      `<button class="yceo-go" data-name="${esc(name)}" data-lat="${lat}" data-lon="${lon}">` +
      `➜ S'y rendre</button>`
    );
  }

  private servicesFC(): any {
    const features: any[] = [];
    const d = this.services;
    if (d && this.layers.has('parkings')) {
      for (const p of d.parkings) {
        const name = p.name === 'Parking' ? `Parking · ${p.stop}` : p.name;
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
          properties: {
            type: 'parking',
            color: '#2a6fdb',
            html:
              `<b>${esc(name)}</b><br>${p.capacity} places · ${p.free ? 'gratuit' : 'payant ou non renseigné'}` +
              `<br>🚏 ${esc(p.stop)} à ${p.stopDist} m` +
              this.goBtn(name, p.lat, p.lon),
          },
        });
      }
    }
    if (d && this.layers.has('sales')) {
      for (const s of d.sales) {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
          properties: {
            type: 'sale',
            color: '#f39200',
            html:
              `<b>${esc(s.name)}</b><br>${esc(s.address)}, ${esc(s.city)}<br><small>${esc(s.products)}</small>` +
              this.goBtn(s.name, s.lat, s.lon),
          },
        });
      }
    }
    return { type: 'FeatureCollection', features };
  }

  /** Clic sur « S'y rendre » dans une popup (HTML injecté hors Angular). */
  private onGoClick = (e: Event): void => {
    const btn = (e.target as HTMLElement)?.closest?.('.yceo-go') as HTMLElement | null;
    if (!btn) return;
    const lat = parseFloat(btn.dataset['lat'] ?? '');
    const lon = parseFloat(btn.dataset['lon'] ?? '');
    const name = btn.dataset['name'] || 'Destination';
    if (!isFinite(lat) || !isFinite(lon)) return;
    this.zone.run(() => {
      this.store.pendingFrom = null;
      this.store.pendingTo = { kind: 'address', name, lat, lon };
      this.router.navigate(['/journey']);
    });
  };

  /** Pastille blanche ronde avec le logo Ycéo (points de vente). */
  private saleMarkerHtml(size = 22, img = 15): string {
    return (
      `<span style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:50%;` +
      `background:#fff;box-shadow:0 1px 5px rgba(0,0,0,.35)">` +
      `<img src="assets/icon/yceo-mark.png" alt="" style="width:${img}px;height:${img}px"></span>`
    );
  }

  private drawServices(): void {
    const fc = this.servicesFC();
    // --- MapLibre ---
    (this.mlMap?.getSource('services') as maplibregl.GeoJSONSource | undefined)?.setData(fc); // parkings (cercles)
    if (this.mlMap) {
      this.mlSaleMarkers.forEach((m) => m.remove());
      this.mlSaleMarkers = [];
      for (const f of fc.features) {
        if (f.properties.type !== 'sale') continue;
        const [lon, lat] = f.geometry.coordinates;
        const el = document.createElement('div');
        el.style.cursor = 'pointer';
        el.innerHTML = this.saleMarkerHtml();
        const m = new maplibregl.Marker({ element: el })
          .setLngLat([lon, lat])
          .setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(f.properties.html))
          .addTo(this.mlMap);
        this.mlSaleMarkers.push(m);
      }
    }
    // --- Leaflet ---
    if (this.lServices) {
      this.lServices.clearLayers();
      for (const f of fc.features) {
        const [lon, lat] = f.geometry.coordinates;
        if (f.properties.type === 'sale') {
          const icon = L.divIcon({ className: '', html: this.saleMarkerHtml(), iconSize: [22, 22], iconAnchor: [11, 11] });
          L.marker([lat, lon], { icon }).bindPopup(f.properties.html).addTo(this.lServices);
        } else {
          L.circleMarker([lat, lon], {
            radius: 8,
            color: '#ffffff',
            weight: 3,
            fillColor: f.properties.color,
            fillOpacity: 1,
          })
            .bindPopup(f.properties.html)
            .addTo(this.lServices);
        }
      }
    }
  }

  private loadData(cb: () => void): void {
    forkJoin({ stops: this.gtfs.getStops(), lines: this.ods.getLines() }).subscribe(
      ({ stops, lines }) => {
        this.stopsRec = stops;
        for (const l of lines) {
          const geom = (l.shape as any)?.geometry ?? l.shape;
          if (geom) this.shapes.set(l.shortName, { geom, color: l.color });
        }
        cb();
      },
    );
  }

  private initMapLibre(): void {
    const { lat, lon, zoom } = this.cfg.network.map;
    const map = new maplibregl.Map({
      container: 'map',
      style: this.cfg.network.mapStyleUrl,
      center: [lon, lat],
      zoom,
      attributionControl: { compact: true },
    });
    this.mlMap = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.on('load', () => {
      this.loadData(() => {
        map.addSource('hl-lines', { type: 'geojson', data: this.toShapesFC() });
        map.addLayer({
          id: 'hl-lines-casing',
          type: 'line',
          source: 'hl-lines',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.9 },
        });
        map.addLayer({
          id: 'hl-lines',
          type: 'line',
          source: 'hl-lines',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': ['get', 'color'], 'line-width': 5 },
        });
        map.addSource('stops', { type: 'geojson', data: this.toStopsFC(this.drawStops()) });
        map.addLayer({
          id: 'stops',
          type: 'circle',
          source: 'stops',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 14, 6, 16, 8],
            'circle-color': ['get', 'color'],
            'circle-stroke-color': ['get', 'stroke'],
            'circle-stroke-width': 2,
          },
        });
        map.addSource('journey', { type: 'geojson', data: this.journeyFC() });
        map.addLayer({
          id: 'journey-casing',
          type: 'line',
          source: 'journey',
          filter: ['==', ['get', 'walk'], false],
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 11 },
        });
        map.addLayer({
          id: 'journey-bus',
          type: 'line',
          source: 'journey',
          filter: ['==', ['get', 'walk'], false],
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': ['get', 'color'], 'line-width': 7 },
        });
        map.addLayer({
          id: 'journey-walk',
          type: 'line',
          source: 'journey',
          filter: ['==', ['get', 'walk'], true],
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#5b6b75', 'line-width': 4, 'line-dasharray': [0.5, 2] },
        });
        map.addSource('journey-pts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
          id: 'journey-pts',
          type: 'circle',
          source: 'journey-pts',
          paint: {
            'circle-radius': ['get', 'r'],
            'circle-color': ['get', 'color'],
            'circle-stroke-color': ['get', 'stroke'],
            'circle-stroke-width': 3,
          },
        });
        map.addSource('services', { type: 'geojson', data: this.servicesFC() });
        map.addLayer({
          id: 'services',
          type: 'circle',
          source: 'services',
          filter: ['==', ['get', 'type'], 'parking'], // les ventes sont des markers logo
          paint: {
            'circle-radius': 8,
            'circle-color': ['get', 'color'],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 3,
          },
        });
        for (const id of ['services', 'journey-pts']) {
          map.on('click', id, (e) => {
            const f = e.features?.[0];
            if (!f) return;
            const html = f.properties?.['html'] ?? esc(String(f.properties?.['label'] ?? ''));
            new maplibregl.Popup({ offset: 10 })
              .setLngLat((f.geometry as any).coordinates)
              .setHTML(html)
              .addTo(map);
          });
          map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'));
          map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''));
        }
        map.on('click', 'stops', (e) => {
          const id = e.features?.[0]?.properties?.['id'];
          if (id) this.zone.run(() => this.router.navigate(['/stops', id]));
        });
        map.on('mouseenter', 'stops', () => (map.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', 'stops', () => (map.getCanvas().style.cursor = ''));
        this.styleMlShapes();
        this.stopCount = this.drawStops().length;
        this.loading = false;
        this.ready = true;
        this.applyParams();
      });
    });
    map.on('error', () => (this.loading = false));
  }

  private initLeaflet(): void {
    const { lat, lon, zoom } = this.cfg.network.map;
    const map = L.map('map', { zoomControl: false }).setView([lat, lon], zoom);
    this.lMap = map;
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);
    this.lShapes = L.layerGroup().addTo(map);
    this.lStops = L.layerGroup().addTo(map);
    this.lJourney = L.layerGroup().addTo(map);
    this.lServices = L.layerGroup().addTo(map);
    map.invalidateSize();
    setTimeout(() => map.invalidateSize(), 300);
    this.loadData(() => {
      this.drawLeafletStops(this.drawStops());
      this.drawLeafletShapes();
      this.stopCount = this.drawStops().length;
      this.loading = false;
      this.ready = true;
      setTimeout(() => map.invalidateSize(), 100);
      this.applyParams();
    });
  }

  private drawLeafletStops(stops: DrawStop[]): void {
    if (!this.lStops) return;
    this.lStops.clearLayers();
    const r = this.allMode ? 4 : 5.5;
    for (const s of stops) {
      L.circleMarker([s.lat, s.lon], {
        radius: r,
        color: s.stroke,
        weight: 2,
        fillColor: s.color,
        fillOpacity: 1,
      })
        .on('click', () => this.zone.run(() => this.router.navigate(['/stops', s.id])))
        .addTo(this.lStops!);
    }
  }

  private drawLeafletShapes(): void {
    if (!this.lShapes) return;
    this.lShapes.clearLayers();
    for (const short of this.shapeShorts()) {
      const sh = this.shapes.get(short);
      if (!sh?.geom) continue;
      if (this.allMode) {
        // plan complet : traits fins colorés, sans liseré
        L.geoJSON(sh.geom as any, { style: { color: '#' + sh.color, weight: 3, opacity: 0.85 } }).addTo(this.lShapes);
      } else {
        L.geoJSON(sh.geom as any, { style: { color: '#ffffff', weight: 8, opacity: 0.9 } }).addTo(this.lShapes);
        L.geoJSON(sh.geom as any, { style: { color: '#' + sh.color, weight: 5 } }).addTo(this.lShapes);
      }
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.onGoClick);
    this.mlSaleMarkers.forEach((m) => m.remove());
    this.mlMap?.remove();
    this.lMap?.remove();
  }
}
