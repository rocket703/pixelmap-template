/**
 * Erzeugt alle Platzhalter-Grafiken in public/assets/ (ohne externe Pakete).
 *   npm run assets
 *
 * Weg, Stationen und Gebäude werden aus src/data/stations.ts und src/data/map.ts gelesen –
 * nach Änderungen am PATH oder an den Stationen neu erzeugen.
 * Eigene Grafiken (Aseprite o. Ä.) ersetzen diese Dateien 1:1, siehe public/assets/ASSETS.md.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MAP, HERO, BUILDINGS, PATH_HALF, buildingBox } from '../src/data/map.ts';
import { PATH, STATIONS, EXIT } from '../src/data/stations.ts';
import { PARK, NPC_SPRITES } from '../src/data/npc.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/assets');
const W = MAP.width;
const H = MAP.height;

/* ------------------------------------------------------------------ PNG */

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** Schreibt eine Indexed-PNG (≤ 256 Farben) oder sonst RGBA */
function encodePNG(img) {
  const { w, h, d } = img;
  const index = new Map();
  const palette = [];
  const idx = new Uint8Array(w * h);
  let indexed = true;
  for (let i = 0; i < w * h && indexed; i++) {
    const a = d[i * 4 + 3];
    const key = a === 0 ? 0 : ((d[i * 4] << 24) | (d[i * 4 + 1] << 16) | (d[i * 4 + 2] << 8) | a) >>> 0;
    let p = index.get(key);
    if (p === undefined) {
      if (palette.length === 256) indexed = false;
      p = palette.length;
      index.set(key, p);
      palette.push(key);
    }
    idx[i] = p;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = indexed ? 3 : 6;
  const bpp = indexed ? 1 : 4;
  const raw = Buffer.alloc((w * bpp + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * bpp + 1);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (indexed) raw[row + 1 + x] = idx[i];
      else for (let c = 0; c < 4; c++) raw[row + 1 + x * 4 + c] = d[i * 4 + c];
    }
  }
  const parts = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr)];
  if (indexed) {
    const plte = Buffer.alloc(palette.length * 3);
    const trns = Buffer.alloc(palette.length);
    palette.forEach((k, i) => {
      plte[i * 3] = k >>> 24;
      plte[i * 3 + 1] = (k >>> 16) & 255;
      plte[i * 3 + 2] = (k >>> 8) & 255;
      trns[i] = k & 255;
    });
    parts.push(chunk('PLTE', plte), chunk('tRNS', trns));
  }
  parts.push(chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

/* ------------------------------------------------------------- Zeichnen */

const hex = (s, a = 255) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), a];

class Img {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  px(x, y, c) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
    const i = (y * this.w + x) * 4;
    const a = c[3] / 255;
    if (a >= 1 || this.d[i + 3] === 0) {
      this.d.set(c, i);
      return;
    }
    for (let k = 0; k < 3; k++) this.d[i + k] = Math.round(c[k] * a + this.d[i + k] * (1 - a));
    this.d[i + 3] = Math.max(this.d[i + 3], c[3]);
  }
  get(x, y) {
    const i = (y * this.w + x) * 4;
    return [...this.d.subarray(i, i + 4)];
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.px(x, y, c);
  }
  /** Ausschnitt eines anderen Bildes (mit Transparenz) hineinkopieren */
  blit(src, sx, sy, w, h, dx, dy) {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const X = sx + x;
        const Y = sy + y;
        if (X < 0 || Y < 0 || X >= src.w || Y >= src.h) continue;
        const c = src.get(X, Y);
        if (c[3]) this.px(dx + x, dy + y, c);
      }
  }
  /** Ganzzahlig vergrößern (nearest neighbour) */
  scaled(k) {
    const out = new Img(this.w * k, this.h * k);
    for (let y = 0; y < out.h; y++)
      for (let x = 0; x < out.w; x++) {
        const s = ((Math.floor(y / k) * this.w + Math.floor(x / k)) * 4);
        out.d.set(this.d.subarray(s, s + 4), (y * out.w + x) * 4);
      }
    return out;
  }
  save(file) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, encodePNG(this));
    console.log(`  ${file.replace(ROOT + '/', '')}  ${this.w}×${this.h}`);
  }
}

/** Deterministisches Rauschen 0..1 pro Pixel */
function hash(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Weiches Rauschen 0..1 (Value Noise) für organische Flächen statt Kachelmuster */
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = (x - xi) ** 2 * (3 - 2 * (x - xi));
  const v = (y - yi) ** 2 * (3 - 2 * (y - yi));
  const a = hash(xi, yi, s);
  const b = hash(xi + 1, yi, s);
  const c = hash(xi, yi + 1, s);
  const d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function distToSeg(px, py, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - a.x - dx * t, py - a.y - dy * t);
}
function distToLine(px, py, pts) {
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) d = Math.min(d, distToSeg(px, py, pts[i - 1], pts[i]));
  return d;
}

function outlineShape(img, inside, x0, y0, x1, y1, paint, outline = C.outline) {
  for (let y = y0 - 1; y <= y1 + 1; y++)
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      if (inside(x, y)) img.px(x, y, paint(x, y));
      else if (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)) img.px(x, y, outline);
    }
}

/* ---------------------------------------------------------- Palette */

const C = {
  outline: hex('#1a1030'),
  grass: hex('#4f9a5c'),
  grassDeep: hex('#468e55'),
  grassPatch: hex('#5aa766'),
  grassDark: hex('#3a7a4a'),
  grassLight: hex('#7cc47a'),
  stone: hex('#a99cc4'),
  stone2: hex('#9b8eb8'),
  stoneLight: hex('#cfc4e6'),
  stoneDark: hex('#7d6f9c'),
  pathEdge: hex('#6a5d8a'),
  pad: hex('#3ee6ff'),
  padLight: hex('#b5f6ff'),
  padDark: hex('#1f8fb0'),
  rock: hex('#8e86a8'),
  rockLight: hex('#c2bcd8'),
  rockDark: hex('#5e5680'),
  trunk: hex('#6e4430'),
  trunkDark: hex('#452818'),
  leafOutline: hex('#12281e'),
  leaf: { base: hex('#2f7a4a'), mid: hex('#3f9a58'), light: hex('#6fcf7a'), dark: hex('#225c3a') },
  blossom: { base: hex('#e86aa8'), mid: hex('#f58cc0'), light: hex('#ffc2e0'), dark: hex('#b8467e') },
  shadow: [16, 10, 40, 70],
  glow: [255, 214, 140, 46],
  white: hex('#ffffff'),
  wood: hex('#a0623a'),
  woodDark: hex('#5e3420'),
  woodLight: hex('#c8854e'),
  neonPink: hex('#ff4fa3'),
  neonCyan: hex('#3ee6ff'),
  neonPurple: hex('#9b6bff'),
  live: hex('#ff3b5c'),
  yellow: hex('#ffd34a'),
  glass: hex('#2a3f6e'),
  glassLight: hex('#5f8fd8'),
  flowers: [hex('#ffe066'), hex('#ff6fb5'), hex('#ffffff'), hex('#b48cff'), hex('#6ee8ff')],
  water: hex('#3c94dc'),
  waterLight: hex('#6cc4f0'),
  foam: hex('#d8f4ff'),
  sand: hex('#e6cf8c'),
  sandDark: hex('#cdb173'),
};

