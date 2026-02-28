import type { Vec2 } from './Vec2';
import { lerpN } from './Vec2';

// ─── Arc-Length Parameterized Cubic Bezier ───────────────────────────────────
//
// Why arc-length parameterization?
// A cubic bezier's parametric t does NOT map linearly to distance along the curve.
// Tight curves compress parameter space; shallow curves expand it.
// Particles moving at constant Δt would appear to accelerate/decelerate visually.
//
// Solution: precompute a look-up table of (cumulative arc-length → t) at LUT_SIZE
// samples. Use binary search to invert: given a desired distance, find t.
// Linear interpolation between samples gives sub-sample accuracy at O(log n) cost.
//
// Reference: Shiffman "The Nature of Code", Pharr & Humphreys "Physically Based Rendering"

const LUT_SIZE = 512; // samples — 512 gives <0.1% error on typical flow curves

export interface CubicBezierCurve {
  p0: Vec2;
  p1: Vec2; // first control
  p2: Vec2; // second control
  p3: Vec2;
}

export interface PointOnCurve {
  x: number;
  y: number;
  /** tangent angle in radians */
  angle: number;
}

export class BezierPath {
  readonly curve: CubicBezierCurve;

  /** Total arc length of this curve in logical pixels */
  readonly totalLength: number;

  /**
   * Flat LUT with LUT_SIZE+1 entries.
   * lut[i*3]   = x position at sample i
   * lut[i*3+1] = y position at sample i
   * lut[i*3+2] = tangent angle at sample i
   */
  readonly lut: Float64Array;

  /**
   * arcLen[i] = cumulative arc length from p0 to sample i.
   * Used by binary search in getPointAtLength().
   */
  private readonly arcLen: Float64Array;

  /** SVG path data string — used by canvas Path2D for edge tube drawing */
  readonly svgD: string;

