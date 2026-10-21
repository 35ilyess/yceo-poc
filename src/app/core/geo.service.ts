import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface GeoPosition {
  lat: number;
  lon: number;
  accuracy?: number;
}

/**
 * Géolocalisation unifiée : plugin Capacitor natif (CoreLocation / FusedLocation)
 * sur mobile, API navigateur en PWA/web. La demande de permission iOS/Android est
 * gérée par le plugin ; les chaînes d'usage doivent figurer dans Info.plist /
 * AndroidManifest (voir PORTAGE.md).
 */
@Injectable({ providedIn: 'root' })
export class GeoService {
  private readonly native = Capacitor.isNativePlatform();

  /** Position courante. Rejette si refusée ou indisponible. */
  async current(): Promise<GeoPosition> {
    if (this.native) {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') {
        const req = await Geolocation.requestPermissions({ permissions: ['location'] });
        if (req.location !== 'granted') throw new Error('permission refusée');
      }
      const p = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      });
      return { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy };
    }
    // Web / PWA
    return new Promise<GeoPosition>((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('indisponible'));
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    });
  }
}
