/**
 * Live-Status über PocketBase (siehe README „Live-Status mit PocketBase“).
 * Ohne PUBLIC_PB_URL beim Build ist alles abgeschaltet und die Seite bleibt rein statisch.
 */
export const LIVE = {
  /** Adresse des PocketBase-Servers, z. B. https://studio.example.com */
  pbUrl: (import.meta.env.PUBLIC_PB_URL ?? '').replace(/\/$/, ''),
  /** Zeitzone des Streamplans */
  timeZone: 'Europe/Berlin',
  /** Wie oft die Seite den Status neu abfragt (Sekunden) */
  refresh: 60,
};
