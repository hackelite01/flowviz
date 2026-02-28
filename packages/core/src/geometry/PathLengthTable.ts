// ─── Arc-Length Lookup Table (PathLengthTable) ───────────────────────────────
//
// A reusable arc-length parameterization utility.
//
// Motivation:
// Parametric curves (bezier, catmull-rom, …) do not map their parameter t
// linearly to arc-length.  A particle stepping at constant Δt appears to
// speed up through low-curvature segments and slow down through high-curvature
// ones — visually jarring.
//
// Solution: sample the curve at N equi-parameter steps, accumulate arc
// lengths, store a (cumulative-length → sample-index) LUT, then binary-
// search the LUT to convert a desired arc-length distance into the correct t
// (or interpolated x,y position) — giving constant visual speed.
//
// Usage:
//   const table = PathLengthTable.build(
//     (t) => ({ x: bezier.x(t), y: bezier.y(t) }),
//     512          // samples — higher = more accurate
//   );
//   const pt = table.sampleAt(table.totalLength * 0.5); // midpoint by arc-length

export interface SampledPoint {
  x: number;
  y: number;
}

export interface LengthTableEntry {
  /** Cumulative arc-length from start to this sample */
  arcLen: number;
  /** The point at this sample */
  point: SampledPoint;
  /** The parametric t value at this sample */
  t: number;
}

export class PathLengthTable {
  /** Internal flat storage: [arcLen, x, y, t] × N — cache-friendly layout */
  private readonly _data: Float64Array;
  /** Number of samples (including sample 0) */
  readonly sampleCount: number;
  /** Total arc-length of the curve */
  readonly totalLength: number;

  private constructor(data: Float64Array, count: number, total: number) {
    this._data       = data;
    this.sampleCount = count;
    this.totalLength = total;
  }

  /**
   * Build a PathLengthTable by sampling a parametric curve.
   *
   * @param sample     A function `(t: number) → {x, y}` for any t in [0, 1]
   * @param numSamples Number of uniform t-samples.  512 gives < 0.1% error
   *                   on typical flow-visualization curves.
   */
  static build(sample: (t: number) => SampledPoint, numSamples = 512): PathLengthTable {
    const n    = Math.max(2, numSamples);
    // Layout: [arcLen, x, y, t] per entry → 4 floats × (n+1) entries
    const data = new Float64Array((n + 1) * 4);

    let prevX = 0, prevY = 0;
    let cumLen = 0;

    for (let i = 0; i <= n; i++) {
      const t  = i / n;
      const pt = sample(t);
      if (i > 0) {
        const dx = pt.x - prevX;
        const dy = pt.y - prevY;
        cumLen += Math.sqrt(dx * dx + dy * dy);
      }
      const base   = i * 4;
      data[base]   = cumLen;   // arcLen
      data[base + 1] = pt.x;
      data[base + 2] = pt.y;
      data[base + 3] = t;
      prevX = pt.x; prevY = pt.y;
    }

    return new PathLengthTable(data, n + 1, cumLen);
  }

  /**
   * Sample the curve at a given arc-length distance.
   * Clamps `distance` to [0, totalLength].
   * Uses binary search → O(log n).
   */
  sampleAt(distance: number): SampledPoint & { t: number } {
    if (this.totalLength < 1e-9) {
      return { x: this._data[1], y: this._data[2], t: 0 };
    }
    const d  = distance < 0 ? 0 : distance > this.totalLength ? this.totalLength : distance;
    const lo = this._binarySearch(d);
    const hi = Math.min(lo + 1, this.sampleCount - 1);

    const blo   = lo * 4, bhi = hi * 4;
    const s0    = this._data[blo],     s1 = this._data[bhi];
    const alpha = s1 > s0 ? (d - s0) / (s1 - s0) : 0;

    return {
      x: this._data[blo + 1] + alpha * (this._data[bhi + 1] - this._data[blo + 1]),
      y: this._data[blo + 2] + alpha * (this._data[bhi + 2] - this._data[blo + 2]),
      t: this._data[blo + 3] + alpha * (this._data[bhi + 3] - this._data[blo + 3]),
    };
  }

  /**
   * Convert an arc-length distance to a parametric t value.
   * Useful when you need t for a custom derivative/tangent calculation.
   */
  tAtLength(distance: number): number {
    return this.sampleAt(distance).t;
  }

  /**
   * Retrieve a raw entry by sample index (0 … sampleCount-1).
   * Useful for iterating the table for debugging or custom interpolation.
   */
  entry(i: number): LengthTableEntry {
    const base = i * 4;
    return {
      arcLen: this._data[base],
      point:  { x: this._data[base + 1], y: this._data[base + 2] },
      t:      this._data[base + 3],
    };
  }

  /** Largest sample index i such that arcLen[i] ≤ target */
  private _binarySearch(target: number): number {
    let lo = 0, hi = this.sampleCount - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (this._data[mid * 4] <= target) lo = mid;
      else hi = mid;
    }
    return lo;
  }
}
