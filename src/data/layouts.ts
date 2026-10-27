/**
 * Zwei Maps aus denselben Stationen:
 * - desktop: breite Map mit dem Weg aus PATH (src/data/stations.ts), Kamera schwenkt mit
 * - mobile:  schmale Map (bis 700 px Bildschirmbreite), Gebäude mittig untereinander; zwischen zwei
 *            Gebäuden schwenkt der Weg zur Seite aus dem Bild. Die Kamera fährt nur nach unten.
 * Die Handy-Map wird automatisch aus der Reihenfolge der Stationen berechnet.
 */
import type { Point } from '../lib/path';
import { MAP, BUILDINGS, BUILDING_GAP } from './map.ts';
import { PATH, STATIONS, EXIT } from './stations.ts';
import { PARK_SHAPE } from './npc.ts';

export type LayoutKey = 'desktop' | 'mobile';

/** Ab dieser Breite und darunter gilt die Handy-Map (muss zu den CSS-Media-Queries passen) */
export const MOBILE_QUERY = '(max-width: 700px)';

export interface Park {
  x: number;
  y: number;
  w: number;
  h: number;
  bed: Point;
  bowls: Point;
  pond: { cx: number; cy: number; rx: number; ry: number };
  ducks: number;
  duckSpeed: number;
}

export interface Layout {
  width: number;
  height: number;
  path: Point[];
  /** Wegpunkt-Index je Haltepunkt (Stationen + Tür am Ende) */
  waypoints: number[];
  park: Park;
  layers: { ground: string; objects: string; canopy: string };
}

/** Alle Haltepunkte in Reihenfolge: Stationen mit Inhalt + Tür am Ende */
export const STOPS = [...STATIONS, EXIT];

/** Hundeplatz an Position (x, y) mit Breite w */
export function parkAt(x: number, y: number, w: number): Park {
  const s = PARK_SHAPE;
  return {
    x,
    y,
    w,
    h: s.h,
    bed: { x: x + s.bed.dx, y: y + s.bed.dy },
    bowls: { x: x + s.bowls.dx, y: y + s.bowls.dy },
    pond: { cx: x + w - s.pond.dxRight, cy: y + s.pond.dy, rx: s.pond.rx, ry: s.pond.ry },
    ducks: s.ducks,
    duckSpeed: s.duckSpeed,
  };
}

const desktop: Layout = {
  width: MAP.width,
  height: MAP.height,
  path: PATH,
  waypoints: STOPS.map((s) => s.waypoint),
  // Zwischen Start und erster Kurve (dort geht keine Infokarte auf)
  park: parkAt(130, 164, 173),
  layers: MAP.layers,
};

/** Handy-Map: Breite, Mitte der Gebäudespalte, Abstand der Seitenwege vom Rand, Platz unter der Tür */
const M = { width: 260, center: 130, side: 12, firstY: 150, air: 64, bottom: 200 };
/** Zu welcher Seite der Weg nach jeder Station ausschwenkt (1 = rechts, 0 = links) – bewusst unregelmäßig */
const SIDES = [1, 0, 0, 1, 0, 1, 1, 0];

function mobileLayout(): Layout {
  const path: Point[] = [];
  const waypoints: number[] = [];
  const parkW = 160;
  let park = parkAt(M.center - parkW / 2, 0, parkW);
  let y = M.firstY;
  STOPS.forEach((stop, i) => {
    if (i > 0) {
      const prevY = y;
      // Platz für den Seitenweg, das Schild und etwas Luft über dem nächsten Gebäude
      let gap = BUILDINGS[stop.building].h + BUILDING_GAP + M.air;
      // Hundeplatz zwischen Start und erster Station
      if (i === 1) {
        park = parkAt(M.center - parkW / 2, prevY + 26, parkW);
        gap += PARK_SHAPE.h + 30;
      }
      y = prevY + gap;
      const x = SIDES[(i - 1) % SIDES.length] ? M.width - M.side : M.side;
      path.push({ x, y: prevY }, { x, y });
    }
    waypoints.push(path.length);
    path.push({ x: M.center, y });
  });
  return {
    width: M.width,
    // Unter der Tür genug Platz, damit auch sie in die Bildmitte gescrollt werden kann
    height: Math.ceil((y + M.bottom) / 16) * 16,
    path,
    waypoints,
    park,
    layers: {
      ground: '/assets/map/mobile/ground.png',
      objects: '/assets/map/mobile/objects.png',
      canopy: '/assets/map/mobile/canopy.png',
    },
  };
}

export const LAYOUTS: Record<LayoutKey, Layout> = { desktop, mobile: mobileLayout() };
