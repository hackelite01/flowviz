import type { NodeDefinition, EdgeDefinition, LayoutStrategy, LayoutResult, LayoutConfig } from '../types/index';

type GridLayoutConfig    = NonNullable<LayoutConfig['grid']>;
type LayeredLayoutConfig = NonNullable<LayoutConfig['layered']>;
type ForceLayoutConfig   = NonNullable<LayoutConfig['force']>;

// ─── d3-force optional type shim ─────────────────────────────────────────────
// We do not import d3-force directly — it is optional.
// Consumers who want ForceLayout must pass the d3force module:
//   import * as d3 from 'd3-force';
//   const engine = new FlowEngine({ config: { layout: { type: 'force', d3force: d3 } } })
/* eslint-disable @typescript-eslint/no-explicit-any */
type D3Force = any;

// ─── Manual Layout ────────────────────────────────────────────────────────────
// Reads x/y directly from node definitions. Falls back to center if missing.

export class ManualLayout implements LayoutStrategy {
  compute(
    nodes: NodeDefinition[],
    _edges: EdgeDefinition[],
    bounds: { width: number; height: number }
  ): LayoutResult {
    const positions = new Map<string, { x: number; y: number }>();
    for (const node of nodes) {
      positions.set(node.id, {
        x: node.x ?? bounds.width / 2,
        y: node.y ?? bounds.height / 2,
      });
    }
    return { positions };
  }
}

// ─── Grid Layout ─────────────────────────────────────────────────────────────
// Distributes nodes into a grid. Uses gridRow/gridCol if provided, else auto-assigns.

export class GridLayout implements LayoutStrategy {
  constructor(private config: GridLayoutConfig = {}) {}

  compute(
    nodes: NodeDefinition[],
    _edges: EdgeDefinition[],
    bounds: { width: number; height: number }
  ): LayoutResult {
    const { padding = 80 } = this.config;
    const count = nodes.length;
    const cols = this.config.cols ?? Math.ceil(Math.sqrt(count));
    const rows = this.config.rows ?? Math.ceil(count / cols);

    const cellW = (bounds.width - padding * 2) / cols;
    const cellH = (bounds.height - padding * 2) / rows;

    const positions = new Map<string, { x: number; y: number }>();

    nodes.forEach((node, i) => {
      const col = node.gridCol ?? (i % cols);
      const row = node.gridRow ?? Math.floor(i / cols);
      positions.set(node.id, {
        x: padding + col * cellW + cellW / 2,
        y: padding + row * cellH + cellH / 2,
      });
    });

    return { positions };
  }
}

// ─── Layered Layout ───────────────────────────────────────────────────────────
// Groups nodes by layer property. Stages distributed L→R or T→B.

export class LayeredLayout implements LayoutStrategy {
  constructor(private config: LayeredLayoutConfig = {}) {}

  compute(
    nodes: NodeDefinition[],
    _edges: EdgeDefinition[],
    bounds: { width: number; height: number }
  ): LayoutResult {
    const { direction = 'LR', stagePadding = 80, nodePadding = 60 } = this.config;

    // Group by layer
    const layerMap = new Map<number, NodeDefinition[]>();
    for (const node of nodes) {
      const layer = node.layer ?? 0;
      if (!layerMap.has(layer)) layerMap.set(layer, []);
      layerMap.get(layer)!.push(node);
    }

    const layers = Array.from(layerMap.keys()).sort((a, b) => a - b);
    const numLayers = layers.length;

    const positions = new Map<string, { x: number; y: number }>();

    layers.forEach((layerIdx, stageNum) => {
      const nodesInLayer = layerMap.get(layerIdx)!;
      const numNodes = nodesInLayer.length;

      if (direction === 'LR') {
        const stageX = stagePadding + stageNum * ((bounds.width - stagePadding * 2) / Math.max(numLayers - 1, 1));
        const totalHeight = (numNodes - 1) * nodePadding;
        const startY = bounds.height / 2 - totalHeight / 2;

        nodesInLayer.forEach((node, i) => {
          positions.set(node.id, {
            x: stageX,
            y: startY + i * nodePadding,
          });
        });
      } else {
        // TB
        const stageY = stagePadding + stageNum * ((bounds.height - stagePadding * 2) / Math.max(numLayers - 1, 1));
        const totalWidth = (numNodes - 1) * nodePadding;
        const startX = bounds.width / 2 - totalWidth / 2;

        nodesInLayer.forEach((node, i) => {
          positions.set(node.id, {
            x: startX + i * nodePadding,
            y: stageY,
          });
        });
      }
    });

    return { positions };
  }
}

// ─── Force Layout ─────────────────────────────────────────────────────────────
// Physics-based layout using d3-force (optional dependency).
//
// d3-force is NOT bundled in the library. To use ForceLayout, you must pass
// the d3force module explicitly via the `d3force` constructor option:
//
//   import * as d3 from 'd3-force';
//   createLayout({ type: 'force', force: { d3force: d3, linkDistance: 120 } });
//
// Without d3force, falls back to GridLayout silently.

export class ForceLayout implements LayoutStrategy {
  constructor(private config: ForceLayoutConfig & { d3force?: D3Force } = {}) {}

  compute(
    nodes: NodeDefinition[],
    edges: EdgeDefinition[],
    bounds: { width: number; height: number }
  ): LayoutResult {
    const d3f: D3Force = this.config.d3force;

    if (!d3f) {
      // No d3-force provided — fallback to grid
      return new GridLayout().compute(nodes, edges, bounds);
    }

    const {
      strength      = 0.5,
      linkDistance  = 120,
      iterations    = 300,
      chargeStrength = -300,
    } = this.config;

    const positions = new Map<string, { x: number; y: number }>();

    const simNodes = nodes.map(n => ({
      id: n.id,
      x:  Math.random() * bounds.width,
      y:  Math.random() * bounds.height,
    }));
    const idxMap = new Map(simNodes.map((n, i) => [n.id, i]));

    const simLinks = edges
      .filter(e => idxMap.has(e.source) && idxMap.has(e.target))
      .map(e => ({ source: idxMap.get(e.source)!, target: idxMap.get(e.target)! }));

    const sim = d3f.forceSimulation(simNodes)
      .force('link',      d3f.forceLink(simLinks).distance(linkDistance).strength(strength))
      .force('charge',    d3f.forceManyBody().strength(chargeStrength))
      .force('center',    d3f.forceCenter(bounds.width / 2, bounds.height / 2))
      .force('collision', d3f.forceCollide(50))
      .stop();

    sim.tick(iterations);

    for (const node of simNodes) {
      positions.set(node.id, {
        x: Math.max(60, Math.min(bounds.width  - 60, node.x)),
        y: Math.max(60, Math.min(bounds.height - 60, node.y)),
      });
    }

    return { positions };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createLayout(config: LayoutConfig): LayoutStrategy {
  switch (config.type) {
    case 'grid':    return new GridLayout(config.grid);
    case 'layered': return new LayeredLayout(config.layered);
    case 'force':   return new ForceLayout(config.force as ForceLayoutConfig & { d3force?: D3Force });
    case 'manual':
    default:
      return new ManualLayout();
  }
}