// Minischrift für Schilder (3–5 px breit, 5 px hoch)
const FONT = {
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  G: ['0111', '1000', '1011', '1001', '0111'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['10001', '11011', '10101', '10001', '10001'],
  N: ['1001', '1101', '1011', '1001', '1001'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  W: ['10001', '10001', '10101', '11011', '10001'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  ' ': ['0', '0', '0', '0', '0'],
};
const textWidth = (s, k = 1) => [...s].reduce((w, ch) => w + (FONT[ch][0].length + 1) * k, -k);
function text(img, s, x, y, col, k = 1) {
  for (const ch of s) {
    const g = FONT[ch];
    if (!g) throw new Error(`Zeichen "${ch}" fehlt in FONT`);
    g.forEach((row, j) => [...row].forEach((b, i) => b === '1' && img.rect(x + i * k, y + j * k, k, k, col)));
    x += (g[0].length + 1) * k;
  }
}

/* ------------------------------------------------------- Prüfungen */

// Weg inkl. Einstieg vom linken Kartenrand; er endet an der Tür (EXIT)
const ROAD = [{ x: 0, y: PATH[0].y }, ...PATH];
const STOPS = [...STATIONS, EXIT];

for (let i = 1; i < PATH.length; i++)
  if (PATH[i].y < PATH[i - 1].y)
    throw new Error(`PATH[${i}] liegt höher als PATH[${i - 1}] – der Weg muss immer nach unten führen.`);
STOPS.forEach((s, i) => {
  if (i && s.waypoint <= STOPS[i - 1].waypoint) throw new Error(`Station "${s.id}": waypoint muss größer als bei der vorigen sein.`);
  if (!PATH[s.waypoint]) throw new Error(`Station "${s.id}": PATH[${s.waypoint}] gibt es nicht.`);
});

const boxes = STOPS.map((s) => ({ id: s.id, type: s.building, ...buildingBox(s.building, PATH[s.waypoint]) }));
const overlaps = (a, b, m = 0) => a.x - m < b.x + b.w && a.x + a.w + m > b.x && a.y - m < b.y + b.h && a.y + a.h + m > b.y;
boxes.forEach((b, i) => {
  if (b.x < 0 || b.x + b.w > W || b.y < 0) throw new Error(`Gebäude von "${b.id}" ragt aus der Map.`);
  boxes.slice(i + 1).forEach((o) => {
    if (overlaps(b, o, 4)) throw new Error(`Gebäude von "${b.id}" und "${o.id}" überlappen.`);
  });
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + b.w; x++)
      if (distToLine(x + 0.5, y + 0.5, ROAD) < PATH_HALF + 1)
        throw new Error(`Gebäude von "${b.id}" steht auf dem Weg (bei ${x}, ${y}). Wegpunkte oder Station verschieben.`);
});

/* -------------------------------------------------------- Boden-Ebene */

const pathDist = new Float32Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) pathDist[y * W + x] = distToLine(x + 0.5, y + 0.5, ROAD);
const onPath = (x, y) => x >= 0 && y >= 0 && x < W && y < H && pathDist[y * W + x] < PATH_HALF + 0.5;

const reserved = boxes.map((b) => ({ x: b.x - 4, y: b.y - 4, w: b.w + 8, h: b.h + 10 }));
// Hundeplatz bleibt frei von Bäumen und Deko
reserved.push({ x: PARK.x, y: PARK.y, w: PARK.w, h: PARK.h });
for (let y = PARK.y; y < PARK.y + PARK.h; y++)
  for (let x = PARK.x; x < PARK.x + PARK.w; x++)
    if (distToLine(x + 0.5, y + 0.5, ROAD) < PATH_HALF + 2) throw new Error(`Hundeplatz (PARK) liegt auf dem Weg (bei ${x}, ${y}).`);
const blocked = (x, y, w, h) => reserved.some((r) => overlaps({ x, y, w, h }, r));

const lights = [];

function buildGround() {
  const img = new Img(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = pathDist[y * W + x];
      const h = hash(x, y, 1);
      const wobble = hash(x >> 1, y >> 1, 7) < 0.35 ? -1 : 0;
      let c;
      if (d < PATH_HALF + wobble) {
        // Pflaster: Reihen à 4 px, Steine 6 px breit, jede zweite Reihe versetzt
        const row = Math.floor(y / 4);
        const off = (row % 2) * 3;
        const col = Math.floor((x + off) / 6);
        if (d > PATH_HALF - 1.8 + wobble) c = C.pathEdge;
        else if (y % 4 === 3 || (x + off) % 6 === 5) c = C.stoneDark;
        else {
          const n = hash(col, row, 2);
          c = n < 0.2 ? C.stoneLight : n < 0.55 ? C.stone2 : C.stone;
          if (h < 0.04) c = C.stoneDark;
        }
      } else {
        // Organische Flecken in drei Tönen; Rand in 2×2-Blöcken, damit er zum Pixelraster passt
        const n = vnoise(x / 26, y / 26, 3) * 0.6 + vnoise(x / 9, y / 9, 4) * 0.4 + (hash(x >> 1, y >> 1, 5) - 0.5) * 0.06;
        c = n < 0.36 ? C.grassDeep : n > 0.64 ? C.grassPatch : C.grass;
        if (d < PATH_HALF + 2.5) c = C.grassDark; // Schattenkante am Weg
        else if (hash(x >> 1, y >> 1, 6) > 0.996) c = C.grassLight;
      }
      img.px(x, y, c);
    }

  // Grasbüschel und Blumen kachelweise (16×16)
  for (let ty = 0; ty < H / MAP.tile; ty++)
    for (let tx = 0; tx < W / MAP.tile; tx++) {
      for (let k = 0; k < 3; k++) {
        const x = tx * 16 + Math.floor(hash(tx, ty, 10 + k) * 14) + 1;
        const y = ty * 16 + Math.floor(hash(tx, ty, 20 + k) * 13) + 2;
        if (onPath(x, y) || onPath(x - 1, y - 1) || onPath(x + 1, y - 1)) continue;
        img.px(x, y, C.grassDark);
        img.px(x - 1, y - 1, C.grassDark);
        img.px(x + 1, y - 1, C.grassDark);
      }
      if (hash(tx, ty, 30) < 0.26) {
        const x = tx * 16 + 4 + Math.floor(hash(tx, ty, 31) * 8);
        const y = ty * 16 + 4 + Math.floor(hash(tx, ty, 32) * 8);
        if ([[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => onPath(x + dx, y + dy) || pathDist[(y + dy) * W + x + dx] < PATH_HALF + 3)) continue;
        const col = C.flowers[Math.floor(hash(tx, ty, 33) * C.flowers.length)];
        img.px(x - 1, y, col);
        img.px(x + 1, y, col);
        img.px(x, y - 1, col);
        img.px(x, y + 1, col);
        img.px(x, y, hex('#f7a823'));
      }
    }

  // Ententeich auf dem Hundeplatz: Sandufer, helles Flachwasser, Wellen
  {
    const { cx, cy, rx, ry } = PARK.pond;
    for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y++)
      for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
        const wob = (hash(x >> 1, y >> 1, 140) - 0.5) * 0.12;
        const e = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + wob;
        if (e > 1.32) continue;
        let c = e > 1 ? (hash(x, y, 141) < 0.2 ? C.sandDark : C.sand) : e > 0.8 ? C.waterLight : C.water;
        if (e <= 0.8 && (y + (x >> 3)) % 5 === 0 && hash(x >> 2, y, 142) < 0.35) c = C.waterLight;
        if (e > 0.94 && e <= 1) c = C.foam;
        img.px(x, y, c);
      }
  }

  // Speicherpunkte: leuchtender Ring an jeder Station
  for (const s of STATIONS) {
    const p = PATH[s.waypoint];
    img.ellipse(p.x, p.y + 1, 10, 5.5, C.padDark);
    img.ellipse(p.x, p.y + 1, 9, 4.5, C.pad);
    img.ellipse(p.x, p.y + 1, 6.5, 3, C.padLight);
    img.ellipse(p.x, p.y + 1, 5, 2, hex('#e6fcff'));
  }

  // Lichtkegel der Laternen
  for (const l of lights) {
    img.ellipse(l.x, l.y + 2, 18, 9, C.glow);
    img.ellipse(l.x, l.y + 2, 11, 5.5, C.glow);
  }
  return img;
}

