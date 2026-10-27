/**
 * Hundeplatz mit NPCs: Französische Bulldogge (Mochi) und Entenküken laufen frei herum (Easter Egg).
 * Alle Koordinaten in Map-Pixeln. Der Platz (PARK) bleibt beim Erzeugen der Grafik frei von
 * Bäumen und Deko; Körbchen, Näpfe und Teich zeichnet `npm run assets` hinein.
 */

export const DOG = {
  name: 'Mochi',
  kicker: 'Easter Egg gefunden!',
  text: 'Das ist Mochi, Pixies Französische Bulldogge und selbsternannte Chef-Moderatorin. Bei jedem Raid bellt sie einmal laut – danach wird geschlafen.',
  facts: ['Hat noch nie eine Ente erwischt (sagt sie selbst)', 'Liegt bei Horror-Streams immer unter der Decke', 'Lieblingsgeräusch: das Rascheln der Snacktüte'],
  /** Tempo in Map-Pixeln pro Sekunde */
  walk: 22,
  run: 64,
};

export const PARK = {
  /**
   * Freier Bereich, in dem sich Hund und Enten bewegen. Liegt zwischen zwei Wegabschnitten, wo
   * keine Infokarte aufgeht (sonst wäre der Hund verdeckt und nicht anklickbar).
   */
  x: 130,
  y: 164,
  w: 173,
  h: 58,
  /** Mitte des Körbchens (dort schläft sie) */
  bed: { x: 148, y: 211 },
  /** Linker Napf (Futter), rechts daneben Wasser */
  bowls: { x: 170, y: 215 },
  /** Teich für die Enten */
  pond: { cx: 274, cy: 186, rx: 18, ry: 9 },
  ducks: 3,
  duckSpeed: 14,
};

/** Sprite-Sheets (public/assets/sprites/) */
export const NPC_SPRITES = {
  /** 4 Frames × 5 Zeilen: laufen rechts, laufen links, fressen rechts, fressen links, schlafen */
  dog: { src: '/assets/sprites/dog.png', frameW: 16, frameH: 12, rows: 5, anchorX: 8, anchorY: 11 },
  /** 4 Frames × 4 Zeilen: laufen rechts, laufen links, schwimmen rechts, schwimmen links */
  duck: { src: '/assets/sprites/duck.png', frameW: 8, frameH: 8, rows: 4, anchorX: 4, anchorY: 7 },
};
