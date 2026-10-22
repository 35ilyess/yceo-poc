import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export type ThemeMode = 'auto' | 'light' | 'dark';

const KEY = 'yceo.theme';

/**
 * Thème de l'app : Auto (suit le système), Clair ou Sombre (forcés).
 * Pose l'attribut `data-theme` sur <html> ; les tokens sont dans global.scss.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private subject = new BehaviorSubject<ThemeMode>(this.load());
  readonly mode$ = this.subject.asObservable();

  constructor() {
    // En mode Auto, suivre les bascules clair/sombre du système.
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
      if (this.mode === 'auto') this.apply('auto');
    });
  }

  get mode(): ThemeMode {
    return this.subject.value;
  }

  /** Applique le mode courant (à appeler au démarrage). */
  apply(mode: ThemeMode = this.subject.value): void {
    const root = document.documentElement;
    if (mode === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);
    const dark = this.isDark(mode);
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', dark ? '#0e1b1d' : '#005872');
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined);
    }
  }

  set(mode: ThemeMode): void {
    this.persist(mode);
    this.apply(mode);
  }

  /** Sombre effectif : forcé, ou auto + système sombre. */
  private isDark(mode: ThemeMode): boolean {
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  private load(): ThemeMode {
    try {
      const v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' ? v : 'auto';
    } catch {
      return 'auto';
    }
  }

  private persist(mode: ThemeMode): void {
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* mode privé : ignore */
    }
    this.subject.next(mode);
  }
}