/* ------------------------------------------------ Objekte & Baumkronen */

const objects = new Img(W, H);
const canopy = new Img(W, H);

function tree(x, base, r, leaf = C.leaf) {
  objects.ellipse(x, base, r * 0.7, 4, C.shadow);
  for (let y = base - 14; y <= base; y++) {
    objects.px(x - 3, y, C.outline);
    objects.px(x + 3, y, C.outline);
    for (let k = -2; k <= 2; k++) objects.px(x + k, y, k < 0 ? C.trunkDark : C.trunk);
  }
  objects.rect(x - 4, base - 1, 9, 1, C.outline);
  const cy = base - 14 - r * 0.55;
  const blobs = [
    [0, 0, r],
    [-r * 0.55, r * 0.2, r * 0.62],
    [r * 0.55, r * 0.2, r * 0.62],
    [0, -r * 0.45, r * 0.68],
  ];
  const inside = (px, py) => blobs.some(([bx, by, br]) => (px + 0.5 - x - bx) ** 2 + (py + 0.5 - cy - by) ** 2 <= br * br);
  outlineShape(
    canopy,
    inside,
    Math.floor(x - r * 1.3),
    Math.floor(cy - r * 1.2),
    Math.ceil(x + r * 1.3),
    Math.ceil(cy + r * 1.1),
    (px, py) => {
      const s = (px - x) * 0.6 + (py - cy);
      const n = hash(px, py, 50);
      if (s < -r * 0.55 && n > 0.25) return leaf.light;
      if (s < -r * 0.2) return n < 0.15 ? leaf.light : leaf.mid;
      if (s > r * 0.55) return n < 0.3 ? leaf.dark : leaf.base;
      return n < 0.06 ? leaf.dark : n > 0.94 ? leaf.mid : leaf.base;
    },
    C.leafOutline,
  );
}

