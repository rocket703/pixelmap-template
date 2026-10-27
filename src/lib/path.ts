/** Pfad-Mathematik: Wegpunkte → Gesamtlänge → Punkt bei Pfadlänge s */

export interface Point {
  x: number;
  y: number;
}

export interface PathInfo {
  points: Point[];
  /** Kumulierte Länge bis zu jedem Wegpunkt (cum[0] = 0) */
  cum: number[];
  total: number;
}

export function createPath(points: Point[]): PathInfo {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return { points, cum, total: cum[cum.length - 1] };
}

/** Position auf dem Pfad bei Länge s (wird auf 0..total begrenzt) */
export function pointAt(path: PathInfo, s: number): Point {
  const { points, cum, total } = path;
  const d = Math.min(Math.max(s, 0), total);
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const a = points[i - 1];
  const b = points[i];
  const len = cum[i] - cum[i - 1] || 1;
  const t = (d - cum[i - 1]) / len;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
