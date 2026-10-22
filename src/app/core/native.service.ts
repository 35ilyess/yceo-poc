import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar } from '@capacitor/status-bar';

/**
 * Initialisation des éléments natifs au démarrage : barre d'état superposée
 * (edge-to-edge, gérée par les safe-area CSS) et masquage du splash une fois l'app prête.
 * Le style clair/sombre de la barre d'état est géré par ThemeService.
 * Sans effet sur le web / la PWA.
 */
@Injectable({ providedIn: 'root' })
export class NativeService {
  async init(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      if (Capacitor.getPlatform() === 'android') await StatusBar.setOverlaysWebView({ overlay: true });
    } catch {
      /* StatusBar indisponible : on continue */
    }
    try {
      await SplashScreen.hide();
    } catch {
      /* pas de splash : on continue */
    }
  }
}
