/**
 * Grafik- und Bewegungs-Einstellungen der Map.
 * Alle Koordinaten sind Map-Pixel (Originalauflösung der PNGs, vor dem Skalieren).
 */
import { PATH, type BuildingType } from './stations.ts';

/** Platz unter der Tür am Ende des Wegs (darunter folgt der Footer) */
const BOTTOM_SPACE = 48;
const lastY = Math.max(...PATH.map((p) => p.y));

export const MAP = {
  /** Breite der Ebenen in public/assets/map/*.png */
  width: 480,
  /** Höhe wächst mit dem Weg (auf volle Kacheln gerundet) */
  height: Math.ceil((lastY + BOTTOM_SPACE) / 16) * 16,
  /** Kachelraster der Grafik (nur Orientierung für eigene Tilesets) */
  tile: 16,
  layers: {
    ground: '/assets/map/ground.png',
    objects: '/assets/map/objects.png',
    canopy: '/assets/map/canopy.png',
  },
  /** Kleinster/größter ganzzahliger Zoom und Ziel-Ausschnitt (Map-Pixel pro kürzerer Bildschirmseite) */
  zoom: { min: 2, max: 6, viewSpan: 200 },
} as const;

/**
 * Gebäude-Grafiken (public/assets/buildings/<typ>.png). Das Gebäude steht mittig über
 * seinem Wegpunkt, die Unterkante (Tür) knapp über dem Weg.
 */
export const BUILDINGS: Record<BuildingType, { w: number; h: number; frames?: number }> = {
  studio: { w: 72, h: 64 },
  house: { w: 64, h: 60 },
  tower: { w: 48, h: 84 },
  arcade: { w: 84, h: 60 },
  cinema: { w: 80, h: 64 },
  tavern: { w: 76, h: 62 },
  post: { w: 64, h: 58 },
  /** 2 Frames nebeneinander: zu / offen (offen, solange die Figur davor steht) */
  door: { w: 48, h: 56, frames: 2 },
};
/** Abstand Unterkante Gebäude → Wegmitte */
export const BUILDING_GAP = 13;
/** Halbe Wegbreite (der Weg ist 20 Map-Pixel breit) */
export const PATH_HALF = 10;

/** Linke obere Ecke eines Gebäudes an Wegpunkt p */
export function buildingBox(type: BuildingType, p: { x: number; y: number }) {
  const { w, h } = BUILDINGS[type];
  return { x: Math.round(p.x - w / 2), y: p.y - BUILDING_GAP - h, w, h };
}

export const HERO = {
  src: '/assets/sprites/hero.png',
  /** Größe eines Frames im Sprite-Sheet */
  frameW: 16,
  frameH: 24,
  /** Frames pro Laufrichtung (Spalten); Zeilen: unten, links, rechts, oben */
  frames: 4,
  /** Fußpunkt im Frame: dieser Pixel steht genau auf dem Weg */
  anchorX: 8,
  anchorY: 22,
  /** Lauftempo in Map-Pixeln pro Sekunde. Kleiner = Figur fällt beim schnellen Scrollen weiter zurück */
  speed: 120,
  /**
   * Sprint: Ist die Figur weiter als `sprintFrom` Map-Pixel hinter dem Ziel, läuft sie schneller
   * (linear bis höchstens `sprintMax` × speed). So fällt sie sichtbar zurück, holt aber auch
   * große Sprünge (Navigation) in wenigen Sekunden auf. sprintMax: 1 = kein Sprint.
   */
  sprintFrom: 160,
  sprintMax: 4,
  /** Zurückgelegte Strecke (Map-Pixel) für einen kompletten Laufzyklus */
  stride: 32,
} as const;

export const SCROLL = {
  /** Anteil jedes Abschnitts (vorne + hinten zusammen), in dem das Ziel auf der Station bleibt */
  hold: 0.4,
  /**
   * Einrasten: Endet das Scrollen zwischen zwei Stationen, scrollt die Seite selbst zur nächsten.
   * Aus = freies Scrollen (die Figur bleibt dann auch mal zwischen zwei Stationen stehen).
   */
  snap: false,
  /**
   * Magnet (nur Handy): Hört man in der Halte-Zone einer Station auf zu scrollen, rückt die Seite
   * sanft die letzten Pixel nach, damit Schild, Gebäude und Figur ganz zu sehen sind.
   */
  magnet: true,
  /** Höhe der Station im Bild (Desktop): 0 = oben, 1 = unten */
  focus: 0.45,
  /**
   * Handy: Die Station steht automatisch so, dass das Gebäude direkt unter der Kopfzeile Platz hat;
   * höchstens auf dieser Höhe (unten liegt die Infoleiste).
   */
  focusMobile: 0.42,
} as const;
