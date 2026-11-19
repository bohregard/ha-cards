export interface Point {
  x: number;
  y: number;
}

export interface CalibrationPoint {
  vacuum: Point;
  map: Point;
}

export interface RoomBox {
  room_id: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  [key: string]: unknown;
}

/** Affine transform: out.x = a*x + b*y + e, out.y = c*x + d*y + f. */
interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/** Solve the affine transform that maps three `from` points onto three `to` points. */
function solve(from: Point[], to: Point[]): Affine {
  const [p0, p1, p2] = from;
  const det = p0.x * (p1.y - p2.y) - p0.y * (p1.x - p2.x) + (p1.x * p2.y - p2.x * p1.y);
  if (det === 0) throw new Error("Calibration points are collinear");
  // Cramer's rule for [x y 1] · [m n o]ᵀ = v at each of the three points.
  const row = (v0: number, v1: number, v2: number) => ({
    m: (v0 * (p1.y - p2.y) - p0.y * (v1 - v2) + (v1 * p2.y - v2 * p1.y)) / det,
    n: (p0.x * (v1 - v2) - v0 * (p1.x - p2.x) + (p1.x * v2 - p2.x * v1)) / det,
    o:
      (p0.x * (p1.y * v2 - p2.y * v1) - p0.y * (p1.x * v2 - p2.x * v1) + v0 * (p1.x * p2.y - p2.x * p1.y)) /
      det,
  });
  const rx = row(to[0].x, to[1].x, to[2].x);
  const ry = row(to[0].y, to[1].y, to[2].y);
  return { a: rx.m, b: rx.n, e: rx.o, c: ry.m, d: ry.n, f: ry.o };
}

function apply(t: Affine, p: Point): Point {
  return { x: t.a * p.x + t.b * p.y + t.e, y: t.c * p.x + t.d * p.y + t.f };
}

/** Convert vacuum coordinates (mm) to map image pixels. */
export function vacuumToMap(cal: CalibrationPoint[], p: Point): Point {
  return apply(solve(cal.map((c) => c.vacuum), cal.map((c) => c.map)), p);
}

/** Convert map image pixels to vacuum coordinates (mm). */
export function mapToVacuum(cal: CalibrationPoint[], p: Point): Point {
  return apply(solve(cal.map((c) => c.map), cal.map((c) => c.vacuum)), p);
}

/** The room under a map pixel. Where boxes overlap, the smallest one wins. */
export function roomAt<R extends RoomBox>(
  rooms: Record<string, R>,
  cal: CalibrationPoint[],
  pixel: Point,
): R | undefined {
  const v = mapToVacuum(cal, pixel);
  const inside = (r: R) =>
    v.x >= Math.min(r.x0, r.x1) &&
    v.x <= Math.max(r.x0, r.x1) &&
    v.y >= Math.min(r.y0, r.y1) &&
    v.y <= Math.max(r.y0, r.y1);
  const area = (r: R) => Math.abs((r.x1 - r.x0) * (r.y1 - r.y0));
  return Object.values(rooms)
    .filter(inside)
    .sort((a, b) => area(a) - area(b))[0];
}
