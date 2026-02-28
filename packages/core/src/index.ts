// ─── FlowViz Core Library ─────────────────────────────────────────────────────
// Headless, framework-agnostic, high-performance 2D flow visualization engine.
// Pure Canvas2D. No SVG. No WebGL. No external animation libraries.
//
// Architecture overview:
//   FlowEngine          – main façade; owns the tick loop and graph state
//   Ticker              – RAF loop with deltaTime + speed multiplier
//   Renderer            – Canvas2D render pipeline (background → edges → particles → nodes)
//   ParticleSystem      – object-pooled arc-length particles (4096 pre-allocated)
//   InteractionSystem   – centralized canvas hit testing (hover, click, touch)
//   BezierPath          – arc-length-parameterized cubic bezier with 512-sample LUT
//   PathLengthTable     – reusable arc-length LUT for any sampled parametric curve
//   NodeShapes          – shape boundary math + canvas drawing for all node shapes
//   ShapeRegistry       – extensible registry for custom particle shape renderers

// ─── Main Engine ─────────────────────────────────────────────────────────────
export { FlowEngine } from './core/FlowEngine';

// ─── Sub-systems (advanced / custom usage) ───────────────────────────────────
export { Ticker }             from './core/Ticker';
export { Renderer }           from './core/Renderer';
export { ParticleSystem }     from './systems/ParticleSystem';
export { InteractionSystem }  from './systems/InteractionSystem';

// ─── Entities ────────────────────────────────────────────────────────────────
export { Node }     from './entities/Node';
export { Edge }     from './entities/Edge';
export { Particle, MAX_TRAIL } from './entities/Particle';

// ─── Geometry ────────────────────────────────────────────────────────────────
export { BezierPath }         from './geometry/Bezier';
export { PathLengthTable }    from './geometry/PathLengthTable';
export { getBoundaryPoint, hitTestNode, drawNodeShape } from './geometry/NodeShapes';
export * from './geometry/Vec2';

// ─── Shape Registry (custom particle shapes) ─────────────────────────────────
export { ShapeRegistry }      from './renderer/ShapeRegistry';

// ─── Layout ──────────────────────────────────────────────────────────────────
export { ManualLayout, GridLayout, LayeredLayout, ForceLayout, createLayout } from './layout/index';

// ─── Types (all public) ───────────────────────────────────────────────────────
export type {
  // Primitives
  Vec2,

  // Shape types
  NodeShape,
  ParticleShape,
  FlowMode,

  // Graph definitions (user-facing input types)
  NodeDefinition,
  EdgeDefinition,
  EdgeParticleConfig,

  // Configuration — simple API
  FlowConfig,
  FlowVizConfig,       // backward-compat alias for FlowConfig
  BackgroundConfig,
  AnimationConfig,
  RenderConfig,
  LayoutConfig,

  // Engine options
  EngineOptions,

  // Internals (for advanced use / React wrapper)
  LayoutStrategy,
  LayoutResult,
  EngineEventType,
  ShapeDrawFn,
} from './types/index';

// ─── Geometry types ───────────────────────────────────────────────────────────
export type { CubicBezierCurve, PointOnCurve }           from './geometry/Bezier';
export type { SampledPoint, LengthTableEntry }            from './geometry/PathLengthTable';
