/**
 * Interne Pfade mit dem Basis-Pfad der Seite versehen.
 * Nötig, wenn die Seite in einem Unterordner liegt (z. B. GitHub Pages: /repo-name/kontakt).
 * Externe Adressen und Anker (#…) bleiben unverändert.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export const url = (path: string) => (path.startsWith('/') ? BASE + path : path);
