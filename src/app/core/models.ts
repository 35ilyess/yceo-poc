/** Modeles partages du POC. */

export interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface Line {
  shortName: string;
  longName: string;
  color: string; // hex sans '#'
  shape?: unknown; // geometrie GeoJSON (tracé de ligne)
}

/** Un passage (prochain depart) renvoye par Navitia. */
export interface Departure {
  line: string;
  lineColor?: string;
  direction: string;
  /** Heure de depart (Date). */
  time: Date;
  /** true si la donnee est temps reel, false si theorique. */
  realtime: boolean;
}

/** Un lieu Navitia (autocompletion from/to). */
export interface Place {
  id: string;
  name: string;
  lat?: number;
  lon?: number;
}

/** Un point de depart/arrivee d'itineraire (arret, adresse ou position). */
export interface PlacePoint {
  kind: 'stop' | 'address' | 'here';
  name: string;
  lat: number;
  lon: number;
  stopId?: string;
  city?: string;
}

/** Une etape d'un trajet. */
export interface JourneySection {
  mode: string; // walking, bus, ...
  label: string;
  from: string;
  to: string;
  durationMin: number;
  lineColor?: string;
  lineId?: string;
  direction?: string;
  departure?: Date;
  arrival?: Date;
  /** Nombre d'arrets parcourus (bus). */
  stops?: number;
  /** Trace [lon, lat] de l'etape (arrets successifs ou ligne droite a pied). */
  path?: [number, number][];
}

export interface Journey {
  departure: Date;
  arrival: Date;
  durationMin: number;
  nbTransfers: number;
  sections: JourneySection[];
  from?: PlacePoint;
  to?: PlacePoint;
}
