import type { NodeDefinition, NodeShape } from '../types/index';
import type { Vec2 } from '../geometry/Vec2';
import { getBoundaryPoint, hitTestNode, drawNodeShape } from '../geometry/NodeShapes';

// ─── Resolved Node Defaults ───────────────────────────────────────────────────

const DEFAULTS = {
  shape:       'circle' as NodeShape,
  radius:      22,
  width:       44,
  height:      44,
  color:       '#0d1b3e',
  borderColor: '#3d7fff',
  borderWidth: 1.5,
  glowColor:   '#3d7fff',
  glowRadius:  12,
  labelColor:  '#e8eaf6',
  labelSize:   12,
  opacity:     1,
};

// ─── Node Entity ─────────────────────────────────────────────────────────────
//
// Wraps a NodeDefinition with resolved defaults.
// Provides geometry (boundary, hit-test) and rendering.

export class Node {
  readonly id: string;

  // Resolved position (mutated by layout + drag)
  x: number;
  y: number;

  // Resolved visual properties
  shape:       NodeShape;
  radius:      number;
  width:       number;
  height:      number;
  color:       string;
  borderColor: string;
  borderWidth: number;
  glowColor:   string;
  glowRadius:  number;
  label:       string;
  labelColor:  string;
  labelSize:   number;
  icon:        string;
  opacity:     number;
  data:        Record<string, unknown>;
  layer:       number;
  gridRow:     number;
  gridCol:     number;

  /** Raw definition reference — passed to event callbacks */
  definition: NodeDefinition;

  /** Interaction state — managed by InteractionSystem */
  hovered = false;

  constructor(
    def: NodeDefinition,
    configDefaults: Partial<typeof DEFAULTS> = {}
  ) {
    const d = { ...DEFAULTS, ...configDefaults };

    this.id = def.id;

    // Resolve position (0 if not provided — layout will override)
    this.x = def.x ?? 0;
    this.y = def.y ?? 0;

    // Shape
    this.shape = def.shape ?? d.shape;

    // Size resolution:
    // 1. Explicit radius
    // 2. size/2 (backward compat — 'size' was the old field)
    // 3. Default radius
    const explicitRadius = def.radius ?? (def.size != null ? def.size / 2 : undefined);
    this.radius = explicitRadius ?? d.radius;
    this.width  = def.width  ?? (explicitRadius != null ? explicitRadius * 2 : d.width);
    this.height = def.height ?? (explicitRadius != null ? explicitRadius * 2 : d.height);

    this.color       = def.color       ?? d.color;
    this.borderColor = def.borderColor ?? d.borderColor;
    this.borderWidth = def.borderWidth ?? d.borderWidth;
    this.glowColor   = def.glowColor   ?? d.glowColor;
    this.glowRadius  = def.glowRadius  ?? d.glowRadius;
    this.label       = def.label       ?? def.id;
    this.labelColor  = def.labelColor  ?? d.labelColor;
    this.labelSize   = def.labelSize   ?? d.labelSize;
    this.icon        = def.icon        ?? '';
    this.opacity     = def.opacity     ?? d.opacity;
    this.data        = def.data        ?? {};
    this.layer       = def.layer       ?? 0;
    this.gridRow     = def.gridRow     ?? 0;
    this.gridCol     = def.gridCol     ?? 0;
    this.definition  = def;
  }

  // ─── Geometry ───────────────────────────────────────────────────────────────

  /**
   * Returns the boundary point on this node's shape facing toward `target`.
   * Used by Edge.buildPath() to attach edges to the shape surface.
   */
  getBoundaryToward(target: Vec2): Vec2 {
    return getBoundaryPoint(this, target);
  }

  /**
   * Returns true if `point` is inside this node (with optional hit padding).
   */
  hitTest(point: Vec2, padding = 8): boolean {
    return hitTestNode(this, point, padding);
  }

  // ─── Rendering ──────────────────────────────────────────────────────────────

  render(ctx: CanvasRenderingContext2D): void {
    const glowScale = this.hovered ? 1.6 : 1.0;
    const stroke    = this.hovered ? this.glowColor   : this.borderColor;
    const sw        = this.hovered ? this.borderWidth * 2 : this.borderWidth;

    drawNodeShape(
      ctx, this,
      this.color, stroke, sw,
      this.opacity,
      this.glowColor, this.glowRadius * glowScale
    );

    // Icon (emoji / unicode symbol centered in shape)
    if (this.icon) {
      ctx.save();
      ctx.globalAlpha  = this.opacity * 0.9;
      ctx.font         = `${this.radius * 0.9}px sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur   = 0;
      ctx.fillStyle    = this.labelColor;
      ctx.fillText(this.icon, this.x, this.y);
      ctx.restore();
    }

    // Label (below shape)
    if (this.label) {
      ctx.save();
      ctx.globalAlpha  = this.opacity * 0.85;
      ctx.font         = `500 ${this.labelSize}px 'JetBrains Mono','Fira Code',monospace`;
      ctx.fillStyle    = this.hovered ? this.glowColor : this.labelColor;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.shadowBlur   = this.hovered ? 8 : 0;
      ctx.shadowColor  = this.glowColor;
      ctx.fillText(this.label, this.x, this.y + this.radius + 5);
      ctx.restore();
    }
  }

  // ─── Mutation ───────────────────────────────────────────────────────────────

  /** Update position (called by layout engine or dragging) */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /** Update mutable visual properties from a new definition */
  update(def: NodeDefinition, configDefaults: Partial<typeof DEFAULTS> = {}): void {
    if (def.x != null) this.x = def.x;
    if (def.y != null) this.y = def.y;
    this.definition = def;
    // Re-resolve visuals (position is preserved above)
    const updated = new Node(def, configDefaults);
    this.shape       = updated.shape;
    this.radius      = updated.radius;
    this.width       = updated.width;
    this.height      = updated.height;
    this.color       = updated.color;
    this.borderColor = updated.borderColor;
    this.borderWidth = updated.borderWidth;
    this.glowColor   = updated.glowColor;
    this.glowRadius  = updated.glowRadius;
    this.label       = updated.label;
    this.labelColor  = updated.labelColor;
    this.labelSize   = updated.labelSize;
    this.icon        = updated.icon;
    this.opacity     = updated.opacity;
  }
}
