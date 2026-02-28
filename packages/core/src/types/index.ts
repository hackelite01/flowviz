// ─── Primitives ───────────────────────────────────────────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

// ─── Shape Types ─────────────────────────────────────────────────────────────

/**
 * Node shapes supported by the engine.
 * 'rect', 'diamond', 'ring' are backward-compat aliases mapped internally.
 */
export type NodeShape =
  | 'circle'
  | 'square'
  | 'roundedRect'
  | 'hexagon'
  | 'triangle'
  | 'rect'      // alias → square
  | 'diamond'   // alias → rotated square
  | 'ring'      // alias → circle outline
  | string;

export type ParticleShape = 'dot' | 'streak' | 'ring' | string;

// ─── Flow Mode ───────────────────────────────────────────────────────────────

/**
 * always  — all edges animate continuously
 * hover   — only edges connected to the hovered node/edge animate
 * manual  — only edges activated via engine.trigger(edgeId)
 */
export type FlowMode = 'always' | 'hover' | 'manual';

// ─── Node ────────────────────────────────────────────────────────────────────

export interface NodeDefinition {
  id: string;
  label?: string;

  // Position (required for manual layout; computed by layout strategies otherwise)
  x?: number;
  y?: number;

  // Layout hints
  layer?: number;
  gridRow?: number;
  gridCol?: number;

  // Shape
  shape?: NodeShape;
  /** Uniform size shorthand — sets radius = size/2, width = height = size */
  size?: number;
  /** Explicit radius (circle, hexagon, triangle). Takes priority over size. */
  radius?: number;
  width?: number;
  height?: number;

  // Visuals
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  glowColor?: string;
  glowRadius?: number;
  labelColor?: string;
  labelSize?: number;
  icon?: string;
  opacity?: number;

  // User payload
  data?: Record<string, unknown>;
}

// ─── Edge ────────────────────────────────────────────────────────────────────

export interface EdgeParticleConfig {
  /** Fixed particle count on this edge */
  count?: number;
  /** Base speed in logical-pixels / second */
  speed?: number;
  /** ±variance added to per-particle speed (creates natural spread) */
  speedVariance?: number;
  /** Particle radius in logical pixels */
  size?: number;
  shape?: ParticleShape;
  color?: string;
  glowColor?: string;
  /** Glow intensity multiplier 0–2. Default 1. */
  glow?: number;
  /** Trail history length (number of recorded positions). Default 28. */
  trailLength?: number;
  /** Deprecated alias for trailLength */
  glowRadius?: number;
  /** Initial phase offset 0–1 for staggered starts. Auto-computed if omitted. */
  phaseOffset?: number;
}

export interface EdgeDefinition {
  id: string;
  source: string;
  target: string;

  // Path
  curvature?: number;
  /**
   * Target-side curvature. When different from `curvature`, gives asymmetric or
   * S-shaped arcs (freeform / organic curves). Defaults to `curvature`.
   */
  curvature2?: number;
  controlPointOffset?: Vec2;

  // Visuals
  color?: string;
  width?: number;
  opacity?: number;
  dashed?: boolean;
  dashArray?: string;

  // Particles
  particles?: EdgeParticleConfig;
}

// ─── Config ──────────────────────────────────────────────────────────────────

export interface BackgroundConfig {
  color?: string;
  gradient?: [string, string];
  gradientAngle?: number;
  showGrid?: boolean;
  gridColor?: string;
  gridSpacing?: number;
  showDots?: boolean;
  dotColor?: string;
  dotSpacing?: number;
}

export interface AnimationConfig {
  paused?: boolean;
  globalSpeed?: number;
  particleCount?: number;
}

export interface RenderConfig {
  /** Subtle glow tube behind each bezier edge. Default: false. */
  edgeTubes?: boolean;
  /** Tube glow opacity multiplier 0–1. Default: 0.6. */
  tubeOpacity?: number;
  /** Heavy 6-layer neon beam on every edge. Default: false. */
  neonBeams?: boolean;
  /** Per-frame trail-fade alpha 0–1. Lower = longer persistence. Default: 0.18. */
  trailFadeAlpha?: number;
  /** Disable trail-fade, clear canvas each frame (keeps background pattern crisp). Default: false. */
  noTrailFade?: boolean;
  /** Canvas blend mode for particles. Default: 'screen'. */
  particleBlend?: 'screen' | 'lighter' | 'source-over';
  /** Radial glow bloom on particle heads. Default: true. */
  particleGlow?: boolean;
  /** Dark radial vignette at canvas edges. Default: false. */
  vignette?: boolean;
}

