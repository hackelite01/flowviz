// ─── Node ────────────────────────────────────────────────────────────────────

export type NodeShape = 'circle' | 'rect' | 'hexagon' | 'diamond' | 'ring' | string;

export interface NodeDefinition {
  id: string;
  label?: string;

  // Layout hints
  x?: number;
  y?: number;
  layer?: number;
  gridRow?: number;
  gridCol?: number;

  // Visuals
  shape?: NodeShape;
  size?: number;
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

export type ParticleShape = 'dot' | 'rect' | 'streak' | 'ring' | string;

export interface EdgeParticleConfig {
  count?: number;
  speed?: number;
  size?: number;
  shape?: ParticleShape;
  color?: string;
  trailLength?: number;
  glowRadius?: number;
  glowColor?: string;
}

export interface EdgeDefinition {
  id: string;
  source: string;
  target: string;

  // Path
  curvature?: number;
  controlPointOffset?: { x: number; y: number };

  // Visuals
  color?: string;
  width?: number;
  opacity?: number;
  dashed?: boolean;
  dashArray?: string;

  // Particles
  particles?: EdgeParticleConfig;
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export type LayoutType = 'manual' | 'grid' | 'layered' | 'force';

export interface GridLayoutConfig {
  rows?: number;
  cols?: number;
  padding?: number;
}

export interface LayeredLayoutConfig {
  direction?: 'LR' | 'TB';
  stagePadding?: number;
  nodePadding?: number;
}

export interface ForceLayoutConfig {
  strength?: number;
  linkDistance?: number;
  iterations?: number;
  chargeStrength?: number;
}

export interface LayoutConfig {
  type?: LayoutType;
  grid?: GridLayoutConfig;
  layered?: LayeredLayoutConfig;
  force?: ForceLayoutConfig;
}

// ─── Background ──────────────────────────────────────────────────────────────

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

// ─── Animation ───────────────────────────────────────────────────────────────

export interface AnimationConfig {
  paused?: boolean;
  globalSpeed?: number;
  particleCount?: number;
}

// ─── Render ──────────────────────────────────────────────────────────────────

export interface RenderConfig {
  /**
   * Draw a subtle glowing tube behind each bezier edge path.
   * Great for dashboards that need *some* glow without the full neon look.
   * Default: false
   */
  edgeTubes?: boolean;

  /**
   * Opacity multiplier (0–1) applied to the edge tube glow.
   * Default: 0.6
   */
  tubeOpacity?: number;

  /**
   * Draw heavy multi-layer neon light-ray beams on every edge.
   * Recreates the fiber-optic / deep-space aesthetic.
   * Takes priority over edgeTubes when both are true.
   * Default: false
   */
  neonBeams?: boolean;

  /**
   * Alpha of the background fill used as a motion-blur trail-fade each frame.
   * Lower value = trails linger longer (more ghost persistence).
   * Range 0–1. Default: 0.18
   */
  trailFadeAlpha?: number;

  /**
   * Disable the motion-blur trail-fade entirely (clears canvas each frame).
   * Useful when showDots / showGrid are on so the bg pattern stays crisp.
   * Default: false
   */
  noTrailFade?: boolean;

  /**
   * Canvas compositing for particles.
   * 'screen'       – additive light blending; particles glow and overlap brightly.
   * 'source-over'  – normal alpha compositing; cleaner, flatter look.
   * Default: 'screen'
   */
  particleBlend?: 'screen' | 'source-over';

  /**
   * Draw a radial glow bloom around each particle head.
   * Set to false for a clean, sharp-dot look (like DetectFlow).
   * Default: true
   */
  particleGlow?: boolean;

  /**
   * Draw a dark radial vignette that fades the canvas edges to black.
   * Enhances depth in the neon / deep-space aesthetic.
   * Default: false
   */
  vignette?: boolean;
}

// ─── Root Config ─────────────────────────────────────────────────────────────

export interface FlowVizConfig {
  layout?: LayoutConfig;
  animation?: AnimationConfig;
  background?: BackgroundConfig;
  render?: RenderConfig;
  defaults?: {
    node?: Partial<NodeDefinition>;
    edge?: Partial<EdgeDefinition>;
  };
  onNodeClick?: (node: NodeDefinition, event: MouseEvent) => void;
  onNodeHover?: (node: NodeDefinition | null, event: MouseEvent) => void;
  onEdgeClick?: (edge: EdgeDefinition, event: MouseEvent) => void;
  onEdgeHover?: (edge: EdgeDefinition | null, event: MouseEvent) => void;
}

// ─── Resolved (internal, after merging defaults) ─────────────────────────────

export interface ResolvedNode extends Required<Pick<NodeDefinition, 'id' | 'shape' | 'size' | 'color' | 'opacity'>> {
  id: string;
  label: string;
  x: number;
  y: number;
  shape: NodeShape;
  size: number;
  color: string;
  borderColor: string;
  borderWidth: number;
  glowColor: string;
  glowRadius: number;
  labelColor: string;
  labelSize: number;
  icon?: string;
  opacity: number;
  layer: number;
  gridRow: number;
  gridCol: number;
  data: Record<string, unknown>;
  // raw definition reference
  definition: NodeDefinition;
}

export interface ResolvedEdge {
  id: string;
  source: string;
  target: string;
  curvature: number;
  controlPointOffset?: { x: number; y: number };
  color: string;
  width: number;
  opacity: number;
  dashed: boolean;
  dashArray: string;
  particles: Required<EdgeParticleConfig>;
  definition: EdgeDefinition;
}

// ─── Particle (internal) ─────────────────────────────────────────────────────

export interface ParticleState {
  id: number;
  edgeId: string;
  t: number;          // 0–1 position along path
  x: number;
  y: number;
  angle: number;      // tangent angle for streak rotation
  active: boolean;
  // trail history
  trail: Array<{ x: number; y: number }>;
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
  | 'engine:pause'
  | 'engine:resume'
  | 'graph:update';

export interface EngineEvent<T = unknown> {
  type: EngineEventType;
  payload: T;
  timestamp: number;
}

// ─── Layout Strategy Interface ───────────────────────────────────────────────

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
}

export interface LayoutStrategy {
  compute(
    nodes: NodeDefinition[],
    edges: EdgeDefinition[],
    bounds: { width: number; height: number }
  ): LayoutResult;
}

// ─── Shape Drawer ─────────────────────────────────────────────────────────────

export type ShapeDrawFn = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  angle: number,
  alpha: number
) => void;
