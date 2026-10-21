# Portage natif (iOS / Android) — checklist

L'app web est prête pour Capacitor. Le code gère déjà, de façon progressive
(web **et** natif) : géolocalisation (`@capacitor/geolocation`), partage
(`@capacitor/share`), splash + barre d'état (`@capacitor/splash-screen`,
`@capacitor/status-bar`), et les `safe-area` CSS pour l'encoche.

Il reste les étapes qui exigent les **toolchains natives** (Xcode / Android SDK),
à faire sur une machine de build.

## 1. Générer le build web + les plateformes

```bash
npm run build                 # produit www/ (inclut la PWA : ngsw + manifest)
npx cap add ios
npx cap add android
npx cap sync                  # copie www/ + installe les pods/plugins
```

## 2. Icônes & splash

```bash
npm i -D @capacitor/assets
# Fournir un visuel source : resources/icon.png (1024×1024) et resources/splash.png (2732×2732)
npx capacitor-assets generate
```

> L'icône PWA actuelle est un SVG (`src/assets/icon/app-icon.svg`). Pour le natif,
> exporter ce visuel en PNG 1024×1024 comme `resources/icon.png`.

## 3. Permissions — chaînes d'usage (obligatoires)

### iOS — `ios/App/App/Info.plist`

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Votre position sert à calculer un itinéraire et à trouver les arrêts proches. Elle n'est ni stockée ni partagée.</string>
```

### Android — `android/app/src/main/AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
```

> `@capacitor/geolocation` déclenche lui-même la demande de permission au premier
> `locate()`. Sans ces chaînes, iOS **plante** au lancement de la géoloc.

## 4. Ouverture des cartes externes (Apple Plans / Google Maps / Waze)

Les liens universels (`maps.apple.com`, `google.com/maps`) ouvrent l'app native si
elle est installée. Pour fiabiliser sur iOS, déclarer les schémas interrogés :

### iOS — `Info.plist`

```xml
<key>LSApplicationQueriesSchemes</key>
<array>
  <string>comgooglemaps</string>
  <string>waze</string>
</array>
```

## 5. Barre d'état & safe-area

Déjà géré : `NativeService.init()` (barre superposée + style selon le thème) et les
`padding: env(safe-area-inset-*)` (hero accueil, barre de la carte). Rien à faire,
sauf vérifier le rendu sur un appareil à encoche.

## 6. Build & test

```bash
npx cap open ios        # Xcode : signer, lancer sur simulateur/appareil
npx cap open android    # Android Studio : lancer
```

Vérifier sur appareil réel :
- la **carte MapLibre** (vérifiable seulement en natif/WebGl, pas dans l'aperçu web) ;
- la **feuille de partage** native ;
- l'**ouverture** d'Apple Plans / Google Maps ;
- la **demande de permission** de géolocalisation.

## Rappels

- Mettre à jour les données : `tools/build-gtfs.py`, `build-router.py`,
  `build-services.py`, `build-pmr.py`, `build-trafic.py`, puis `npm run build` + `npx cap sync`.
- Mentions légales / RGPD : page `/legal` (dans l'app).
