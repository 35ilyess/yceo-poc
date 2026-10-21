import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Initialisation des éléments natifs au démarrage : barre d'état superposée
 * (edge-to-edge, gérée par les safe-area CSS) et masquage du splash une fois l'app prête.
 * Sans effet sur le web / la PWA.
 */
@Injectable({ providedIn: 'root' })
export class NativeService {
  async init(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      // La WebView passe sous la barre d'état ; le padding safe-area est géré en CSS.
      if (Capacitor.getPlatform() === 'android') await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setStyle({ style: this.prefersDark() ? Style.Dark : Style.Light });
    } catch {
      /* StatusBar indisponible : on continue */
    }
    try {
      await SplashScreen.hide();
    } catch {
      /* pas de splash : on continue */
    }
  }

  private prefersDark(): boolean {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
