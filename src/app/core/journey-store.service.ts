import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Journey, PlacePoint } from './models';

/**
 * Etat partage entre pages : trajet affiche sur le plan, destination
 * choisie depuis la recherche.
 */
@Injectable({ providedIn: 'root' })
export class JourneyStore {
  /** Trajet a dessiner sur le plan (/map?journey=1). */
  shown: Journey | null = null;
  /** Depart / arrivee a pre-remplir a l'ouverture de l'itineraire. */
  pendingFrom: PlacePoint | null = null;
  pendingTo: PlacePoint | null = null;
}

export interface MapsApp {
  id: 'apple' | 'google' | 'waze';
  label: string;
  url: string;
}

/**
 * Applis de cartes installees sur le telephone. Les liens universels
 * (maps.apple.com, google.com/maps) ouvrent l'appli si elle est installee,
 * sinon le site web.
 */
export function mapsApps(from: PlacePoint, to: PlacePoint): MapsApp[] {
  const s = `${from.lat},${from.lon}`;
  const d = `${to.lat},${to.lon}`;
  const apps: MapsApp[] = [];
  const platform = Capacitor.getPlatform();
  const ios = platform === 'ios' || /iPhone|iPad|Macintosh/.test(navigator.userAgent);
  if (ios) {
    apps.push({ id: 'apple', label: 'Plans (Apple)', url: `https://maps.apple.com/?saddr=${s}&daddr=${d}&dirflg=r` });
  }
  apps.push({
    id: 'google',
    label: 'Google Maps',
    url: `https://www.google.com/maps/dir/?api=1&origin=${s}&destination=${d}&travelmode=transit`,
  });
  apps.push({ id: 'waze', label: 'Waze', url: `https://waze.com/ul?ll=${d}&navigate=yes` });
  return apps;
}
