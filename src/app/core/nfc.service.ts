import { Injectable } from '@angular/core';

/**
 * STUB NFC — lecture de carte billettique sans contact (Calypso / ISO 7816).
 *
 * Dans l'app STAR, cette couche est un plugin Capacitor natif ("TicketingNfcBridgePlugin")
 * qui delegue au SDK Conduent (com.conduent.transit.ticketingsdk) et pilote CoreNFC :
 *   SELECT AID 1TIC.ICA  ->  READ RECORD (environnement, contrats, compteurs, journal)
 *
 * Ce POC web ne peut PAS faire ca :
 *  - Web NFC (navigator.nfc / NDEFReader) ne gere que les tags NDEF, pas l'APDU ISO 7816.
 *  - L'APDU brut necessite un plugin natif : CoreNFC (NFCTagReaderSession) sur iOS,
 *    IsoDep sur Android. A implementer comme plugin Capacitor custom pour une vraie appli.
 *  - Toute ECRITURE/rechargement exige une session securisee Calypso signee par un SAM
 *    cote serveur (cles jamais embarquees). Ici : lecture seule au mieux.
 *
 * On expose une API stable pour que l'UI soit prete ; le natif se branchera derriere.
 */
export interface CardSummary {
  serialNumber: string;
  contracts: { label: string; remaining?: number; validUntil?: string }[];
  lastEvents: { date: string; stop?: string }[];
}

@Injectable({ providedIn: 'root' })
export class NfcService {
  /** Vrai uniquement si un plugin natif de lecture Calypso est enregistre. */
  isAvailable(): boolean {
    return false; // POC web : pas de pont natif
  }

  async readCard(): Promise<CardSummary> {
    throw new Error(
      "Lecture NFC indisponible dans le POC web. Necessite un plugin Capacitor natif " +
        '(CoreNFC/IsoDep + SELECT 1TIC.ICA) sur un appareil equipe NFC.',
    );
  }
}
