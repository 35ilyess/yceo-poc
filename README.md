# Ycéo POC — appli transport clean-room (Saint-Nazaire / STRAN)

Proof of concept d'une application de transport pour le réseau **Ycéo / STRAN** (Saint-Nazaire
Agglomération — CARENE), construite en **clean-room** : code 100 % original, inspiré de
l'**architecture** de l'app STAR Rennes (analyse de rétro-ingénierie), sans aucun code ni donnée
propriétaire repris.

## Stack (identique à STAR)

- **Ionic 8 + Angular 18 (standalone)** + **Capacitor 6** — appli hybride WebView, packageable iOS/Android.
- **Leaflet** pour la carte.
- **Données ouvertes Opendatasoft** (`data.saintnazaireagglo.fr`) — arrêts & lignes, **sans clé**.
- **API Navitia** pour les prochains passages et l'itinéraire (ton token gratuit).

## Fonctionnalités du POC

| Écran | Contenu | Source | Clé requise ? |
|---|---|---|---|
| **Accueil** | Hero, recherche, accès rapides, lignes, microservices, info trafic | GTFS | Non |
| **Lignes** | 21 lignes régulières + scolaires, cliquables | GTFS | Non |
| **Détail ligne** | Arrêts desservis par direction (timeline) | GTFS | Non |
| **Détail arrêt** | Lignes desservies + **prochains passages théoriques** | GTFS (calculés hors-ligne) | Non |
| **Carte** | Arrêts + tracés de lignes, arrêt cliquable → détail | GTFS + Opendatasoft (tracés) | Non |
| **Prochains passages** | Recherche d'arrêt → détail/horaires | GTFS | Non |
| **Itinéraire** | Recherche A→B | Navitia | Oui (token) |
| **Réglages** | Token Navitia + couverture | localStorage | — |

> **Horaires 100 % hors-ligne** : le GTFS officiel Ycéo est pré-traité en JSON compacts
> (`src/assets/gtfs/`). Les prochains passages sont calculés côté client depuis le calendrier GTFS
> (jours de circulation + exceptions). Navitia n'est utilisé que pour le calcul d'itinéraire porte-à-porte.
>
> **Temps réel** : indisponible en open data pour le réseau urbain STRAN (seule la navette du pont
> expose du GTFS-RT). Les horaires affichés sont donc théoriques.
>
> **NFC** : *stub* documenté (`src/app/core/nfc.service.ts`) — lecture Calypso = plugin natif
> CoreNFC/IsoDep + appareil NFC ; hors périmètre d'un POC web.

## Pipeline GTFS (régénérer les données)

```bash
# 1. télécharger le GTFS officiel (licence ouverte, transport.data.gouv.fr)
curl -L "https://app.mecatran.com/utw/ws/gtfsfeed/static/stran-merge?apiKey=2e6071036d276153761f0c090b4a45420e047612" -o gtfs.zip
unzip gtfs.zip -d gtfs_extracted
# 2. regénérer les assets JSON de l'app
python3 -I tools/build-gtfs.py gtfs_extracted src/assets/gtfs
```
Produit : `lines.json` (lignes→arrêts), `stops.json` (arrêt→lignes), `calendar.json` (services),
et `stop/<id>.json` (horaires par arrêt). ~1471 arrêts, 139 lignes.

## Lancer

```bash
npm install
npm start
```

Puis ouvrir http://localhost:4200. La **carte** marche tout de suite. Pour les passages et
l'itinéraire : onglet **Réglages** → coller un token gratuit **navitia.io** → *Détecter la
couverture* → Enregistrer.

### Packager en appli mobile (optionnel)

```bash
npm run build
npx cap add ios        # ou: npx cap add android
npm run sync
npx cap open ios       # Xcode / Android Studio
```

## Changer de réseau (design config-driven)

Toute la config réseau est dans **`src/environments/environment.ts`** — l'équivalent du
`environment.json` de STAR. Pour viser un autre réseau :

