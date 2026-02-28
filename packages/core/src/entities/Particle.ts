// ─── Particle Entity ──────────────────────────────────────────────────────────
//
// Particles are pure data objects. No methods — all behavior is in ParticleSystem.
// Pre-allocated by the object pool to avoid GC pressure during animation.
//
// Movement is arc-length based:
//   particle.distance += particle.speed * dt
//   position = edge.path.getPointAtLength(particle.distance)
//
// This ensures constant visual speed regardless of curve shape.

export const MAX_TRAIL = 48; // maximum trail history points per particle

export class Particle {
  /** Which edge this particle belongs to */
  edgeId: string = '';

  /** Arc-length position along the edge path (0 → edge.path.totalLength) */
  distance: number = 0;

  /** Movement speed in logical-pixels per second */
  speed: number = 0;

  /** Current world position (computed from arc-length lookup) */
  x: number = 0;
  y: number = 0;

  /** Tangent angle at current position (for streak orientation) */
  angle: number = 0;

  /** Whether this particle is assigned to an edge (false = in pool) */
  active: boolean = false;

  /**
   * Trail history — circular buffer of past world positions.
   * Stored as interleaved [x0, y0, x1, y1, ...] for cache efficiency.
   * Trail is read from trailStart to trailEnd (inclusive).
   */
  readonly trailBuf: Float32Array = new Float32Array(MAX_TRAIL * 2);
  trailHead: number = 0;  // write index (wraps around)
  trailLen:  number = 0;  // how many valid entries (0 → MAX_TRAIL)
  trailCap:  number = 0;  // actual desired trail length (set by edge config)

  /** Reset to default state (called by pool on release/reacquire) */
  reset(): void {
    this.edgeId   = '';
    this.distance = 0;
    this.speed    = 0;
    this.x        = 0;
    this.y        = 0;
    this.angle    = 0;
    this.active   = false;
    this.trailHead = 0;
    this.trailLen  = 0;
    this.trailCap  = 0;
  }

  /** Push a position into the trail circular buffer */
  pushTrail(x: number, y: number): void {
    if (this.trailCap <= 0) return;
    this.trailBuf[this.trailHead * 2]     = x;
    this.trailBuf[this.trailHead * 2 + 1] = y;
    this.trailHead = (this.trailHead + 1) % this.trailCap;
    if (this.trailLen < this.trailCap) this.trailLen++;
  }

  /**
   * Iterate trail points from oldest to newest.
   * Calls `fn(x, y, alpha)` where alpha is 0 at tail, 1 at head.
   * Safe to call even if trailLen < 2.
   */
  forEachTrailPoint(fn: (x: number, y: number, alpha: number) => void): void {
    const n = this.trailLen;
    if (n < 2) return;
    const start = this.trailLen >= this.trailCap
      ? this.trailHead
      : 0;
    for (let i = 0; i < n; i++) {
      const idx  = (start + i) % this.trailCap;
      const x    = this.trailBuf[idx * 2];
      const y    = this.trailBuf[idx * 2 + 1];
      const alpha = i / (n - 1); // 0 at oldest, 1 at newest
      fn(x, y, alpha);
    }
  }
}
