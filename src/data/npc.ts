/**
 * Hundeplatz mit NPCs: Französische Bulldogge (Mochi) und Entenküken laufen frei herum (Easter Egg).
 * Alle Koordinaten in Map-Pixeln. Der Platz bleibt beim Erzeugen der Grafik frei von
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

/**
 * Form des Hundeplatzes (Körbchen, Näpfe, Teich relativ zur linken oberen Ecke).
 * Wo der Platz liegt, steht je Map in src/data/layouts.ts. Er darf nicht dort liegen, wo eine
 * Infokarte aufgeht (sonst wäre der Hund verdeckt und nicht anklickbar).
 */
export const PARK_SHAPE = {
  h: 58,
  /** Mitte des Körbchens (dort schläft sie) */
  bed: { dx: 18, dy: 47 },
  /** Linker Napf (Futter), rechts daneben Wasser */
  bowls: { dx: 40, dy: 51 },
  /** Teich für die Enten; dxRight = Abstand der Teichmitte vom rechten Rand */
  pond: { dxRight: 29, dy: 22, rx: 18, ry: 9 },
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