1. `odsBaseUrl` + `odsDatasets.stops` / `.lines` → portail Opendatasoft et identifiants de datasets du réseau.
2. `navitia.defaultCoverage` → couverture Navitia (auto-détectable dans Réglages).
3. `map` → centre/zoom initial.
4. `brand` / couleurs (`src/global.scss`).

Aucune autre ligne de code à toucher : les services (`ods.service.ts`, `navitia.service.ts`) sont
génériques.

## Architecture (miroir de STAR)

```
UI Angular (onglets)
  ├─ ConfigService      → config réseau (environment.ts) + token/couverture (localStorage)
  ├─ OdsService         → arrêts & lignes (Opendatasoft, sans clé)   ← équivalent open data Keolis
  ├─ NavitiaService     → passages & itinéraire (Navitia)            ← équivalent NavitiaSDK de STAR
  └─ NfcService (stub)  → lecture Calypso                            ← équivalent TicketingSDK Conduent
```

## Légal / éthique

- Données via **licences ouvertes** (Opendatasoft Saint-Nazaire Agglo, transport.data.gouv.fr).
- Navitia utilisé avec **ton propre token** (conditions navitia.io), jamais une clé tierce.
- Aucun contournement DRM, aucune donnée billettique écrite/forgée.

## Analyse de l'app officielle Ycéo (maasify) — référence

L'app officielle `production.maasify.saintnazaire` (v1.7.35) a été analysée en clean-room
(Ionic/Angular/Capacitor, plateforme **maasify.io**). Ce qu'on en a retenu :

**Direction artistique (appliquée au POC)** — tokens `--mb-*` :
- primary `#00a7b5`, dark `#005872`, extra-dark `#0080a0`, light `#33c0ce`, secondary `#55a7ae`
- carte = Mapbox (style custom `fpacotte/clnj38wn900ek01o0gl100c4j`)

