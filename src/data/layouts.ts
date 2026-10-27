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

/**
 * Handy-Map: Gebäude mittig untereinander. Zwischen zwei Gebäuden läuft der Weg im Zickzack
 * hin und her (zur einen Seite, quer, zur anderen Seite, zurück zur Mitte) – immer im Bild.
 * left/right: x der Seitenwege (bleiben auch auf schmalen Handys sichtbar), zig: Tiefe des Zickzacks.
 */
const M = { width: 260, center: 130, left: 58, right: 202, firstY: 150, zig: 46, signRoom: 18, bottom: 200 };

function mobileLayout(): Layout {
  const path: Point[] = [];
  const waypoints: number[] = [];
  const parkW = 146;
  let park = parkAt(40, 0, parkW);
  let y = M.firstY;
  // Durchgehende Schlange: Der Weg verlässt jede Station zur Seite gegenüber der Ankunft
  let arrivedFrom = M.left; // der Weg kommt am Start vom linken Kartenrand
  STOPS.forEach((stop, i) => {
    if (i > 0) {
      const prevY = y;
      const h = BUILDINGS[stop.building].h;
      const first = arrivedFrom === M.left ? M.right : M.left;
      const other = first === M.right ? M.left : M.right;
      if (i === 1) {
        // Zwischen Start und erster Station liegt links der Hundeplatz: nur ein Bogen (nach rechts)
        park = parkAt(40, prevY + 24, parkW);
        y = park.y + park.h + M.signRoom + 12 + BUILDING_GAP + h;
        path.push({ x: first, y: prevY }, { x: first, y });
        arrivedFrom = first;
      } else {
        // Zickzack: Seite → quer → andere Seite → zurück zur Mitte (Gebäude steht darüber)
        const zigY = prevY + M.zig;
        y = zigY + 10 + M.signRoom + BUILDING_GAP + h;
        path.push({ x: first, y: prevY }, { x: first, y: zigY }, { x: other, y: zigY }, { x: other, y });
        arrivedFrom = other;
      }
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
