import type { EdgeDefinition, EdgeParticleConfig } from '../types/index';
import { BezierPath } from '../geometry/Bezier';
import type { Node } from './Node';

// ─── Resolved Edge Particle Defaults ─────────────────────────────────────────

const PARTICLE_DEFAULTS: Required<EdgeParticleConfig> = {
  count:         3,
  speed:         120,    // px/s — default ~120 logical pixels per second
  speedVariance: 0,
  size:          4,
  shape:         'dot',
  color:         '',
  glowColor:     '',
  glow:          1,
  trailLength:   28,
  glowRadius:    6,
  phaseOffset:   0,
};

const EDGE_DEFAULTS = {
  curvature:   0.3,
  color:       '#4f8ef7',
  width:       1.5,
  opacity:     0.5,
  dashed:      false,
  dashArray:   '6 3',
};

// ─── Edge Entity ─────────────────────────────────────────────────────────────
//
// An Edge owns its BezierPath which is recomputed whenever source or target
// node positions change. Edges connect to node shape boundaries — not centers.

export class Edge {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;

  curvature: number;
  curvature2: number;
  controlPointOffset?: { x: number; y: number };
  color: string;
  width: number;
  opacity: number;
  dashed: boolean;
  dashArray: string;
  particles: Required<EdgeParticleConfig>;

  /** Computed bezier path — rebuilt on node move */
  path: BezierPath;

  /** Raw definition reference */
  definition: EdgeDefinition;

  /** Interaction state */
  hovered = false;

  constructor(
    def: EdgeDefinition,
    configDefaults: Partial<typeof EDGE_DEFAULTS & { particles?: Partial<EdgeParticleConfig> }> = {}
  ) {
    const d = { ...EDGE_DEFAULTS, ...configDefaults };

    this.id       = def.id;
    this.sourceId = def.source;
    this.targetId = def.target;

    this.curvature           = def.curvature           ?? d.curvature;
    this.curvature2          = def.curvature2          ?? this.curvature;
    this.controlPointOffset  = def.controlPointOffset;
    this.color               = def.color               ?? d.color;
    this.width               = def.width               ?? d.width;
    this.opacity             = def.opacity             ?? d.opacity;
    this.dashed              = def.dashed              ?? d.dashed;
    this.dashArray           = def.dashArray           ?? d.dashArray;
    this.definition          = def;

    // Merge particle config: defaults → config defaults → per-edge def
    const cfgParts = configDefaults.particles ?? {};
    const defParts = def.particles ?? {};
    const baseColor = def.color ?? d.color;
    this.particles = {
      ...PARTICLE_DEFAULTS,
      ...cfgParts,
      ...defParts,
      color:     defParts.color     ?? cfgParts.color     ?? baseColor,
      glowColor: defParts.glowColor ?? cfgParts.glowColor ?? defParts.color ?? baseColor,
    };

    // Build a degenerate path initially — caller must call buildPath() with nodes
    const origin = { x: 0, y: 0 };
    this.path = BezierPath.fromBoundaryPoints(origin, origin, origin, origin, 0);
  }

  // ─── Geometry ───────────────────────────────────────────────────────────────

  /**
   * Rebuild the bezier path using current node positions.
   * Edges connect to node shape boundaries — not centers.
   * Must be called after any node position change.
   */
  buildPath(sourceNode: Node, targetNode: Node): void {
    const srcCenter = { x: sourceNode.x, y: sourceNode.y };
    const tgtCenter = { x: targetNode.x, y: targetNode.y };

    // Compute boundary attachment points
    const srcBP = sourceNode.getBoundaryToward(tgtCenter);
    const tgtBP = targetNode.getBoundaryToward(srcCenter);

    this.path = BezierPath.fromBoundaryPoints(
      srcBP, tgtBP,
      srcCenter, tgtCenter,
      this.curvature,
      this.curvature2,
      this.controlPointOffset
    );
  }

  // ─── Rendering ──────────────────────────────────────────────────────────────

  /**
   * Draw the edge line on canvas using its pre-computed SVG path string.
   * Particles and glow effects are rendered by Renderer separately.
   */
  renderLine(ctx: CanvasRenderingContext2D): void {
    const path = new Path2D(this.path.svgD);

    // Always visible at base opacity; hovered state adds a subtle highlight
    const lineWidth = this.hovered ? this.width * 1.8 : this.width;
    const opacity   = this.hovered ? Math.min(this.opacity * 1.6, 1) : this.opacity;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = lineWidth;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    if (this.dashed) {
      const parts = this.dashArray.split(/\s+/).map(Number).filter(isFinite);
      ctx.setLineDash(parts.length ? parts : [6, 3]);
    }

    if (this.hovered) {
      ctx.shadowBlur  = 6;
      ctx.shadowColor = this.color;
    }

    ctx.stroke(path);
    ctx.restore();
  }

  // ─── Mutation ───────────────────────────────────────────────────────────────

  update(def: EdgeDefinition, configDefaults: Partial<typeof EDGE_DEFAULTS & { particles?: Partial<EdgeParticleConfig> }> = {}): void {
    this.definition        = def;
    this.curvature         = def.curvature         ?? EDGE_DEFAULTS.curvature;
    this.curvature2        = def.curvature2        ?? this.curvature;
    this.controlPointOffset = def.controlPointOffset;
    this.color             = def.color             ?? configDefaults.color     ?? EDGE_DEFAULTS.color;
    this.width             = def.width             ?? configDefaults.width     ?? EDGE_DEFAULTS.width;
    this.opacity           = def.opacity           ?? configDefaults.opacity   ?? EDGE_DEFAULTS.opacity;
    this.dashed            = def.dashed            ?? EDGE_DEFAULTS.dashed;
    this.dashArray         = def.dashArray         ?? EDGE_DEFAULTS.dashArray;

    const cfgParts = configDefaults.particles ?? {};
    const defParts = def.particles ?? {};
    const baseColor = def.color ?? this.color;
    this.particles = {
      ...PARTICLE_DEFAULTS,
      ...cfgParts,
      ...defParts,
      color:     defParts.color     ?? cfgParts.color     ?? baseColor,
      glowColor: defParts.glowColor ?? cfgParts.glowColor ?? defParts.color ?? baseColor,
    };
  }
}