function rock(cx, cy, rx, ry) {
  objects.ellipse(cx + 1, cy + ry - 1, rx + 1, 2, C.shadow);
  const inside = (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  outlineShape(objects, inside, cx - rx, cy - ry, cx + rx, cy + ry, (x, y) =>
    x - cx + (y - cy) * 1.4 < -rx * 0.35 ? C.rockLight : y - cy > ry * 0.35 ? C.rockDark : C.rock,
  );
}

function bush(cx, cy, r) {
  objects.ellipse(cx, cy + r - 1, r + 1, 2, C.shadow);
  const inside = (x, y) => (x + 0.5 - cx) ** 2 + ((y + 0.5 - cy) * 1.2) ** 2 <= r * r;
  outlineShape(objects, inside, cx - r, cy - r, cx + r, cy + r, (x, y) =>
    x - cx + y - cy < -r * 0.4 ? C.leaf.light : hash(x, y, 60) < 0.12 ? C.neonPink : C.leaf.mid,
  C.leafOutline);
}

/** Kristall-Gruppe (leuchtet in Pink oder Cyan) */
function crystal(x, y, col, light) {
  objects.ellipse(x, y, 6, 2, C.shadow);
  const spikes = [
    [-3, 7, 2],
    [0, 11, 2],
    [3, 6, 2],
  ];
  for (const [dx, hgt, hw] of spikes) {
    const inside = (px, py) => {
      const t = y - py;
      if (t < 0 || t > hgt) return false;
      const half = t > hgt - 3 ? (hgt - t) * 0.7 : hw;
      return Math.abs(px + 0.5 - (x + dx + 0.5)) <= half;
    };
    outlineShape(objects, inside, x + dx - hw - 1, y - hgt, x + dx + hw + 1, y, (px) => (px <= x + dx ? light : col));
  }
}

function mushroom(x, y) {
  objects.rect(x - 1, y - 3, 3, 4, C.outline);
  objects.px(x, y - 2, hex('#f4efff'));
  objects.px(x, y - 1, hex('#f4efff'));
  const inside = (px, py) => ((px + 0.5 - x - 0.5) / 3.5) ** 2 + ((py + 0.5 - (y - 4)) / 2.2) ** 2 <= 1 && py <= y - 3;
  outlineShape(objects, inside, x - 4, y - 7, x + 4, y - 3, (px, py) => (hash(px, py, 80) < 0.25 ? C.white : C.neonPurple));
}

/** Laterne: Pfahl in objects, Lampe in canopy (Figur läuft davor/dahinter stimmig) */
function lamp(x, y) {
  lights.push({ x, y });
  objects.ellipse(x, y, 4, 1.5, C.shadow);
  objects.rect(x - 1, y - 22, 3, 23, C.outline);
  objects.rect(x, y - 21, 1, 21, hex('#4a3f6b'));
  objects.rect(x - 2, y - 1, 5, 2, C.outline);
  canopy.rect(x - 3, y - 29, 7, 8, C.outline);
  canopy.rect(x - 2, y - 28, 5, 6, C.yellow);
  canopy.rect(x - 2, y - 28, 5, 1, hex('#fff3b0'));
  canopy.rect(x - 1, y - 31, 3, 2, C.outline);
  canopy.ellipse(x + 0.5, y - 25, 7, 6, [255, 220, 120, 40]);
}

/* --------------------------------------------------------- Platzierung */

const taken = [];
const free = (x, y, w, h, gap = 6) =>
  x > 4 && x + w < W - 4 && y > 4 && y + h < H - 4 &&
  !blocked(x, y, w, h) &&
  !taken.some((t) => overlaps({ x, y, w, h }, t, 2)) &&
  [[x, y], [x + w, y], [x, y + h], [x + w, y + h], [x + w / 2, y + h / 2]].every(([px, py]) => distToLine(px, py, ROAD) > PATH_HALF + gap);

// Laternen an jeder zweiten Wegecke, leicht nach außen versetzt
PATH.forEach((p, i) => {
  if (i % 2 === 0 || i === PATH.length - 1) return;
  for (const [dx, dy] of [[-18, -6], [18, -6], [-18, 18], [18, 18]]) {
    const x = p.x + dx;
    const y = p.y + dy;
    if (free(x - 4, y - 32, 9, 34, 3)) {
      lamp(x, y);
      taken.push({ x: x - 8, y: y - 34, w: 17, h: 38 });
      return;
    }
  }
});

// Kristalle, Pilze, Steine und Büsche verstreut in Wegnähe
for (let gy = 20; gy < H - 20; gy += 26)
  for (let gx = 16; gx < W - 16; gx += 30) {
    const x = Math.round(gx + (hash(gx, gy, 90) - 0.5) * 16);
    const y = Math.round(gy + (hash(gx, gy, 91) - 0.5) * 14);
    const d = distToLine(x, y, ROAD);
    if (d > 70 || hash(gx, gy, 92) > 0.42) continue;
    const kind = hash(gx, gy, 93);
    if (kind < 0.22) {
      if (!free(x - 7, y - 12, 14, 14)) continue;
      const pink = hash(gx, gy, 94) < 0.5;
      crystal(x, y, pink ? C.neonPink : C.neonCyan, pink ? hex('#ffc2e0') : hex('#c8fbff'));
      taken.push({ x: x - 7, y: y - 12, w: 14, h: 14 });
    } else if (kind < 0.42) {
      if (!free(x - 5, y - 8, 10, 9)) continue;
      mushroom(x, y);
      mushroom(x + 6, y + 2);
      taken.push({ x: x - 5, y: y - 8, w: 16, h: 11 });
    } else if (kind < 0.7) {
      const rx = 4 + Math.round(hash(gx, gy, 95) * 3);
      if (!free(x - rx - 1, y - 4, rx * 2 + 2, 9)) continue;
      rock(x, y, rx, 3 + (rx > 5 ? 1 : 0));
      taken.push({ x: x - rx - 1, y: y - 4, w: rx * 2 + 2, h: 9 });
    } else {
      if (!free(x - 6, y - 6, 12, 12)) continue;
      bush(x, y, 5);
      taken.push({ x: x - 6, y: y - 6, w: 12, h: 12 });
    }
  }

// Bäume: dichter Wald am Rand und weit weg vom Weg, vereinzelt (auch Kirschblüten) in Wegnähe
const trees = [];
for (let gy = 6; gy < H + 20; gy += 22)
  for (let gx = 4; gx < W + 10; gx += 24) {
    const x = Math.round(gx + (hash(gx, gy, 70) - 0.5) * 14 + ((gy / 22) % 2) * 12);
    const y = Math.round(gy + (hash(gx, gy, 71) - 0.5) * 10);
    const r = 13 + Math.round(hash(gx, gy, 72) * 6);
    const d = distToLine(x, y, ROAD);
    const p = x < 26 || x > W - 26 || d > 64 ? 0.9 : d > 36 ? 0.35 : 0.08;
    if (hash(gx, gy, 73) > p) continue;
    if (d < 22) continue;
    const cy = y - 14 - r * 0.55;
    const box = { x: x - r * 1.3, y: cy - r * 1.2, w: r * 2.6, h: y - (cy - r * 1.2) + 4 };
    if (blocked(box.x, box.y, box.w, box.h)) continue;
    if (taken.some((t) => overlaps({ x: x - 6, y: y - 16, w: 12, h: 18 }, t))) continue;
    if (STOPS.some((s) => Math.hypot(PATH[s.waypoint].x - x, PATH[s.waypoint].y - 12 - cy) < r + 16)) continue;
    if (trees.some(([tx, ty]) => Math.hypot(tx - x, ty - y) < 16)) continue;
    trees.push([x, y, r, hash(gx, gy, 74) < 0.18]);
  }
trees.sort((a, b) => a[1] - b[1]).forEach(([x, y, r, pink]) => tree(x, y, r, pink ? C.blossom : C.leaf));

/* ------------------------------------------------------- Hundeplatz */

// Körbchen mit roter Decke und Kissen
{
  const { x, y } = PARK.bed;
  objects.ellipse(x + 1, y + 3, 12, 3, C.shadow);
  outlineShape(objects, (px, py) => ((px + 0.5 - x) / 10) ** 2 + ((py + 0.5 - y) / 5.5) ** 2 <= 1, x - 11, y - 6, x + 11, y + 6, (px, py) =>
    (px + py) % 3 === 0 ? C.woodDark : py < y - 2 ? C.woodLight : C.wood,
  );
  objects.ellipse(x, y - 0.5, 7, 3.2, hex('#9a1a36'));
  objects.ellipse(x, y - 1, 6.2, 2.6, hex('#d02448'));
  objects.rect(x - 4, y - 3, 3, 1, hex('#ff5a78'));
  objects.rect(x + 2, y - 2, 4, 2, hex('#f4efe6')); // Kissen
}
// Näpfe: Futter (lila) und Wasser (cyan)
for (const [i, rim, fill] of [[0, C.neonPurple, hex('#7a4a26')], [1, C.neonCyan, C.waterLight]]) {
  const x = PARK.bowls.x + i * 10;
  const y = PARK.bowls.y;
  objects.ellipse(x + 0.5, y + 2, 5, 1.5, C.shadow);
  outlineShape(objects, (px, py) => ((px + 0.5 - x - 0.5) / 4) ** 2 + ((py + 0.5 - y) / 2.2) ** 2 <= 1, x - 4, y - 3, x + 4, y + 3, () => rim);
  objects.ellipse(x + 0.5, y - 0.5, 2.6, 1, fill);
  if (i === 0) [[-1, -1], [1, -1], [0, 0]].forEach(([dx, dy]) => objects.px(x + dx, y + dy - 0.5, hex('#4e2e16')));
}
// Seerose im Teich
objects.ellipse(PARK.pond.cx + 9, PARK.pond.cy + 3, 3, 1.6, C.leaf.mid);
objects.px(PARK.pond.cx + 9, PARK.pond.cy + 2, C.neonPink);

/** Französische Bulldogge (fawn/karamell, dunkle Maske, große Fledermausohren), 16×12, Blick nach rechts */
const DOG_COLORS = {
  k: hex('#2a1610'),
  F: hex('#c98f55'),
  s: hex('#a06a3a'),
  h: hex('#e2b27a'),
  m: hex('#4a2e22'),
  p: hex('#d9867a'),
  n: hex('#120a08'),
  e: hex('#120a08'),
};
const DOG_BODY = [
  '..........kk.kk.',
  '..........kpkkpk',
  '..........kpFFpk',
  '...kkkkkkkFFFFFk',
  '..khhhhhhhkFeFmk',
  '.kFFFFFFFFkFmmmn',
  '.kFFFFFFFFFkmmmk',
  '.ksFFFFFFFFFFkk.',
  '..kssssssssssk..',
];
// Beine (3 Zeilen) je Lauf-Frame: normal, gespreizt, normal, geschlossen
const DOG_LEGS = [
  ['..kskksk.kskksk.', '..kskksk.kskksk.', '..kkkkkk.kkkkkk.'],
  ['.ksk.kskksk.ksk.', '.ksk.kskksk.ksk.', '.kkk.kkkkkk.kkk.'],
  ['..kskksk.kskksk.', '..kskksk.kskksk.', '..kkkkkk.kkkkkk.'],
  ['...ksksk..ksksk.', '...ksksk..ksksk.', '...kkkkk..kkkkk.'],
];
const DOG_EAT = [
  '................',
  '................',
  '................',
  '...kkkkkkkkk.kk.',
  '..khhhhhhhkpkkpk',
  '.kFFFFFFFFkpFFpk',
  '.kFFFFFFFFkFFFFk',
  '.ksFFFFFFFkFeFmk',
  '..ksssssssksmmmn',
  '..kskksk..kmmmk.',
  '..kskksk..kkkk..',
  '..kkkkkk........',
];
// Eingerollt schlafend wie auf dem Foto: Kopf links auf den Pfoten, Ohren aufgestellt
const DOG_SLEEP = [
  '................',
  '................',
  '................',
  '................',
  '.kk.kk..........',
  '.kpkkpkkkkkkkk..',
  '.kFFFFkhhhhhhhk.',
  'kFssFkFFFFFFFFFk',
  'nmmFFkFFFFFFFFFk',
  'kmmmkFFFFFFFFFsk',
  '.kkkkssssssssssk',
  '..kkkkkkkkkkkkk.',
];

function dogFrame(pose, f) {
  const { frameW: w, frameH: h } = NPC_SPRITES.dog;
  let grid;
  if (pose === 'walk') grid = [...DOG_BODY, ...DOG_LEGS[f]];
  else if (pose === 'sleep') grid = DOG_SLEEP;
  else {
    grid = [...DOG_EAT];
    // Kauen: Kopf (Spalten 10–15) in jedem zweiten Frame 1 px höher
    if (f % 2)
      grid = grid.map((row, y) => (y >= 3 && y < h - 1 ? row.slice(0, 10) + (grid[y + 1] ?? row).slice(10) : row));
  }
  const img = new Img(w, h);
  grid.forEach((row, y) => {
    if (row.length !== w) throw new Error(`Hunde-Sprite: Zeile ${y} hat ${row.length} statt ${w} Zeichen: "${row}"`);
    [...row].forEach((ch, x) => ch !== '.' && img.px(x, y, DOG_COLORS[ch]));
  });
  if (pose === 'walk' && f % 2) img.px(14, 7, hex('#ff8fb0')); // Zunge beim Rennen
  return img;
}

/** Entenküken, 8×8, Blick nach rechts. pose: walk | swim */
function duckFrame(pose, f) {
  const { frameW: w, frameH: h } = NPC_SPRITES.duck;
  const img = new Img(w, h);
  const Y = hex('#ffe066');
  const ell = (cx, cy, rx, ry) => (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  const bob = pose === 'swim' && f % 2 ? 1 : 0;
  const body = ell(3.5, 5 + bob, 2.8, 1.8);
  const head = ell(5.4, 2.6 + bob, 1.6, 1.6);
  const inside = (x, y) => (pose === 'swim' && y > 5 + bob ? false : body(x, y) || head(x, y));
  outlineShape(img, inside, 0, 0, w - 1, h - 1, (x, y) => (!inside(x, y - 1) ? hex('#fff3a8') : !inside(x, y + 1) ? hex('#f0b030') : Y));
  img.px(7, 3 + bob, hex('#ff8a2a')); // Schnabel
  img.px(6, 2 + bob, C.outline); // Auge
  if (pose === 'walk') {
    for (const fx of f % 2 ? [3] : [2, 4]) img.px(fx, 7, hex('#ff8a2a'));
  } else {
    for (let x = 0; x < w; x++) if ((x + f) % 3) img.px(x, 6 + bob, C.foam);
  }
  return img;
}

/** Sheet aus Zeilen [pose, gespiegelt]; jede Zeile 4 Frames */
function npcSheet(frame, sprite, rows) {
  const { frameW: w, frameH: h } = sprite;
  const sheet = new Img(w * 4, h * rows.length);
  rows.forEach(([pose, flip], r) => {
    for (let f = 0; f < 4; f++) {
      const fr = frame(pose, f);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const c = fr.get(flip ? w - 1 - x : x, y);
          if (c[3]) sheet.px(f * w + x, r * h + y, c);
        }
    }
  });
  return sheet;
}

/* ------------------------------------------------------------ Gebäude */

/** Wand mit Kontur; pattern(x, y) liefert die Farbe je Pixel */
function wall(b, x0, y0, x1, y1, pattern) {
  outlineShape(b, (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1, x0, y0, x1, y1, pattern);
}
function gable(b, x0, x1, top, bottom, col, dark, over = 3) {
  const cx = (x0 + x1) / 2;
  const half = (x1 - x0) / 2 + over;
  const inside = (x, y) => y >= top && y <= bottom && Math.abs(x + 0.5 - cx - 0.5) <= ((y - top + 1) / (bottom - top + 1)) * half;
  outlineShape(b, inside, x0 - over, top, x1 + over, bottom, (x, y) => {
    if (y === bottom || y === bottom - 1) return dark;
    return (y - top) % 4 === 0 || ((y - top) % 4 === 2 && (x + ((y - top) >> 2) * 3) % 6 === 0) ? dark : col;
  });
}
function door(b, cx, bottom, w, h, col, knob = C.yellow) {
  const x = Math.round(cx - w / 2);
  b.rect(x - 1, bottom - h - 1, w + 2, h + 1, C.outline);
  b.rect(x, bottom - h, w, h, col);
  b.rect(x + 1, bottom - h + 1, w - 2, 1, hex('#ffffff', 50));
  b.px(x + w - 2, bottom - Math.round(h / 2), knob);
}
function win(b, x, y, w, h, glass = C.glass, light = C.glassLight) {
  b.rect(x - 1, y - 1, w + 2, h + 2, C.outline);
  b.rect(x, y, w, h, glass);
  for (let i = 0; i < Math.min(w, h) - 1; i++) b.px(x + 1 + i, y + h - 2 - i, light);
}
function plate(b, s, cx, y, bg, fg, border = C.outline) {
  const w = textWidth(s) + 6;
  const x = Math.round(cx - w / 2);
  b.rect(x - 1, y - 1, w + 2, 9, border);
  b.rect(x, y, w, 7, bg);
  text(b, s, x + 3, y + 1, fg);
}
function shadowBase(b) {
  b.ellipse(b.w / 2, b.h - 2, b.w / 2 - 1, 2.5, C.shadow);
}
const brick = (base, joint) => (x, y) => (y % 4 === 3 || (x + ((y >> 2) % 2) * 3) % 6 === 0 ? joint : base);

const BUILD = {
  /** Start: Stream-Studio mit Antenne, Bildschirm-Fenster und LIVE-Schild */
  studio(b) {
    shadowBase(b);
    wall(b, 5, 18, b.w - 6, b.h - 4, brick(hex('#5b4a8a'), hex('#4a3b74')));
    b.rect(3, 13, b.w - 6, 5, C.outline);
    b.rect(4, 14, b.w - 8, 3, hex('#7a68b0'));
    // Antenne + Satellitenschüssel
    b.rect(b.w - 16, 1, 2, 13, C.outline);
    b.px(b.w - 15, 0, C.live);
    b.ellipse(14, 10, 6, 4, C.outline);
    b.ellipse(14, 10, 5, 3, hex('#d0d4e6'));
    b.rect(13, 11, 2, 3, C.outline);
    // Bildschirm-Fenster mit Spiel
    win(b, 10, 25, 22, 14, hex('#16224a'), hex('#16224a'));
    b.rect(12, 34, 18, 3, hex('#3f9a58'));
    b.rect(14, 29, 3, 5, C.neonPink);
    b.rect(23, 31, 4, 3, C.neonCyan);
    b.rect(10, 40, 22, 2, C.outline);
    win(b, b.w - 22, 25, 10, 9);
    door(b, b.w / 2 + 6, b.h - 4, 10, 16, hex('#2b2150'));
    plate(b, 'LIVE', b.w / 2 + 6, 22, C.live, C.white, hex('#ffd0d8'));
  },
  /** Über mich: gemütliches Haus mit Herz-Fenster */
  house(b) {
    shadowBase(b);
    wall(b, 7, 28, b.w - 8, b.h - 4, (x, y) => (y > b.h - 10 ? ((x % 5 === 0 ? C.woodDark : C.wood)) : hex('#f4e6d0')));
    gable(b, 7, b.w - 8, 4, 30, hex('#ff6fb5'), hex('#c2408a'));
    b.rect(b.w - 20, 6, 6, 14, C.outline);
    b.rect(b.w - 19, 7, 4, 12, hex('#8e86a8'));
    const heart = ['01010', '11111', '11111', '01110', '00100'];
    b.ellipse(b.w / 2, 19, 5, 5, C.outline);
    b.ellipse(b.w / 2, 19, 4, 4, hex('#fff6e8'));
    heart.forEach((r, j) => [...r].forEach((v, i) => v === '1' && b.px(b.w / 2 - 2 + i, 17 + j, C.neonPink)));
    win(b, 12, 34, 9, 8);
    win(b, b.w - 21, 34, 9, 8);
    door(b, b.w / 2, b.h - 4, 10, 16, hex('#8a4a6a'));
  },
  /** Streamplan: Uhrturm */
  tower(b) {
    shadowBase(b);
    wall(b, 9, 26, b.w - 10, b.h - 4, brick(hex('#9a92b8'), hex('#7d749e')));
    const cx = b.w / 2;
    const inside = (x, y) => y >= 0 && y <= 26 && Math.abs(x + 0.5 - cx) <= ((y + 1) / 27) * (b.w / 2 - 6);
    outlineShape(b, inside, 4, 0, b.w - 4, 26, (x, y) => (y % 4 === 0 ? hex('#5a38c0') : x < cx ? hex('#9b6bff') : hex('#7a4fd0')));
    b.px(cx - 0.5, 0, C.yellow);
    // Zifferblatt
    b.ellipse(cx, 40, 9, 9, C.outline);
    b.ellipse(cx, 40, 8, 8, hex('#fff6e8'));
    for (const [dx, dy] of [[0, -6], [6, 0], [0, 6], [-6, 0]]) b.px(cx - 0.5 + dx, 39.5 + dy, C.outline);
    b.rect(cx - 0.5, 34, 1, 6, C.outline);
    b.rect(cx - 0.5, 39.5, 5, 1, C.live);
    win(b, cx - 3, 54, 6, 8);
    door(b, cx, b.h - 4, 10, 14, hex('#4a3f6b'));
  },
  /** Games: Arcade-Halle mit Neon-Schild und Markise */
  arcade(b) {
    shadowBase(b);
    wall(b, 4, 16, b.w - 5, b.h - 4, (x, y) => (y % 6 === 0 ? hex('#231a44') : hex('#2b2150')));
    b.rect(2, 12, b.w - 4, 5, C.outline);
    b.rect(3, 13, b.w - 6, 3, hex('#3b2d6e'));
    plate(b, 'ARCADE', b.w / 2, 3, hex('#16102c'), C.neonCyan, C.neonCyan);
    // Markise
    for (let x = 4; x < b.w - 4; x++)
      for (let y = 18; y < 24; y++) b.px(x, y, Math.floor((x - 4) / 5) % 2 ? C.white : C.neonPink);
    b.rect(4, 24, b.w - 8, 1, C.outline);
    for (let x = 6; x < b.w - 6; x += 5) b.px(x, 25, C.neonPink);
    // Automaten im Fenster
    for (const wx of [9, b.w - 31]) {
      win(b, wx, 30, 22, 16, hex('#120c24'), hex('#120c24'));
      for (const [ax, col] of [[2, C.neonPink], [9, C.neonCyan], [16, C.yellow]]) {
        b.rect(wx + ax, 33, 5, 11, hex('#3b2d6e'));
        b.rect(wx + ax + 1, 34, 3, 3, col);
        b.px(wx + ax + 2, 39, C.live);
      }
    }
    door(b, b.w / 2, b.h - 4, 12, 18, hex('#16102c'), C.neonCyan);
  },
  /** Clips: Kino mit Leuchtbuchstaben */
  cinema(b) {
    shadowBase(b);
    wall(b, 5, 14, b.w - 6, b.h - 4, (x, y) => (x % 8 === 0 ? hex('#8a2e40') : hex('#a83a4a')));
    // Giebel-Front
    const inside = (x, y) => y >= 2 && y < 14 && x >= 12 && x < b.w - 12;
    outlineShape(b, inside, 12, 2, b.w - 12, 14, () => hex('#c84a5a'));
    // Leuchtrahmen mit Lämpchen
    b.rect(13, 16, b.w - 26, 13, C.outline);
    b.rect(14, 17, b.w - 28, 11, hex('#fff3d0'));
    for (let x = 15; x < b.w - 14; x += 3) {
      b.px(x, 17, C.yellow);
      b.px(x, 27, C.yellow);
    }
    text(b, 'CLIPS', b.w / 2 - textWidth('CLIPS') / 2, 20, hex('#a83a4a'));
    // Plakate
    for (const px of [9, b.w - 19]) {
      b.rect(px - 1, 33, 12, 16, C.yellow);
      b.rect(px, 34, 10, 14, hex('#2b2150'));
      b.rect(px + 2, 37, 6, 5, px < 20 ? C.neonCyan : C.neonPink);
    }
    // Doppeltür mit Vorhang-Rot
    door(b, b.w / 2 - 5, b.h - 4, 9, 16, hex('#5e1a28'));
    door(b, b.w / 2 + 5, b.h - 4, 9, 16, hex('#5e1a28'));
  },
  /** Community: Taverne mit Fachwerk und Hängeschild */
  tavern(b) {
    shadowBase(b);
    wall(b, 6, 30, b.w - 7, b.h - 4, (x, y) =>
      x % 14 === 6 || y === 30 || y === b.h - 4 || (y - 30) === (x % 14) || y === 42 ? C.woodDark : hex('#f0e2c4'),
    );
    gable(b, 6, b.w - 7, 4, 32, hex('#8a5a3a'), hex('#5e3420'), 4);
    win(b, 12, 35, 10, 8, hex('#ffd36a'), hex('#fff0b0'));
    win(b, b.w - 22, 35, 10, 8, hex('#ffd36a'), hex('#fff0b0'));
    door(b, b.w / 2, b.h - 4, 12, 17, C.wood);
    plate(b, 'TAVERNE', b.w / 2, 20, C.woodLight, C.outline, C.woodDark);
    // Laterne am Eingang
    b.rect(b.w / 2 + 9, 40, 3, 4, C.yellow);
  },
  /** Ende des Wegs: Steintor mit Holztür (Frame 0 zu, Frame 1 offen) */
  door(b, f) {
    shadowBase(b);
    const cx = b.w / 2;
    const arch = (x, y, x0, x1, top) => {
      const r = (x1 - x0) / 2;
      const ax = (x0 + x1) / 2;
      if (x < x0 || x > x1 || y > b.h - 4) return false;
      return y >= top + r || (x + 0.5 - ax - 0.5) ** 2 + (y + 0.5 - top - r) ** 2 <= r * r;
    };
    // Steinbogen
    outlineShape(b, (x, y) => arch(x, y, 3, b.w - 4, 2), 3, 2, b.w - 4, b.h - 4, (x, y) => {
      const n = hash(x >> 2, y >> 2, 120);
      return brick(n < 0.3 ? hex('#a59cc0') : hex('#8e86a8'), hex('#5e5680'))(x, y);
    });
    // Türöffnung
    const inner = (x, y) => arch(x, y, 12, b.w - 13, 12);
    for (let y = 12; y < b.h - 4; y++)
      for (let x = 11; x < b.w - 11; x++) {
        if (!inner(x, y)) {
          if (inner(x - 1, y) || inner(x + 1, y) || inner(x, y - 1)) b.px(x, y, C.outline);
          continue;
        }
        if (f === 0) {
          // Holztür mit Eisenbändern
          const lx = x - 12;
          b.px(x, y, lx % 6 === 5 ? C.woodDark : y === 24 || y === 40 ? hex('#3a3350') : lx % 6 === 0 ? C.woodLight : C.wood);
        } else {
          // Offen: warmes Licht von drinnen, Türflügel innen links
          const t = (y - 12) / (b.h - 16);
          b.px(x, y, t < 0.35 ? hex('#ffc2e0') : t < 0.7 ? hex('#ff8fc8') : hex('#ffd9a0'));
          if (x < 16) b.px(x, y, x === 15 ? C.woodDark : C.wood);
        }
      }
    if (f === 0) b.ellipse(cx + 5, 36, 1.5, 1.5, C.yellow);
    // Fackeln
    for (const tx of [6, b.w - 8]) {
      b.rect(tx, 24, 3, 8, C.outline);
      b.rect(tx + 1, 25, 1, 6, C.woodDark);
      b.rect(tx, 20, 3, 4, f ? C.yellow : hex('#f7a823'));
      b.px(tx + 1, 19, C.live);
    }
    // Fußmatte
    b.rect(cx - 7, b.h - 4, 14, 3, C.outline);
    b.rect(cx - 6, b.h - 4, 12, 2, C.neonPink);
  },
  /** Kontakt: Postamt mit Briefkasten */
  post(b) {
    shadowBase(b);
    wall(b, 6, 26, b.w - 7, b.h - 4, (x, y) => (y % 5 === 0 ? hex('#a8c4e8') : hex('#c8dcf4')));
    gable(b, 6, b.w - 7, 4, 28, hex('#3c74d0'), hex('#244e9a'));
    plate(b, 'POST', b.w / 2, 17, C.yellow, C.outline);
    win(b, 11, 32, 9, 8);
    win(b, b.w - 20, 32, 9, 8);
    door(b, b.w / 2, b.h - 4, 10, 16, hex('#244e9a'));
    // Briefkasten
    b.rect(b.w - 14, b.h - 15, 8, 11, C.outline);
    b.rect(b.w - 13, b.h - 14, 6, 9, C.yellow);
    b.rect(b.w - 12, b.h - 12, 4, 1, C.outline);
  },
};

/** Sprite-Sheet eines Gebäudes; mehrere Frames liegen nebeneinander (BUILD bekommt die Frame-Nummer) */
function buildingSprite(type) {
  const { w, h, frames = 1 } = BUILDINGS[type];
  if (!BUILD[type]) throw new Error(`Für Gebäude-Typ "${type}" gibt es keine Zeichenfunktion in BUILD.`);
  const sheet = new Img(w * frames, h);
  for (let f = 0; f < frames; f++) {
    const b = new Img(w, h);
    BUILD[type](b, f);
    sheet.blit(b, 0, 0, w, h, f * w, 0);
  }
  return sheet;
}

/* ------------------------------------------------------------- Figur */

// Farben: k Kontur, c/C Headset, n/N Haare, s/S Haut, e Auge, r/R Hoodie, w Kordel, p/P Hose, o Schuhe
const HERO_COLORS = {
  k: hex('#1a1030'),
  c: hex('#3ee6ff'),
  C: hex('#1f8fb0'),
  n: hex('#ff6fb5'),
  N: hex('#c2408a'),
  s: hex('#f6c7a4'),
  S: hex('#d99a7a'),
  e: hex('#1a1030'),
  r: hex('#8a5cff'),
  R: hex('#5a38c0'),
  w: hex('#ffffff'),
  p: hex('#2c2a4a'),
  P: hex('#1b1a33'),
  o: hex('#e8e4f8'),
};

const DOWN_TOP = [
  '................',
  '.....kkkkkk.....',
  '....kcccccck....',
  '...knnnnnnnnk...',
  '..kCnnnnnnnnCk..',
  '..kCnssssssnCk..',
  '..kcnsessesnck..',
  '...knssssssnk...',
  '...knnSssSnnk...',
  '...kNkrrrrkNk...',
  '..krrrwrrwrrrk..',
  '..kRrrrrrrrrRk..',
  '..ksRrrrrrrRsk..',
  '..kkRRRRRRRRkk..',
  '...kRRRRRRRRk...',
];
const UP_TOP = [
  '................',
  '.....kkkkkk.....',
  '....kcccccck....',
  '...knnnnnnnnk...',
  '..kCnnnnnnnnCk..',
  '..kCnnnnnnnnCk..',
  '..kcnnnnnnnnck..',
  '...knnnnnnnnk...',
  '...knnNnnNnnk...',
  '...kNnnnnnnNk...',
  '..krNNNNNNNNrk..',
  '..kRrrrrrrrrRk..',
  '..ksRrrrrrrRsk..',
  '..kkRRRRRRRRkk..',
  '...kRRRRRRRRk...',
];
const FRONT_LEGS = {
  stand: [
    '...kppppppppk...',
    '...kppppppppk...',
    '...kpppkkpppk...',
    '...kPpk..kpPk...',
    '...kppk..kppk...',
    '...kook..kook...',
    '....kk....kk....',
  ],
  stepL: [
    '...kppppppppk...',
    '...kppppppppk...',
    '...kpppkkpppk...',
    '...kPpk..kpPk...',
    '...kppk..kook...',
    '...kook...kk....',
    '....kk..........',
  ],
};
const SIDE_TOP = [
  '................',
  '......kkkkk.....',
  '.....kcccckk....',
  '....knnnnnnnk...',
  '...knnCCnnnnnk..',
  '...knCCCnssssk..',
  '...knCCCnssek...',
  '...knncnnsssSk..',
  '...knnnnnSssk...',
  '....kNNkrrrk....',
  '....krrrrrrk....',
  '....krrrrwrk....',
  '....kRrsrrrk....',
  '....kRRsRRRk....',
  '....kkRRRRk.....',
];
const SIDE_LEGS = {
  stand: [
    '.....kppppk.....',
    '.....kppppk.....',
    '.....kpPppk.....',
    '.....kppPpk.....',
    '.....kppppk.....',
    '.....koooook....',
    '......kkkkk.....',
  ],
  step: [
    '.....kppppk.....',
    '....kpppppPk....',
    '....kppkkppk....',
    '...kppk..kppk...',
    '...kPk....kpk...',
    '..kook....kook..',
    '...kk......kk...',
  ],
  step2: [
    '.....kppppk.....',
    '....kPpppppk....',
    '....kppkkppk....',
    '...kpPk..kPpk...',
    '...kpk....kPk...',
    '..kook....kook..',
    '...kk......kk...',
  ],
};
const mirror = (rows) => rows.map((r) => [...r].reverse().join(''));

function heroSheet() {
  const { frameW: fw, frameH: fh, frames } = HERO;
  const img = new Img(fw * frames, fh * 4);
  const front = (top, legs) => [...top, ...legs];
  const side = [SIDE_LEGS.stand, SIDE_LEGS.step, SIDE_LEGS.stand, SIDE_LEGS.step2];
  // Zeilen: 0 unten, 1 links, 2 rechts, 3 oben – Frames: Stand, Schritt, Stand, Schritt (gespiegelt)
  const rows = [
    [front(DOWN_TOP, FRONT_LEGS.stand), front(DOWN_TOP, FRONT_LEGS.stepL), front(DOWN_TOP, FRONT_LEGS.stand), front(DOWN_TOP, mirror(FRONT_LEGS.stepL))],
    side.map((legs) => mirror([...SIDE_TOP, ...legs])),
    side.map((legs) => [...SIDE_TOP, ...legs]),
    [front(UP_TOP, FRONT_LEGS.stand), front(UP_TOP, FRONT_LEGS.stepL), front(UP_TOP, FRONT_LEGS.stand), front(UP_TOP, mirror(FRONT_LEGS.stepL))],
  ];
  rows.forEach((frameList, row) =>
    frameList.forEach((grid, f) => {
      const ox = f * fw;
      const oy = row * fh;
      const walking = f % 2 === 1;
      img.ellipse(ox + HERO.anchorX, oy + HERO.anchorY, 5, 1.6, [10, 6, 30, 90]);
      if (grid.length !== fh - 2) throw new Error(`Sprite hat ${grid.length} statt ${fh - 2} Zeilen`);
      grid.forEach((line, y) => {
        if (line.length !== fw) throw new Error(`Sprite-Zeile hat ${line.length} statt ${fw} Zeichen: "${line}"`);
        // Beim Schritt wippt der Oberkörper 1 px nach oben
        const dy = walking && y < 15 ? -1 : 0;
        [...line].forEach((ch, x) => ch !== '.' && img.px(ox + x, oy + y + dy, HERO_COLORS[ch]));
        if (dy && y === 14) [...line].forEach((ch, x) => ch !== '.' && img.px(ox + x, oy + y, HERO_COLORS[ch]));
      });
    }),
  );
  return img;
}

/* ------------------------------------------------- Vorschaubild (OG) */

/** 240×126 Ausschnitt um die Startstation, ×5 = 1200×630 */
function ogImage(ground, sprites, hero) {
  const w = 240;
  const h = 126;
  const p = PATH[STATIONS[0].waypoint];
  const sx = Math.max(0, Math.min(W - w, p.x - 70));
  const sy = Math.max(0, Math.min(H - h, p.y - 100));
  const img = new Img(w, h);
  img.blit(ground, sx, sy, w, h, 0, 0);
  img.blit(objects, sx, sy, w, h, 0, 0);
  boxes.forEach((b) => img.blit(sprites[b.type], 0, 0, b.w, b.h, b.x - sx, b.y - sy));
  img.blit(hero, 0, 0, HERO.frameW, HERO.frameH, p.x - HERO.anchorX - sx, p.y - HERO.anchorY - sy);
  img.blit(canopy, sx, sy, w, h, 0, 0);
  // Namensschild
  const title = 'PIXELPIXIE';
  const tw = textWidth(title, 2);
  const px = w - tw - 14;
  img.rect(px - 6, 8, tw + 12, 34, C.outline);
  img.rect(px - 5, 9, tw + 10, 32, hex('#1e1638'));
  img.rect(px - 5, 9, tw + 10, 1, C.neonPink);
  text(img, title, px, 14, C.neonPink, 2);
  text(img, 'TWITCH STREAMS', px + (tw - textWidth('TWITCH STREAMS')) / 2, 30, C.neonCyan);
  return img.scaled(5);
}

/* -------------------------------------------------------------- Export */

console.log('Erzeuge Assets …');
const ground = buildGround();
ground.save(join(OUT, 'map/ground.png'));
objects.save(join(OUT, 'map/objects.png'));
canopy.save(join(OUT, 'map/canopy.png'));
const sprites = {};
for (const type of Object.keys(BUILDINGS)) {
  sprites[type] = buildingSprite(type);
  sprites[type].save(join(OUT, `buildings/${type}.png`));
}
npcSheet(dogFrame, NPC_SPRITES.dog, [['walk', false], ['walk', true], ['eat', false], ['eat', true], ['sleep', false]]).save(
  join(OUT, 'sprites/dog.png'),
);
npcSheet(duckFrame, NPC_SPRITES.duck, [['walk', false], ['walk', true], ['swim', false], ['swim', true]]).save(join(OUT, 'sprites/duck.png'));
const hero = heroSheet();
hero.save(join(OUT, 'sprites/hero.png'));
ogImage(ground, sprites, hero).save(join(OUT, 'og.png'));
console.log('Fertig.');
