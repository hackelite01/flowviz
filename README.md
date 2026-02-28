# ⬡ FlowViz

**High-performance, headless 2D flow visualization engine.**

Animated particle flows over directed graphs — built for data-pipeline dashboards, cybersecurity visualizers, network topology tools, and any application that needs smooth, real-time flow aesthetics.

> By [@mayankrajput](https://github.com/mayankrajput)

---

## Packages

| Package | Description |
|---|---|
| `@flowviz/core` | Framework-agnostic engine. Pure TypeScript, zero dependencies. Pure Canvas2D. |
| `@flowviz/react` | Thin React wrapper. ForwardRef component + `useFlowEngine` hook. |

---

## Design Goals

- **Pure Canvas2D** — no SVG, no WebGL, no CSS animations
- **Arc-length parameterized particles** — constant visual speed regardless of curve shape
- **Object pooling** — 4 096 pre-allocated `Particle` objects, zero GC pressure in the render loop
- **Headless** — no React inside `@flowviz/core`; use any framework or vanilla JS
- **Tree-shakeable** — `"sideEffects": false`, ESM + CJS builds
- **60 fps** at 200+ edges / 2 000+ particles on a mid-range device

---

## Installation

```bash
# React users
npm install @flowviz/react @flowviz/core

# Vanilla / headless
npm install @flowviz/core

# Optional: force-directed layout only
npm install d3-force
```

---

## Quick Start — React

```tsx
import { FlowViz } from '@flowviz/react';
import type { NodeDefinition, EdgeDefinition, FlowConfig } from '@flowviz/core';

const nodes: NodeDefinition[] = [
  { id: 'a', label: 'Ingest',  layer: 0, shape: 'rect',
    color: '#060c1a', borderColor: '#3b82f6', glowColor: '#3b82f6', glowRadius: 8, size: 46 },
  { id: 'b', label: 'Process', layer: 1, shape: 'rect',
    color: '#050d10', borderColor: '#06b6d4', glowColor: '#06b6d4', glowRadius: 8, size: 44 },
  { id: 'c', label: 'Alert',   layer: 2, shape: 'rect',
    color: '#100607', borderColor: '#ef4444', glowColor: '#ef4444', glowRadius: 10, size: 48 },
];

const edges: EdgeDefinition[] = [
  { id: 'e1', source: 'a', target: 'b', color: '#3b82f6',
    particles: { count: 4, speed: 100, speedVariance: 15, shape: 'dot',
                 size: 2.5, trailLength: 8, glowRadius: 5 } },
  { id: 'e2', source: 'b', target: 'c', color: '#ef4444',
    curvature: 0.25, curvature2: 0.10,
    particles: { count: 3, speed: 90, shape: 'dot', size: 2.5, trailLength: 8 } },
];

const config: FlowConfig = {
  layout: { type: 'layered', layered: { direction: 'LR', stagePadding: 120, nodePadding: 80 } },
  background: { color: '#060c18' },
  render: { noTrailFade: true, particleGlow: false, particleBlend: 'source-over' },
};

export default function App() {
  return <FlowViz nodes={nodes} edges={edges} config={config} height={500} />;
}
```

---

## Quick Start — Vanilla (Headless)

```typescript
import { FlowEngine } from '@flowviz/core';
import type { NodeDefinition, EdgeDefinition, FlowConfig } from '@flowviz/core';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;

const engine = new FlowEngine({
  canvas,
  width:  canvas.clientWidth,
  height: canvas.clientHeight,
  nodes: [
    { id: 'src', label: 'SOURCE', layer: 0, shape: 'rect', color: '#060c1a',
      borderColor: '#3b82f6', glowColor: '#3b82f6', glowRadius: 8, size: 46 },
    { id: 'dst', label: 'DEST',   layer: 1, shape: 'rect', color: '#060c1a',
      borderColor: '#22c55e', glowColor: '#22c55e', glowRadius: 8, size: 46 },
  ],
  edges: [
    { id: 'e1', source: 'src', target: 'dst', color: '#3b82f6',
      particles: { count: 4, speed: 100, size: 2.5, shape: 'dot', trailLength: 8 } },
  ],
  config: {
    layout: { type: 'layered', layered: { direction: 'LR' } },
    background: { color: '#060c18' },
    render: { noTrailFade: true, particleGlow: false, particleBlend: 'source-over' },
  },
});

engine.start();

// Resize
window.addEventListener('resize', () => {
  engine.resize(canvas.clientWidth, canvas.clientHeight);
});

// Cleanup
window.addEventListener('beforeunload', () => engine.destroy());
```

---

## `NodeDefinition`

Every node you pass to `nodes` must satisfy this interface:

```typescript
interface NodeDefinition {
  id: string;           // Unique identifier (required)
  label?: string;       // Display label. Falls back to id.

  // ── Position (required for manual layout only) ────────────────────────────
  x?: number;
  y?: number;

  // ── Layout hints ──────────────────────────────────────────────────────────
  layer?:   number;     // Layer index for layered layout
  gridRow?: number;     // Explicit grid row (grid layout)
  gridCol?: number;     // Explicit grid column (grid layout)

  // ── Shape ─────────────────────────────────────────────────────────────────
  shape?: NodeShape;    // See shape table below. Default: 'circle'
  size?:  number;       // Shorthand: sets radius = size/2, width = height = size
  radius?: number;      // Explicit radius (for circle, hexagon, triangle)
  width?:  number;      // Explicit width  (for rect, roundedRect)
  height?: number;      // Explicit height

  // ── Visuals ───────────────────────────────────────────────────────────────
  color?:       string; // Fill color.        Default: '#0d1b3e'
  borderColor?: string; // Stroke color.      Default: '#3d7fff'
  borderWidth?: number; // Stroke width.      Default: 1.5
  glowColor?:   string; // Shadow glow color. Default: matches borderColor
  glowRadius?:  number; // Shadow blur px.    Default: 12
  labelColor?:  string; // Label text color.  Default: '#e8eaf6'
  labelSize?:   number; // Label font size.   Default: 12
  icon?:        string; // Emoji/character rendered inside node
  opacity?:     number; // 0–1. Default: 1

  // ── User data ─────────────────────────────────────────────────────────────
  data?: Record<string, unknown>; // Arbitrary payload — passed back in event callbacks
}
```

### Node Shapes

| `shape` value | Description |
|---|---|
| `'circle'` | Circle (default) |
| `'square'` / `'rect'` | Square / Rectangle |
| `'roundedRect'` | Rounded rectangle |
| `'hexagon'` | Regular hexagon |
| `'triangle'` | Equilateral triangle |
| `'diamond'` | Rotated square |
| `'ring'` | Circle outline (no fill) |

Boundary attachment (where edges attach) is computed **exactly** per shape — edges connect to the geometric boundary, not the bounding box.

---

## `EdgeDefinition`

```typescript
interface EdgeDefinition {
  id: string;       // Unique identifier (required)
  source: string;   // Source node id (required)
  target: string;   // Target node id (required)

  // ── Path ──────────────────────────────────────────────────────────────────
  curvature?:  number;  // Signed perpendicular offset ratio (source-side control point).
                        // 0 = straight. Positive = curves one way, negative = other.
                        // Typical: ±0.1–0.5. Default: 0.3

  curvature2?: number;  // Target-side perpendicular offset. When different from curvature,
                        // produces asymmetric arcs or S-curves.
                        // Same sign as curvature → tapered arc.
                        // Opposite sign → S-curve / freeform.
                        // Default: equals curvature (symmetric arc).

  controlPointOffset?: { x: number; y: number }; // Advanced: additive shift to both control points

  // ── Visuals ───────────────────────────────────────────────────────────────
  color?:     string;   // Edge color. Also defaults particle color. Default: '#4f8ef7'
  width?:     number;   // Edge line width in logical px. Default: 1.5
  opacity?:   number;   // Edge opacity 0–1. Default: 0.5
  dashed?:    boolean;  // Dashed line. Default: false
  dashArray?: string;   // CSS dash pattern e.g. '8 4'. Default: '6 3'

  // ── Particles ─────────────────────────────────────────────────────────────
  particles?: EdgeParticleConfig;
}
```

### Curve Examples

```typescript
// Symmetric arc (default)
{ curvature: 0.3 }

// Gentle taper (wider at source, tighter at target)
{ curvature: 0.25, curvature2: 0.08 }

// S-curve (organic / freeform)
{ curvature: 0.30, curvature2: -0.10 }

// Dramatic feedback loop S-curve
{ curvature: -0.45, curvature2: 0.18 }

// Straight line
{ curvature: 0 }
```

---

## `EdgeParticleConfig`

```typescript
interface EdgeParticleConfig {
  count?:         number; // Particles on this edge. Default: 3
  speed?:         number; // Base speed in logical-pixels / second. Default: 120
                          // Typical range: 60–220. Arc-length based (constant visual speed).
  speedVariance?: number; // ±variance for natural spread. Avoids marching-ants effect. Default: 0
  size?:          number; // Particle radius in logical px. Default: 4
  shape?:         ParticleShape; // 'dot' | 'streak' | 'ring'. Default: 'dot'
  color?:         string; // Particle color. Falls back to edge color.
  glowColor?:     string; // Glow bloom color. Falls back to particle color.
  glow?:          number; // Glow intensity multiplier 0–2. Default: 1
  trailLength?:   number; // Trail history points (0 = no trail). Default: 28
  glowRadius?:    number; // Glow bloom radius. Default: 6
  phaseOffset?:   number; // Initial phase offset 0–1 for staggered start.
}
```

### Particle Shapes

| `shape` | Description |
|---|---|
| `'dot'` | Filled circle — clean, minimal |
| `'streak'` | Oriented ellipse aligned to tangent — comet-like |
| `'ring'` | Circle outline — ripple effect |

> **Speed units**: `speed` is in **logical pixels per second** (arc-length based). A particle at `speed: 120` on a 400px-long edge completes a loop in ~3.3 seconds. Common values: 60 (slow), 120 (moderate), 180 (fast), 220 (very fast).

---

## `FlowConfig`

Top-level configuration object. All fields are optional. Also exported as `FlowVizConfig` (alias).

```typescript
interface FlowConfig {
  // ── Shorthand API ──────────────────────────────────────────────────────────
  // Flat, top-level knobs that map to nested fields. Per-edge definitions override them.
  particleSize?:    number;     // Default particle radius. Default: 3
  particleSpeed?:   number;     // Default particle speed (px/s). Default: 120
  particleDensity?: number;     // Default particle count per edge. Default: 3
  speedVariance?:   number;     // Default ±speed variance. Default: 0
  trailDecay?:      number;     // Trail fade alpha 0–1. Maps to render.trailFadeAlpha. Default: 0.18
  glowIntensity?:   number;     // Particle glow multiplier 0–2. Default: 1
  edgeWidth?:       number;     // Default edge stroke width. Default: 1.5
  curvature?:       number;     // Default bezier curvature. Default: 0.3
  flowMode?:        FlowMode;   // 'always' | 'hover' | 'manual'. Default: 'always'

  // ── Structured blocks ─────────────────────────────────────────────────────
  layout?:     LayoutConfig;
  animation?:  AnimationConfig;
  background?: BackgroundConfig;
  render?:     RenderConfig;

  // ── Per-type defaults ─────────────────────────────────────────────────────
  defaults?: {
    node?: Partial<NodeDefinition>;
    edge?: Partial<EdgeDefinition>;
  };

  // ── Event callbacks ───────────────────────────────────────────────────────
  onNodeClick?: (node: NodeDefinition, e: MouseEvent) => void;
  onNodeHover?: (node: NodeDefinition | null, e: MouseEvent) => void;
  onEdgeClick?: (edge: EdgeDefinition, e: MouseEvent) => void;
  onEdgeHover?: (edge: EdgeDefinition | null, e: MouseEvent) => void;
}
```

### `LayoutConfig`

```typescript
interface LayoutConfig {
  type?: 'manual' | 'grid' | 'layered' | 'force'; // Default: 'manual'

  grid?: {
    rows?:    number; // Grid rows. Auto-computed from sqrt(n) if omitted.
    cols?:    number; // Grid columns.
    padding?: number; // Margin from canvas edges in px. Default: 80
  };

  layered?: {
    direction?:    'LR' | 'TB'; // Left-to-right or top-to-bottom. Default: 'LR'
    stagePadding?: number; // Padding at canvas edges. Default: 80
    nodePadding?:  number; // Spacing between nodes in same layer. Default: 60
  };

  force?: {
    linkDistance?:   number; // d3 link distance. Default: 120
    strength?:      number; // d3 link strength 0–1. Default: 0.5
    chargeStrength?: number; // d3 many-body strength (negative = repel). Default: -300
    iterations?:    number; // Simulation tick count (synchronous). Default: 300
    d3force?:       any;    // REQUIRED: pass the imported d3-force module
                            // import * as d3 from 'd3-force';
                            // layout: { type: 'force', force: { d3force: d3 } }
  };
}
```

> **Force layout** requires `d3-force` passed explicitly. It is NOT bundled with `@flowviz/core`. Without it, layout falls back to grid automatically.

### `BackgroundConfig`

```typescript
interface BackgroundConfig {
  color?:         string;           // Solid background color. Default: '#000000'
  gradient?:      [string, string]; // Two-stop linear gradient
  gradientAngle?: number;           // Gradient angle in degrees. Default: 135
  showGrid?:      boolean;          // Render grid lines. Default: false
  gridColor?:     string;           // Grid line color. Default: 'rgba(255,255,255,0.04)'
  gridSpacing?:   number;           // Grid cell size in px. Default: 40
  showDots?:      boolean;          // Render dot pattern. Default: false
  dotColor?:      string;           // Dot color. Default: 'rgba(255,255,255,0.05)'
  dotSpacing?:    number;           // Dot grid spacing in px. Default: 30
}
```

### `AnimationConfig`

```typescript
interface AnimationConfig {
  paused?:        boolean; // Start paused. Default: false
  globalSpeed?:   number;  // RAF speed multiplier. 1 = realtime, 2 = 2× fast. Default: 1
  particleCount?: number;  // Override particle count for ALL edges
}
```

### `RenderConfig`

```typescript
interface RenderConfig {
  edgeTubes?:      boolean;       // Subtle glow tube behind each edge. Default: false
  tubeOpacity?:    number;        // Tube opacity 0–1. Default: 0.6
  neonBeams?:      boolean;       // Heavy 6-layer neon beam on every edge. Default: false
  trailFadeAlpha?: number;        // Per-frame alpha of semi-transparent bg fill.
                                  // Lower = longer, more persistent trails.
                                  // Range 0–1. Default: 0.18
  noTrailFade?:    boolean;       // Disable trail-fade (full clear each frame). Default: false
  particleBlend?:  'screen' | 'lighter' | 'source-over'; // Canvas blend mode. Default: 'screen'
                                  // Use 'source-over' for clean dots, 'screen' for additive glow
  particleGlow?:   boolean;       // Radial glow bloom on particle heads. Default: true
  vignette?:       boolean;       // Dark radial vignette at canvas edges. Default: false
}
```

---

## `FlowEngine` API

The headless engine. All public methods:

```typescript
class FlowEngine {
  constructor(options: EngineOptions)

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  start():             void  // Begin RAF animation loop
  stop():              void  // Cancel RAF loop (full stop)
  pause():             void  // Pause ticker (keeps canvas state)
  resume():            void  // Resume from pause
  destroy():           void  // Destroy engine, release all resources

  // ── Graph API ─────────────────────────────────────────────────────────────
  setNodes(defs: NodeDefinition[]):  void  // Full node list replace (reconciles)
  setEdges(defs: EdgeDefinition[]):  void  // Full edge list replace (reconciles)
  addNode(def: NodeDefinition):      void  // Add single node
  removeNode(id: string):           void  // Remove node + connected edges
  addEdge(def: EdgeDefinition):      void  // Add single edge
  removeEdge(id: string):           void  // Remove single edge
  update(data: {                           // Batch update
    nodes?:  NodeDefinition[];
    edges?:  EdgeDefinition[];
    config?: FlowConfig;
  }): void
  setConfig(config: FlowConfig):     void  // Apply config changes at runtime

  // ── Flow Mode ─────────────────────────────────────────────────────────────
  setFlowMode(mode: FlowMode):       void  // 'always' | 'hover' | 'manual'
  trigger(edgeId: string):           void  // Activate edge in manual mode
  untrigger(edgeId: string):         void  // Deactivate edge in manual mode

  // ── Controls ──────────────────────────────────────────────────────────────
  setSpeed(multiplier: number):                    void  // Ticker speed multiplier
  setParticleCount(edgeId: string, count: number): void  // Override per-edge count
  resize(width: number, height: number):           void  // Resize canvas + re-layout

  // ── Events ────────────────────────────────────────────────────────────────
  on(event: EngineEventType, cb: (payload: unknown) => void):  void
  off(event: EngineEventType, cb: (payload: unknown) => void): void

  // ── Accessors ─────────────────────────────────────────────────────────────
  get width():    number
  get height():   number
  get isPaused(): boolean
  get nodes():    Node[]
  get edges():    Edge[]
  getNode(id: string): Node | undefined
  getEdge(id: string): Edge | undefined
}
```

### `EngineOptions`

```typescript
interface EngineOptions {
  canvas:  HTMLCanvasElement;
  nodes?:  NodeDefinition[];
  edges?:  EdgeDefinition[];
  config?: FlowConfig;
  width?:  number; // Default: canvas.clientWidth
  height?: number; // Default: canvas.clientHeight
}
```

### Engine Events

All 11 event types:

```typescript
type EngineEventType =
  // ── Interaction events ────────────────────────────────────────────────────
  | 'node:click'       // Payload: { node: NodeDefinition, event: MouseEvent }
  | 'node:hover'       // Payload: { node: NodeDefinition, event: MouseEvent }
  | 'node:hoverend'    // Payload: { nodeId: string, event: MouseEvent }
  | 'edge:click'       // Payload: { edge: EdgeDefinition, event: MouseEvent }
  | 'edge:hover'       // Payload: { edge: EdgeDefinition, event: MouseEvent }
  | 'edge:hoverend'    // Payload: { edgeId: string, event: MouseEvent }
  // ── Lifecycle events ──────────────────────────────────────────────────────
  | 'engine:start'     // Engine started
  | 'engine:stop'      // Engine stopped
  | 'engine:pause'     // Animation paused
  | 'engine:resume'    // Animation resumed
  | 'graph:update';    // Payload: { type: 'nodes' | 'edges', action?: string, id?: string }
```

```typescript
// Example: listen for node click
engine.on('node:click', (payload) => {
  const { node, event } = payload as { node: NodeDefinition; event: MouseEvent };
  console.log('clicked:', node.id, node.data);
});

// Example: listen for edge hover
engine.on('edge:hover', (payload) => {
  const { edge } = payload as { edge: EdgeDefinition };
  console.log('hovering:', edge.source, '→', edge.target);
});
```

---

## React API — `<FlowViz />`

```tsx
import { FlowViz } from '@flowviz/react';
import type { FlowVizHandle } from '@flowviz/react';

// Props
interface FlowVizProps {
  nodes:      NodeDefinition[];
  edges:      EdgeDefinition[];
  config?:    FlowConfig;       // Full config object
  width?:     number | string;  // Default: '100%'
  height?:    number | string;  // Default: 500
  className?: string;
  style?:     React.CSSProperties;
}

// Imperative handle (via ref)
interface FlowVizHandle {
  pause():                                      void;
  resume():                                     void;
  setSpeed(multiplier: number):                 void;
  setFlowMode(mode: FlowMode):                  void;
  trigger(edgeId: string):                      void;
  setParticleCount(edgeId: string, n: number):  void;
  addNode(node: NodeDefinition):                void;
  removeNode(id: string):                       void;
  addEdge(edge: EdgeDefinition):                void;
  removeEdge(id: string):                       void;
}
```

```tsx
import { useRef } from 'react';
import { FlowViz } from '@flowviz/react';
import type { FlowVizHandle } from '@flowviz/react';

function Demo() {
  const ref = useRef<FlowVizHandle>(null);

  return (
    <>
      <button onClick={() => ref.current?.pause()}>Pause</button>
      <button onClick={() => ref.current?.setSpeed(2)}>2× Speed</button>
      <FlowViz ref={ref} nodes={nodes} edges={edges} config={config} height={600} />
    </>
  );
}
```

### `useFlowEngine` hook (advanced)

For full control over the canvas and engine lifecycle:

```tsx
import { useFlowEngine } from '@flowviz/react';

function Canvas({ nodes, edges, config }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { engineRef, pause, resume, setSpeed } = useFlowEngine({
    canvasRef,
    width:  800,
    height: 500,
    nodes,
    edges,
    config,
  });

  return <canvas ref={canvasRef} />;
}
```

---

## Flow Modes

### `'always'` (default)
All edges animate continuously.

```typescript
engine.setFlowMode('always');
```

### `'hover'`
Only edges connected to the hovered node / hovered edge animate.

```typescript
engine.setFlowMode('hover');
// InteractionSystem handles this automatically via mouse events
```

### `'manual'`
Only explicitly triggered edges animate.

```typescript
engine.setFlowMode('manual');
engine.trigger('edge-id');   // Start animating
engine.untrigger('edge-id'); // Stop animating
```

---

## Event Callbacks

Registered via `config.onNodeClick`, `config.onNodeHover`, etc.:

```typescript
const config: FlowConfig = {
  onNodeClick: (node, e) => {
    console.log('clicked:', node.id, node.data);
  },
  onNodeHover: (node, e) => {
    // node is null when pointer leaves all nodes
    setHovered(node?.id ?? null);
  },
  onEdgeClick: (edge, e) => {
    console.log('edge clicked:', edge.source, '→', edge.target);
  },
  onEdgeHover: (edge, e) => {
    // edge is null when pointer leaves all edges
  },
};
```

Touch is also supported — `touchstart` is forwarded as click.

---

## Custom Particle Shapes

Register custom shape draw functions via `ShapeRegistry`:

```typescript
import { ShapeRegistry } from '@flowviz/core';
import type { ShapeDrawFn } from '@flowviz/core';

// fn(ctx, x, y, size, color, angle, alpha)
const starShape: ShapeDrawFn = (ctx, x, y, size, color) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  // ... draw star path ...
  ctx.fill();
  ctx.restore();
};

ShapeRegistry.register('star', starShape);

// Use in EdgeParticleConfig:
const edge: EdgeDefinition = {
  id: 'e1', source: 'a', target: 'b',
  particles: { shape: 'star', count: 4, speed: 130 },
};
```

---

## Layout Examples

### Layered (LR)

Best for pipeline / data-flow graphs. Nodes grouped by `layer`.

```typescript
config: {
  layout: { type: 'layered', layered: { direction: 'LR', stagePadding: 110, nodePadding: 90 } }
}
// Nodes:
{ id: 'a', layer: 0 },
{ id: 'b', layer: 1 },
{ id: 'c', layer: 2 },
```

### Manual

Specify exact `x`/`y` per node. Best for network topology.

```typescript
config: { layout: { type: 'manual' } }
// Nodes:
{ id: 'core', x: 400, y: 280 },
{ id: 'sw1',  x: 180, y: 140 },
```

### Grid

Nodes auto-placed in a rows × cols grid. Use `gridRow`/`gridCol` to pin positions.

```typescript
config: {
  layout: { type: 'grid', grid: { rows: 3, cols: 5, padding: 80 } }
}
```

### Force-directed

Requires `d3-force` passed explicitly (not bundled):

```typescript
import * as d3 from 'd3-force';

config: {
  layout: {
    type: 'force',
    force: {
      d3force: d3,
      linkDistance: 150,
      chargeStrength: -400,
      iterations: 400,
    }
  }
}
```

---

## Architecture

```
@flowviz/core
├── FlowEngine          Main façade — orchestrates all sub-systems
├── Ticker              RAF loop with deltaTime + speed multiplier
├── Renderer            Pure Canvas2D render pipeline (all drawing)
│   ├── background      Trail-fade fill + grid / dots pattern
│   ├── edge lines      Bezier curves, dashes, optional neon beams / tubes
│   ├── particles       Trail gradient → optional glow bloom → shape core
│   └── nodes           Shape fill + border + glow shadow + icon + label
├── ParticleSystem      Object pool (4096), arc-length movement
├── InteractionSystem   Canvas DOM events + spatial hit testing
├── BezierPath          512-sample arc-length LUT on cubic bezier
├── NodeShapes          Exact boundary math per shape + canvas draw
└── ShapeRegistry       Custom particle shape registration

@flowviz/react
├── <FlowViz />         forwardRef component — ResizeObserver + canvas
└── useFlowEngine       Engine lifecycle hook (create, sync, destroy)
```

### Render Pipeline (per frame)

1. **Background** — trail-fade `fillRect` (or full clear if `noTrailFade`) + grid/dots
2. **Edge lines** — base bezier stroke (+ optional edge tubes / neon beams)
3. **Particles** — per-particle: trail gradient → optional glow bloom → shape core
4. **Nodes** — shape fill + border + glow shadow + icon + label
5. **Vignette** — optional radial gradient at canvas edges

### Arc-Length Parameterization

Bezier's parametric `t` is **not** proportional to arc-length. Tight curves compress `t` space, making a naive `t += speed * dt` particle appear to speed up.

FlowViz precomputes a 512-sample look-up table per edge:

```
arcLen[i] = cumulative arc-length at sample i
```

Movement each frame:

```
p.distance += p.speed * dt                         // constant visual speed
position = bezier.getPointAtLength(p.distance)      // O(log 512) binary search
```

Result: particles move at a visually constant speed regardless of curve shape.

---

## Performance Notes

| Config | Recommendation |
|---|---|
| `render.trailFadeAlpha` | Lower = more persistent trails. 0.12–0.22 is the sweet spot. |
| `render.noTrailFade` | `true` avoids smearing artifacts — best for clean dot aesthetics. |
| `render.particleGlow` | `false` saves ~25% render time (radial gradients are expensive). |
| `render.particleBlend` | `'source-over'` for clean dots; `'screen'` for additive glow on dark bg. |
| `render.neonBeams` | Heavy — only suitable for a handful of showcase edges. |
| `particles.count` | 3–6 per edge for visual density; 1 for high edge-count graphs (200+). |
| Layout | `'manual'`, `'layered'`, `'grid'` are O(n). `'force'` is O(n × iterations), runs once. |
| Pool size | 4096 particles. At 3 per edge: supports ~1365 edges simultaneously. |

---

## Repository Structure

```
flowviz/
├── packages/
│   ├── core/       @flowviz/core — engine, geometry, systems
│   ├── react/      @flowviz/react — React wrapper
│   └── demo/       Next.js 14 interactive demo (5 examples)
├── package.json    Workspace root
└── README.md
```

### Development

```bash
# Install dependencies (workspace)
npm install

# Build core library
cd packages/core && npm run build

# Run demo (dev server)
cd packages/demo && npm run dev

# Build all
npm run build --workspaces
```

---

## License

MIT © mayankrajput
