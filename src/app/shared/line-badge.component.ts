import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Badge de ligne. Utilise l'icône officielle Ycéo (assets/lines/<nom>.svg) quand elle
 * existe, sinon une pastille colorée générée (couleur de texte auto-contrastée).
 */
@Component({
  selector: 'app-line-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <img
      *ngIf="iconName && !imgFailed; else pill"
      class="badge-img"
      [src]="'assets/lines/' + iconName + '.svg'"
      [style.height.px]="size"
      [alt]="label"
      (error)="imgFailed = true"
    />
    <ng-template #pill>
      <span
        class="badge display"
        [style.background]="'#' + clean(color)"
        [style.color]="textColor"
        [style.min-width.px]="size"
        [style.height.px]="size"
        [style.fontSize.px]="size * 0.42"
      >
        {{ label }}
      </span>
    </ng-template>
  `,
  styles: [
    `
      .badge-img {
        display: inline-block;
        width: auto;
        vertical-align: middle;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 8px;
        border-radius: 9px;
        font-weight: 700;
        line-height: 1;
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
      }
    `,
  ],
})
export class LineBadgeComponent {
  @Input() label = '';
  @Input() color = '888888';
  @Input() size = 34;
  imgFailed = false;

  /** Icônes officielles disponibles (assets/lines). */
  private static ICONS = new Set([
    'H1', 'H2', 'H3', '4', '5', '6', '7', '8', '9', 'L13', 'T5', '820', '923',
    'Brais', 'CentreVille',
  ]);
  /** Correspondance nom de ligne GTFS -> fichier d'icône. */
  private static ALIAS: Record<string, string> = {
    '13': 'L13',
    NBR: 'Brais',
    NCV: 'CentreVille',
  };

  get iconName(): string | null {
    const l = (this.label || '').trim();
    const a = LineBadgeComponent.ALIAS[l] ?? l;
    return LineBadgeComponent.ICONS.has(a) ? a : null;
  }

  clean(c: string): string {
    return (c || '888888').replace('#', '') || '888888';
  }

  get textColor(): string {
    const c = this.clean(this.color);
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? '#0f2a2d' : '#ffffff';
  }
}
