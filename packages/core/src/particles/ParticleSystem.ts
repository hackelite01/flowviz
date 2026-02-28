import type { ParticleState, ResolvedEdge } from '../types';

let _nextId = 0;

function makeParticle(): ParticleState {
  return {
    id: _nextId++,
    edgeId: '',
    t: 0,
    x: 0,
    y: 0,
    angle: 0,
    active: false,
    trail: [],
  };
}

// ─── Object Pool ──────────────────────────────────────────────────────────────

export class ParticlePool {
  private pool: ParticleState[] = [];

  acquire(): ParticleState {
    const p = this.pool.pop() ?? makeParticle();
    p.active = true;
    p.trail = [];
    return p;
  }

  release(p: ParticleState): void {
    p.active = false;
    p.trail = [];
    this.pool.push(p);
  }

  get size(): number { return this.pool.length; }
}

// ─── Particle System ──────────────────────────────────────────────────────────

export class ParticleSystem {
  private pool = new ParticlePool();
  // edgeId → particles on that edge
  private edgeParticles = new Map<string, ParticleState[]>();
  private _globalParticleCount: number | undefined;

  setGlobalParticleCount(count: number | undefined): void {
    this._globalParticleCount = count;
  }

  syncEdges(edges: ResolvedEdge[]): void {
    const incomingIds = new Set(edges.map(e => e.id));

    // Remove stale edges
    for (const [eid, particles] of this.edgeParticles) {
      if (!incomingIds.has(eid)) {
        for (const p of particles) this.pool.release(p);
        this.edgeParticles.delete(eid);
      }
    }

    // Add/update
    for (const edge of edges) {
      const desired = this._globalParticleCount ?? edge.particles.count;
      const current = this.edgeParticles.get(edge.id) ?? [];

      if (current.length < desired) {
        // Spawn more, stagger t offsets
        for (let i = current.length; i < desired; i++) {
          const p = this.pool.acquire();
          p.edgeId = edge.id;
          p.t = (i / desired);  // stagger start positions
          current.push(p);
        }
        this.edgeParticles.set(edge.id, current);
      } else if (current.length > desired) {
        // Release excess
        const excess = current.splice(desired);
        for (const p of excess) this.pool.release(p);
      }
    }
  }

  addEdge(edge: ResolvedEdge): void {
    this.syncEdges([edge]);
  }

  removeEdge(edgeId: string): void {
    const particles = this.edgeParticles.get(edgeId);
    if (particles) {
      for (const p of particles) this.pool.release(p);
      this.edgeParticles.delete(edgeId);
    }
  }

  getParticlesForEdge(edgeId: string): ParticleState[] {
    return this.edgeParticles.get(edgeId) ?? [];
  }

  get allParticles(): ParticleState[] {
    const all: ParticleState[] = [];
    for (const particles of this.edgeParticles.values()) {
      for (const p of particles) all.push(p);
    }
    return all;
  }

  update(dt: number, edges: ResolvedEdge[], getLUT: (edgeId: string) => Float32Array | undefined): void {
    for (const edge of edges) {
      const particles = this.edgeParticles.get(edge.id);
      if (!particles) continue;
      const lut = getLUT(edge.id);
      if (!lut) continue;

      const speed = edge.particles.speed;
      const maxTrail = Math.floor(edge.particles.trailLength / 2);

      for (const p of particles) {
        p.t += speed * dt;
        if (p.t > 1) p.t -= 1; // wrap

        // LUT lookup
        const idx = Math.min(Math.floor(p.t * 255), 255);
        p.x = lut[idx * 3];
        p.y = lut[idx * 3 + 1];
        p.angle = lut[idx * 3 + 2];

        // Trail history
        if (maxTrail > 0) {
          p.trail.push({ x: p.x, y: p.y });
          if (p.trail.length > maxTrail) p.trail.shift();
        }
      }
    }
  }

  clear(): void {
    for (const particles of this.edgeParticles.values()) {
      for (const p of particles) this.pool.release(p);
    }
    this.edgeParticles.clear();
  }
}