export interface LayoutConfig {
  type?: 'manual' | 'grid' | 'layered' | 'force';
  grid?: { rows?: number; cols?: number; padding?: number };
  layered?: { direction?: 'LR' | 'TB'; stagePadding?: number; nodePadding?: number };
  /**
   * Options for the force-directed layout.
   * `d3force` must be passed explicitly (the module is not bundled):
   *   import * as d3 from 'd3-force';
   *   config: { layout: { type: 'force', force: { d3force: d3 } } }
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  force?: { strength?: number; linkDistance?: number; iterations?: number; chargeStrength?: number; d3force?: any };
}

/**
 * Top-level engine configuration.
 * FlowVizConfig is an alias kept for backward compatibility.
 */
export interface FlowConfig {
  // ── Shorthand API (DetectFlow-style simple configuration) ─────────────────
  /** Default particle radius in logical pixels. Recommended: 2–4. Default: 3 */
  particleSize?: number;
  /**
   * Particles per edge (global density shorthand).
   * Equivalent to defaults.edge.particles.count. Default: 3
   */
  particleDensity?: number;
  /** Default particle speed in logical-pixels per second. Default: 120 */
  particleSpeed?: number;
  /**
   * Trail fade per frame: alpha of background fill laid over the previous frame.
   * Lower = longer, more persistent trails. Maps to render.trailFadeAlpha.
   * Range 0–1. Default: 0.18
   */
  trailDecay?: number;
  /** Glow bloom intensity multiplier (0 = no glow, 2 = very bright). Default: 1 */
  glowIntensity?: number;
  /** Default edge stroke width in logical pixels. Default: 1.5 */
  edgeWidth?: number;
  /** Default bezier curvature (signed perpendicular offset ratio). Default: 0.3 */
  curvature?: number;
  /** Flow animation mode. Default: 'always'. */
  flowMode?: FlowMode;

  // ── Structured config blocks ──────────────────────────────────────────────
  layout?: LayoutConfig;
  animation?: AnimationConfig;
  background?: BackgroundConfig;
  render?: RenderConfig;

  // ── Per-type defaults ─────────────────────────────────────────────────────
  defaults?: {
    node?: Partial<NodeDefinition>;
    edge?: Partial<EdgeDefinition>;
  };

  // ── Event callbacks (fired by centralized InteractionSystem) ──────────────
  onNodeClick?: (node: NodeDefinition, e: MouseEvent) => void;
  onNodeHover?: (node: NodeDefinition | null, e: MouseEvent) => void;
  onEdgeClick?: (edge: EdgeDefinition, e: MouseEvent) => void;
  onEdgeHover?: (edge: EdgeDefinition | null, e: MouseEvent) => void;
}

/** Backward-compatibility alias */
export type FlowVizConfig = FlowConfig;

// ─── Engine options ───────────────────────────────────────────────────────────

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  nodes?: NodeDefinition[];
  edges?: EdgeDefinition[];
  config?: FlowConfig;
  width?: number;
  height?: number;
}

// ─── Layout Strategy ─────────────────────────────────────────────────────────

export interface LayoutResult {
  positions: Map<string, Vec2>;
}

export interface LayoutStrategy {
  compute(
    nodes: NodeDefinition[],
    edges: EdgeDefinition[],
    bounds: { width: number; height: number }
  ): LayoutResult;
}

// ─── Engine Events ────────────────────────────────────────────────────────────

export type EngineEventType =
  | 'node:click'
  | 'node:hover'
  | 'node:hoverend'
  | 'edge:click'
  | 'edge:hover'
  | 'edge:hoverend'
  | 'engine:start'
  | 'engine:stop'
  | 'engine:pause'
  | 'engine:resume'
  | 'graph:update';

// ─── Shape Drawer (for ShapeRegistry custom particle shapes) ──────────────────

/**
 * Function signature for a custom particle shape renderer.
 * Register custom shapes via `ShapeRegistry.register(name, fn)`.
 *
 * @param ctx    Canvas 2D context (already configured for composite/alpha)
 * @param x      Particle world X
 * @param y      Particle world Y
 * @param size   Particle size in logical pixels
 * @param color  Hex or rgb string (e.g. '#4f8ef7')
 * @param angle  Tangent direction in radians (for streak orientation)
 * @param alpha  Overall opacity 0–1
 */
export type ShapeDrawFn = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  angle: number,
  alpha: number
) => void;
