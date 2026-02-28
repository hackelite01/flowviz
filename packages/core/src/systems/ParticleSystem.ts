import { Particle, MAX_TRAIL } from '../entities/Particle';
import type { Edge } from '../entities/Edge';

// ─── Object Pool ──────────────────────────────────────────────────────────────
//
// Pre-allocates a fixed pool of Particle objects. No GC pressure during animation.
// Pool size = 4096 particles (enough for 200 edges × ~20 particles each).

const POOL_SIZE = 4096;

class ParticlePool {
  private readonly pool: Particle[];
  private tail = POOL_SIZE; // stack pointer (pool[tail..end] are free)

  constructor() {
    // Pre-allocate all particles once — pool[0..POOL_SIZE-1] are free
    this.pool = Array.from({ length: POOL_SIZE }, () => new Particle());
  }

  acquire(): Particle | null {
    if (this.tail === 0) return null; // pool exhausted
    const p = this.pool[--this.tail];
    p.reset();
    p.active = true;
    return p;
  }

  release(p: Particle): void {
    p.active = false;
    p.reset();
    if (this.tail < POOL_SIZE) {
      this.pool[this.tail++] = p;
    }
  }

  get freeCount(): number { return this.tail; }
}

// ─── Particle System ──────────────────────────────────────────────────────────
//
// Manages particle lifecycle and per-frame movement.
//
// Key design decisions:
// • Arc-length based movement: particle.distance += particle.speed * dt
//   → constant visual speed regardless of curve shape (unlike t-based movement)
// • Object pooling: zero per-frame allocation
// • Phase spread: initial distance = (i / count) * totalLength
//   → particles spread evenly along the edge from the start
// • Speed variance: each particle gets ±variance offset to avoid marching ants

export class ParticleSystem {
  private pool = new ParticlePool();
  /** edgeId → particles on that edge */
  private edgeParticles = new Map<string, Particle[]>();
  /** Override particle count for all edges */
  private _globalCount: number | undefined;

  // ─── Public API ─────────────────────────────────────────────────────────────

  setGlobalParticleCount(count: number | undefined): void {
    this._globalCount = count;
  }

  /** Called when the edge list changes. Reconciles particle assignments. */
  syncEdges(edges: Edge[]): void {
    const incoming = new Set(edges.map(e => e.id));

    // Release particles for removed edges
    for (const [eid, particles] of this.edgeParticles) {
      if (!incoming.has(eid)) {
        for (const p of particles) this.pool.release(p);
        this.edgeParticles.delete(eid);
      }
    }

    // Allocate / trim particles for each edge
    for (const edge of edges) {
      const desired = this._globalCount ?? edge.particles.count;
      const current = this.edgeParticles.get(edge.id);

      if (!current) {
        // New edge — allocate all at once
        const newParts: Particle[] = [];
        const length = edge.path.totalLength > 0 ? edge.path.totalLength : 400;
        const speed  = edge.particles.speed;
        const vari   = edge.particles.speedVariance;
        const trail  = Math.min(edge.particles.trailLength, MAX_TRAIL);

        for (let i = 0; i < desired; i++) {
          const p = this.pool.acquire();
          if (!p) break;
          p.edgeId   = edge.id;
          p.trailCap = trail;
          // Spread particles evenly with phase offset
          p.distance = (i / Math.max(1, desired)) * length;
          // Per-particle speed variance creates natural spread (avoids marching ants)
          p.speed    = speed + (vari > 0 ? (Math.random() * 2 - 1) * vari : 0);
          newParts.push(p);
        }
        this.edgeParticles.set(edge.id, newParts);
      } else {
        // Existing edge — adjust count
        if (current.length < desired) {
          const length = edge.path.totalLength > 0 ? edge.path.totalLength : 400;
          const speed  = edge.particles.speed;
          const vari   = edge.particles.speedVariance;
          const trail  = Math.min(edge.particles.trailLength, MAX_TRAIL);

          for (let i = current.length; i < desired; i++) {
            const p = this.pool.acquire();
            if (!p) break;
            p.edgeId   = edge.id;
            p.trailCap = trail;
            p.distance = (i / Math.max(1, desired)) * (edge.path.totalLength || 400);
            p.speed    = speed + (vari > 0 ? (Math.random() * 2 - 1) * vari : 0);
            current.push(p);
          }
        } else if (current.length > desired) {
          const excess = current.splice(desired);
          for (const p of excess) this.pool.release(p);
        }
      }
    }
  }

  addEdge(edge: Edge): void {
    if (this.edgeParticles.has(edge.id)) return; // already tracked

    const desired = this._globalCount ?? edge.particles.count;
    const newParts: Particle[] = [];
    const length = edge.path.totalLength > 0 ? edge.path.totalLength : 400;
    const speed  = edge.particles.speed;
    const vari   = edge.particles.speedVariance;
    const trail  = Math.min(edge.particles.trailLength, MAX_TRAIL);

    for (let i = 0; i < desired; i++) {
      const p = this.pool.acquire();
      if (!p) break;
      p.edgeId   = edge.id;
      p.trailCap = trail;
      p.distance = (i / Math.max(1, desired)) * length;
      p.speed    = speed + (vari > 0 ? (Math.random() * 2 - 1) * vari : 0);
      newParts.push(p);
    }
    this.edgeParticles.set(edge.id, newParts);
  }

  removeEdge(edgeId: string): void {
    const pts = this.edgeParticles.get(edgeId);
    if (pts) {
      for (const p of pts) this.pool.release(p);
      this.edgeParticles.delete(edgeId);
    }
  }

  // ─── Per-Frame Update ────────────────────────────────────────────────────────

  /**
   * Move all particles by deltaTime.
   * Uses arc-length parameterization: distance += speed * dt, then
   * position = edge.path.getPointAtLength(distance).
   *
   * @param dt         Delta time in seconds (capped by Ticker at 100ms)
   * @param edges      Active (animating) edges this frame
   * @param activeSet  Set of edge IDs that should animate (flow mode filter)
   */
  update(dt: number, edges: Edge[], activeSet: Set<string> | null): void {
    for (const edge of edges) {
      const pts = this.edgeParticles.get(edge.id);
      if (!pts || pts.length === 0) continue;

      // Flow mode: skip inactive edges (don't clear position — particles stay put)
      if (activeSet !== null && !activeSet.has(edge.id)) continue;

      const total = edge.path.totalLength;
      if (total < 0.1) continue; // degenerate edge

      for (const p of pts) {
        if (!p.active) continue;

        // Arc-length movement — constant speed
        p.distance += p.speed * dt;
        if (p.distance >= total) p.distance -= total; // seamless loop
        if (p.distance < 0)     p.distance += total;

        // Position lookup via arc-length LUT
        const pos = edge.path.getPointAtLength(p.distance);
        p.x     = pos.x;
        p.y     = pos.y;
        p.angle = pos.angle;

        // Trail history
        p.pushTrail(p.x, p.y);
      }
    }
  }

  // ─── Accessors ───────────────────────────────────────────────────────────────

  getParticlesForEdge(edgeId: string): Particle[] {
    return this.edgeParticles.get(edgeId) ?? [];
  }

  /** Iterate all active particles (avoids building a combined array each frame) */
  forEach(fn: (particles: Particle[], edgeId: string) => void): void {
    for (const [edgeId, particles] of this.edgeParticles) {
      fn(particles, edgeId);
    }
  }

  clear(): void {
    for (const pts of this.edgeParticles.values()) {
      for (const p of pts) this.pool.release(p);
    }
    this.edgeParticles.clear();
  }

  get poolFreeCount(): number { return this.pool.freeCount; }
}