  constructor(curve: CubicBezierCurve) {
    this.curve = curve;

    const n   = LUT_SIZE;
    const lut = new Float64Array((n + 1) * 3);
    const arc = new Float64Array(n + 1);

    // Sample the curve and accumulate arc lengths
    let prevX = curve.p0.x, prevY = curve.p0.y;
    lut[0] = prevX;
    lut[1] = prevY;
    lut[2] = evalTangentAngle(curve, 0);
    arc[0] = 0;

    for (let i = 1; i <= n; i++) {
      const t    = i / n;
      const x    = evalX(curve, t);
      const y    = evalY(curve, t);
      const seg  = Math.sqrt((x - prevX) ** 2 + (y - prevY) ** 2);
      arc[i]     = arc[i - 1] + seg;
      lut[i * 3]     = x;
      lut[i * 3 + 1] = y;
      lut[i * 3 + 2] = evalTangentAngle(curve, t);
      prevX = x; prevY = y;
    }

    this.lut        = lut;
    this.arcLen     = arc;
    this.totalLength = arc[n];

    const { p0, p1, p2, p3 } = curve;
    this.svgD = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p3.x} ${p3.y}`;
  }

  /**
   * Returns the point at arc-length `distance` along the curve.
   * Clamps to [0, totalLength]. O(log n) via binary search.
   */
  getPointAtLength(distance: number): PointOnCurve {
    if (this.totalLength < 1e-6) {
      return { x: this.lut[0], y: this.lut[1], angle: 0 };
    }
    const d  = distance < 0 ? 0 : distance > this.totalLength ? this.totalLength : distance;
    const i  = this.binarySearchArc(d);
    const i1 = i + 1 <= LUT_SIZE ? i + 1 : LUT_SIZE;
    const s0 = this.arcLen[i], s1 = this.arcLen[i1];
    const alpha = s1 > s0 ? (d - s0) / (s1 - s0) : 0;

    return {
      x:     lerpN(this.lut[i * 3],     this.lut[i1 * 3],     alpha),
      y:     lerpN(this.lut[i * 3 + 1], this.lut[i1 * 3 + 1], alpha),
      angle: lerpN(this.lut[i * 3 + 2], this.lut[i1 * 3 + 2], alpha),
    };
  }

  /**
   * Returns the unit tangent vector at arc-length `distance`.
   */
  getTangentAtLength(distance: number): Vec2 {
    const { angle } = this.getPointAtLength(distance);
    return { x: Math.cos(angle), y: Math.sin(angle) };
  }

  /**
   * Find the closest point on the curve to a given point.
   * Uses LUT scan — O(LUT_SIZE). Returns arc-length distance and position.
   * Used by InteractionSystem for edge hit testing.
   */
  closestPoint(px: number, py: number): { distance: number; point: PointOnCurve; distSq: number } {
    let bestDsq = Infinity, bestI = 0;
    for (let i = 0; i <= LUT_SIZE; i++) {
      const dx  = this.lut[i * 3] - px;
      const dy  = this.lut[i * 3 + 1] - py;
      const dsq = dx * dx + dy * dy;
      if (dsq < bestDsq) { bestDsq = dsq; bestI = i; }
    }
    const arc = this.arcLen[bestI];
    return {
      distance: arc,
      distSq: bestDsq,
      point: { x: this.lut[bestI * 3], y: this.lut[bestI * 3 + 1], angle: this.lut[bestI * 3 + 2] },
    };
  }

  /** Binary search: returns largest i such that arcLen[i] <= target */
  private binarySearchArc(target: number): number {
    let lo = 0, hi = LUT_SIZE;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (this.arcLen[mid] <= target) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  // ─── Factory ────────────────────────────────────────────────────────────────

  /**
   * Build a bezier from source boundary point to target boundary point.
   * Control points are derived from the center-to-center perpendicular,
   * preserving smooth curvature regardless of where the boundary points land.
   *
   * @param source   Start point (source node boundary)
   * @param target   End point (target node boundary)
   * @param srcCenter  Source node center (for control point calculation)
   * @param tgtCenter  Target node center (for control point calculation)
   * @param curvature  Perpendicular offset scale (signed, default 0.3)
   * @param offset     Additional offset for the mid control point
   */
  /**
   * Build an arc-length-parameterized cubic bezier.
   *
   * `curvature`  controls the perpendicular offset at the source-side control
   * point (p1, placed at ~1/3 of the chord).
   *
   * `curvature2` controls the perpendicular offset at the target-side control
   * point (p2, placed at ~2/3 of the chord).  When omitted it equals
   * `curvature` → symmetric arc.  When different it produces asymmetric arcs
   * or S-curves (opposite signs), giving organic / freeform paths.
   */
  static fromBoundaryPoints(
    source: Vec2,
    target: Vec2,
    srcCenter: Vec2,
    tgtCenter: Vec2,
    curvature  = 0.3,
    curvature2 = curvature,
    offset?: Vec2
  ): BezierPath {
    const dx = tgtCenter.x - srcCenter.x;
    const dy = tgtCenter.y - srcCenter.y;
    const d  = Math.sqrt(dx * dx + dy * dy);

    if (d < 0.001) {
      const p = source;
      return new BezierPath({ p0: p, p1: p, p2: p, p3: p });
    }

    // Perpendicular unit vector (based on center-to-center direction)
    const perpX = -dy / d;
    const perpY =  dx / d;

    // Boundary-to-boundary chord for proportional placement of control points
    const bdx = target.x - source.x;
    const bdy = target.y - source.y;
    const ox  = offset?.x ?? 0;
    const oy  = offset?.y ?? 0;

    // p1 at 1/3 along boundary chord + curvature perp offset  (source-side)
    const p1: Vec2 = {
      x: source.x + bdx / 3 + perpX * d * curvature  + ox,
      y: source.y + bdy / 3 + perpY * d * curvature  + oy,
    };
    // p2 at 2/3 along boundary chord + curvature2 perp offset (target-side)
    const p2: Vec2 = {
      x: source.x + 2 * bdx / 3 + perpX * d * curvature2 + ox,
      y: source.y + 2 * bdy / 3 + perpY * d * curvature2 + oy,
    };

    return new BezierPath({ p0: source, p1, p2, p3: target });
  }

  /**
   * Simple center-to-center bezier (backward-compat helper).
   */
  static fromCenters(
    source: Vec2,
    target: Vec2,
    curvature  = 0.3,
    curvature2 = curvature,
    offset?: Vec2
  ): BezierPath {
    return BezierPath.fromBoundaryPoints(source, target, source, target, curvature, curvature2, offset);
  }
}

// ─── Evaluation helpers (private) ────────────────────────────────────────────

function evalX(c: CubicBezierCurve, t: number): number {
  const mt = 1 - t;
  return mt * mt * mt * c.p0.x
       + 3 * mt * mt * t * c.p1.x
       + 3 * mt * t * t * c.p2.x
       + t * t * t * c.p3.x;
}

function evalY(c: CubicBezierCurve, t: number): number {
  const mt = 1 - t;
  return mt * mt * mt * c.p0.y
       + 3 * mt * mt * t * c.p1.y
       + 3 * mt * t * t * c.p2.y
       + t * t * t * c.p3.y;
}

function evalTangentAngle(c: CubicBezierCurve, t: number): number {
  const mt = 1 - t;
  const dx = 3 * (mt * mt * (c.p1.x - c.p0.x) + 2 * mt * t * (c.p2.x - c.p1.x) + t * t * (c.p3.x - c.p2.x));
  const dy = 3 * (mt * mt * (c.p1.y - c.p0.y) + 2 * mt * t * (c.p2.y - c.p1.y) + t * t * (c.p3.y - c.p2.y));
  return Math.atan2(dy, dx);
}
