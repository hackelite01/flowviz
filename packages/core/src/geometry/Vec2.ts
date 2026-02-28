// ─── 2D Vector Math Utilities ────────────────────────────────────────────────
// Pure functions — no classes, no allocations beyond return values.

export interface Vec2 {
  x: number;
  y: number;
}

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function lerpN(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function lenSq(v: Vec2): number {
  return v.x * v.x + v.y * v.y;
}

export function len(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function distSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.sqrt(distSq(a, b));
}

export function normalize(v: Vec2): Vec2 {
  const l = len(v);
  return l < 1e-9 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
}

/** Clockwise perpendicular: rotate 90° CW */
export function perpCW(v: Vec2): Vec2 {
  return { x: v.y, y: -v.x };
}

/** Counter-clockwise perpendicular: rotate 90° CCW */
export function perpCCW(v: Vec2): Vec2 {
  return { x: -v.y, y: v.x };
}

export function angle(v: Vec2): number {
  return Math.atan2(v.y, v.x);
}

/** Clamp a number between min and max */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
