import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./tabs/tabs.component').then((m) => m.TabsComponent),
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'lines',
        loadComponent: () => import('./pages/lines/lines.page').then((m) => m.LinesPage),
      },
      {
        path: 'lines/:id',
        loadComponent: () =>
          import('./pages/line-detail/line-detail.page').then((m) => m.LineDetailPage),
      },
      {
        path: 'stops/:id',
        loadComponent: () =>
          import('./pages/stop-detail/stop-detail.page').then((m) => m.StopDetailPage),
      },
      {
        path: 'map',
        loadComponent: () => import('./pages/map/map.page').then((m) => m.MapPage),
      },
      {
        path: 'journey',
        loadComponent: () => import('./pages/journey/journey.page').then((m) => m.JourneyPage),
      },
      {
        path: 'departures',
        loadComponent: () =>
          import('./pages/departures/departures.page').then((m) => m.DeparturesPage),
      },
      {
        path: 'nearby',
        loadComponent: () => import('./pages/nearby/nearby.page').then((m) => m.NearbyPage),
      },
      {
        path: 'trafic',
        loadComponent: () => import('./pages/trafic/trafic.page').then((m) => m.TraficPage),
      },
      {
        path: 'search',
        loadComponent: () => import('./pages/search/search.page').then((m) => m.SearchPage),
      },
      {
        path: 'tarifs',
        loadComponent: () => import('./pages/tarifs/tarifs.page').then((m) => m.TarifsPage),
      },
      {
        path: 'services',
        loadComponent: () => import('./pages/services/services.page').then((m) => m.ServicesPage),
      },
      {
        path: 'legal',
        loadComponent: () => import('./pages/legal/legal.page').then((m) => m.LegalPage),
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings.page').then((m) => m.SettingsPage),
      },
    ],
  },
];
