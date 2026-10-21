/**
 * Configuration "reseau" — equivalent du environment.json de l'app STAR Rennes.
 * Changer de reseau de transport = editer ce seul fichier (portail Opendatasoft,
 * identifiants de jeux de donnees, couverture Navitia, centre de carte).
 *
 * Reseau cible ici : Ycéo / STRAN — Saint-Nazaire Agglomeration (CARENE).
 */
export interface NetworkConfig {
  name: string;
  brand: string;
  /** Portail Opendatasoft du reseau (donnees geographiques ouvertes, sans cle). */
  odsBaseUrl: string;
  odsDatasets: {
    stops: string;
    lines: string;
  };
  /** API Navitia (itineraire + prochains passages). Token gratuit : https://navitia.io */
  navitia: {
    baseUrl: string;
    /** Couverture regionale. Modifiable dans l'ecran Reglages (auto-detectable). */
    defaultCoverage: string;
    /** Laisse vide : l'utilisateur colle SON token gratuit dans Reglages (stocke en local). */
    token: string;
  };
  /** Centre + zoom initial de la carte. */
  map: { lat: number; lon: number; zoom: number };
  /** Style MapLibre officiel du réseau (rendu identique à la carte officielle). */
  mapStyleUrl: string;
}

export const environment = {
  production: false,
  network: <NetworkConfig>{
    name: 'yceo',
    brand: 'Ycéo · Saint-Nazaire',
    odsBaseUrl: 'https://data.saintnazaireagglo.fr/api/explore/v2.1',
    odsDatasets: {
      stops: '244400644_arrets_urbains_stran1',
      lines: '244400644_stran_lignes_urbaines',
    },
    navitia: {
      baseUrl: 'https://api.navitia.io/v1',
      defaultCoverage: 'fr-nw', // France Nord-Ouest ; ajustable/auto-detectable dans Reglages
      token: '', // <-- a renseigner dans Reglages (navitia.io, gratuit)
    },
    map: { lat: 47.2735, lon: -2.2135, zoom: 12 },
    // Style MapLibre officiel Ycéo (serveur de tuiles Actigraph — démo ; prévoir son propre serveur en prod).
    mapStyleUrl: 'https://tile.cartographie.pro/styles/yceo/style.json',
  },
};