**API temps réel (recette exacte, backend hors-ligne aujourd'hui)** :
- `POST https://graal.maasify.io/graphql` — queries `departuresStopAreas`, `stopDeparturesByLine`, `mainDepartures`
- réponse : `Departure.stopDateTime.arrival { baseDateTime, rtDateTime, dataFreshness: "REALTIME" | "BASE_SCHEDULE" }`
- `networkID = "saint-nazaire"` · auth Keycloak `auth.maasify.io/auth/realms/maasify`, client `app-saint-nazaire` (OIDC Bearer)
- itinéraire : `navitia.maasify.io/v1/coverage/{coverage}/...` · billettique : `titan.maasify.io/graphql` + Stripe/Worldline

> Le backend `graal.maasify.io` renvoie une erreur Cloudflare 522 (origine morte) : le tenant
> Saint-Nazaire est décommissionné. Le temps réel ne peut donc pas être rebranché. Le POC conserve
> les **horaires théoriques GTFS** (calculés hors-ligne) comme substitut fonctionnel.

## Carte — style officiel Ycéo (MapLibre) + repli

La carte utilise **MapLibre GL** avec le **style officiel Ycéo** (`tile.cartographie.pro/styles/yceo/style.json`,
prestataire Actigraph) → rendu identique à la carte officielle. Si **WebGL n'est pas disponible**
(certains environnements de prévisualisation, vieux navigateurs), bascule automatique sur un repli
**Leaflet + OpenStreetMap** (raster). Dans les deux cas : 1471 arrêts cliquables → détail d'arrêt.

> Le serveur de tuiles Actigraph est utilisé ici pour la démo (CORS ouvert). En production :
> prévoir son propre serveur de tuiles OpenMapTiles ou un accord avec le fournisseur.

## Icônes de ligne officielles + filtres carte

- **Badges de ligne** : utilisent les **icônes officielles Ycéo** (SVG `assets/lines/*.svg`, source Actigraph)
  pour H1-H3, 4-9, L13, T5, 820, 923 + navettes (Brais, CentreVille). Repli automatique sur une
  pastille colorée générée pour les lignes sans icône officielle.
- **Filtres carte** : barre de filtres (badges) en haut de la carte. Sélectionner une ou plusieurs
  lignes n'affiche que leurs arrêts (union), « Tout » réinitialise. Réduit fortement le nombre de
  points affichés (ex. 1471 → 71 pour une ligne) — utile en repli Leaflet.

### Mise à jour filtres
- **« Tout » est une bascule** : affiché = tous les arrêts ; re-cliquer **vide la carte** (0 arrêt)
  pour choisir sa/ses ligne(s) sur une carte nette.
- **Tracé en surbrillance** : sélectionner une ligne affiche son **tracé** (liseré blanc + couleur
  officielle de la ligne) en plus de ses arrêts. Géométries issues de l'open data ODS (27 lignes).

### Arrêts par ligne & choix du sens
- En filtrant une ligne, ses arrêts s'affichent en **petits ronds à la couleur de la ligne**,
  **dédupliqués (1 par arrêt)** et toujours cliquables (→ détail d'arrêt).
- Pour une **ligne unique**, une barre **choix du sens** apparaît (« Les deux sens » + chaque
  terminus) pour n'afficher que les arrêts du sens voulu.

### Plan du réseau & lisibilité (maj)
- **« Tout » affiche le plan complet** : tous les arrêts **et tous les tracés de lignes**
  (couleurs officielles). Sélectionner une ligne passe en vue ligne (arrêts colorés + tracé en avant).
- **Ronds plus visibles** (rayon + contour épaissis).
- Le **choix du sens** est sur la **page horaire** (détail de ligne), pas sur le plan.

### Lien fiche ligne → plan, et L13
- Sur la **fiche horaire** d'une ligne, bouton **« Voir la ligne sur le plan »** → ouvre la carte
  pré-filtrée sur cette ligne (`/map?line=<ligne>`), arrêts colorés + tracé.
- La **L13** (interurbaine La Baule / Pornichet / Saint-Nazaire) est ajoutée à la barre de filtres
  du plan, même si elle n'est pas classée « urbaine » dans le GTFS.

## Favoris & Autour de moi
- **Favoris** : étoile sur le détail d'un arrêt (persisté en local). Les arrêts favoris apparaissent
  sur l'accueil, **au-dessus de la section « Les lignes »**.
- **Autour de moi** : géolocalisation (GPS) → arrêts les plus proches triés par distance, avec les
  lignes desservies, cliquables. Repli « centre de Saint-Nazaire » si la position est indisponible.

## Infos trafic (liées au site officiel)
- Un script (`tools/build-trafic.py`) récupère les perturbations du site officiel
  (`yceo-mobilite.fr/.../infos-trafic/`) dans `assets/trafic.json`.
- L'accueil affiche un **bandeau** « X infos trafic » (1er titre) avec **« Voir plus »** →
  page **Infos trafic** listant toutes les perturbations (période, détail, lignes, lien officiel).
- S'il n'y a aucune perturbation : bandeau « Trafic fluide ».

```bash
python3 -I tools/build-trafic.py src/assets   # rafraîchir les infos trafic
```
> Snapshot (le web bloque le fetch direct par CORS) ; en appli native, un fetch live via
> CapacitorHttp est possible, avec ce JSON en repli.

## Favoris lignes, détail d'arrêt groupé, dark mode, a11y
- **Favoris de lignes** (étoile sur la fiche ligne) : affichés sur l'accueil ; si une ligne favorite
  est perturbée, une **alerte « Perturbation sur vos lignes favorites »** apparaît (favoris ∩ trafic).
- **Détail d'arrêt** : prochains passages **groupés par ligne et direction** (3 prochains par groupe).
- **Mode sombre** automatique (`prefers-color-scheme`).
- **Accessibilité** : aria-label / rôles sur les contrôles à icône (favoris, filtres carte, réglages),
  états vides/erreurs (itinéraire).
- **VéloYcéo** : renvoie vers le site officiel.
