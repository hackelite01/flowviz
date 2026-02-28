const LUT_SIZE = 256;

export interface Point {
  x: number;
  y: number;
}

export interface BezierControl {
  p0: Point;
  p1: Point; // control 1
  p2: Point; // control 2
  p3: Point;
}

export interface PathData {
  controls: BezierControl;
  lut: Float32Array; // interleaved [x0,y0,angle0, x1,y1,angle1, ...]
  length: number;
  svgD: string;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function cubicPoint(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

function cubicDerivative(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * (p1 - p0) + 6 * mt * t * (p2 - p1) + 3 * t * t * (p3 - p2);
}

export class BezierPath {
  static compute(
    source: Point,
    target: Point,
    curvature: number,
    controlPointOffset?: { x: number; y: number }
  ): PathData {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Guard: if source === target, return a degenerate flat path to avoid NaN
    if (dist < 0.001) {
      const p = source;
      const controls: BezierControl = { p0: p, p1: p, p2: p, p3: p };
      const lut = new Float32Array(LUT_SIZE * 3);
      for (let i = 0; i < LUT_SIZE; i++) {
        lut[i * 3] = p.x; lut[i * 3 + 1] = p.y; lut[i * 3 + 2] = 0;
      }
      return { controls, lut, length: 0, svgD: `M ${p.x} ${p.y} C ${p.x} ${p.y} ${p.x} ${p.y} ${p.x} ${p.y}` };
    }

    // Perpendicular offset for control points — creates natural arc
    const perpX = -dy / dist;
    const perpY = dx / dist;
    const arc = dist * curvature * 0.5;

    const midX = lerp(source.x, target.x, 0.5) + perpX * arc + (controlPointOffset?.x ?? 0);
    const midY = lerp(source.y, target.y, 0.5) + perpY * arc + (controlPointOffset?.y ?? 0);

    const p0 = source;
    const p1 = { x: lerp(source.x, midX, 0.6), y: lerp(source.y, midY, 0.6) };
    const p2 = { x: lerp(target.x, midX, 0.6), y: lerp(target.y, midY, 0.6) };
    const p3 = target;

    const controls: BezierControl = { p0, p1, p2, p3 };
    const lut = BezierPath.buildLUT(controls);
    const length = BezierPath.estimateLength(controls);
    const svgD = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p3.x} ${p3.y}`;

    return { controls, lut, length, svgD };
  }

  private static buildLUT(c: BezierControl): Float32Array {
    // Each entry = [x, y, angle] = 3 floats
    const arr = new Float32Array(LUT_SIZE * 3);
    for (let i = 0; i < LUT_SIZE; i++) {
      const t = i / (LUT_SIZE - 1);
      const x = cubicPoint(c.p0.x, c.p1.x, c.p2.x, c.p3.x, t);
      const y = cubicPoint(c.p0.y, c.p1.y, c.p2.y, c.p3.y, t);
      const dx = cubicDerivative(c.p0.x, c.p1.x, c.p2.x, c.p3.x, t);
      const dy = cubicDerivative(c.p0.y, c.p1.y, c.p2.y, c.p3.y, t);
      arr[i * 3] = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = Math.atan2(dy, dx);
    }
    return arr;
  }

  static getPointAtT(lut: Float32Array, t: number): { x: number; y: number; angle: number } {
    const clamped = Math.max(0, Math.min(1, t));
    const idx = Math.floor(clamped * (LUT_SIZE - 1));
    const safeIdx = Math.min(idx, LUT_SIZE - 1);
    return {
      x: lut[safeIdx * 3],
      y: lut[safeIdx * 3 + 1],
      angle: lut[safeIdx * 3 + 2],
    };
  }

  private static estimateLength(c: BezierControl): number {
    let length = 0;
    let prevX = c.p0.x;
    let prevY = c.p0.y;
    const steps = 64;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = cubicPoint(c.p0.x, c.p1.x, c.p2.x, c.p3.x, t);
      const y = cubicPoint(c.p0.y, c.p1.y, c.p2.y, c.p3.y, t);
      const dx = x - prevX;
      const dy = y - prevY;
      length += Math.sqrt(dx * dx + dy * dy);
      prevX = x;
      prevY = y;
    }
    return length;
  }
}
