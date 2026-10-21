import { Injectable } from '@angular/core';
import { environment, NetworkConfig } from '../../environments/environment';

const LS_TOKEN = 'yceo.navitia.token';
const LS_COVERAGE = 'yceo.navitia.coverage';

/**
 * Expose la config reseau (environment.ts) et stocke les reglages utilisateur
 * (token Navitia + couverture) en localStorage — jamais en dur dans le code.
 */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  readonly network: NetworkConfig = environment.network;

  get navitiaToken(): string {
    try {
      return localStorage.getItem(LS_TOKEN) || this.network.navitia.token || '';
    } catch {
      return this.network.navitia.token || '';
    }
  }

  set navitiaToken(value: string) {
    try {
      localStorage.setItem(LS_TOKEN, value.trim());
    } catch {
      /* mode prive : ignore */
    }
  }

  get coverage(): string {
    try {
      return localStorage.getItem(LS_COVERAGE) || this.network.navitia.defaultCoverage;
    } catch {
      return this.network.navitia.defaultCoverage;
    }
  }

  set coverage(value: string) {
    try {
      localStorage.setItem(LS_COVERAGE, value.trim());
    } catch {
      /* ignore */
    }
  }

  get hasNavitia(): boolean {
    return !!this.navitiaToken;
  }
}
