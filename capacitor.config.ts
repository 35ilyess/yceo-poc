import type { CapacitorConfig } from '@capacitor/cli';

// webDir = sortie du build web ; scheme custom pour isoler la WebView.
const config: CapacitorConfig = {
  appId: 'fr.poc.yceo',
  appName: 'Ycéo POC',
  webDir: 'www',
  server: {
    hostname: 'app',
    iosScheme: 'yceopoc',
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: false, // masqué par NativeService quand l'app est prête
      backgroundColor: '#005872',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    Geolocation: {
      // Les chaînes d'usage (iOS Info.plist / Android manifest) : voir PORTAGE.md
    },
  },
};

export default config;
