import type { NodeDefinition, EdgeDefinition, FlowVizConfig, ResolvedNode } from '../types';
import { GraphModel } from '../graph/GraphModel';
import { PathCache } from '../path/PathCache';
import { ParticleSystem } from '../particles/ParticleSystem';
import { CanvasRenderer } from '../renderer/CanvasRenderer';
import { AnimationLoop } from './AnimationLoop';
import { EventBus } from './EventBus';
import { createLayout } from '../layout/index';
import type { PathData } from '../path/BezierPath';

export interface FlowEngineOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  nodes?: NodeDefinition[];
  edges?: EdgeDefinition[];
  config?: FlowVizConfig;
}

export class FlowEngine {
  readonly graph = new GraphModel();
  readonly events = new EventBus();
  private pathCache = new PathCache();
  private particleSystem = new ParticleSystem();
  private renderer: CanvasRenderer;
  private loop = new AnimationLoop();
  private config: FlowVizConfig = {};
  private _width = 0;
  private _height = 0;
  private _initialized = false;

  constructor(options: FlowEngineOptions) {
    this.renderer = new CanvasRenderer(options.canvas);
    this._width = options.width;
    this._height = options.height;

    this.renderer.resize(options.width, options.height);

    if (options.config) this.setConfig(options.config);
    if (options.nodes) this.setNodes(options.nodes);
    if (options.edges) this.setEdges(options.edges);
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  start(): void {
    if (this._initialized) return;
    this._initialized = true;
    this.loop.add(this.tick);
    this.loop.start();
    this.events.emit('engine:start', null);
  }

  pause(): void {
    this.loop.pause();
    this.events.emit('engine:pause', null);
  }

  resume(): void {
    this.loop.resume();
    this.events.emit('engine:resume', null);
  }

  destroy(): void {
    this.loop.destroy();
    this.particleSystem.clear();
    this.pathCache.clear();
    this.events.clear();
    this._initialized = false;
  }

  // ─── Config ───────────────────────────────────────────────────────────────

  setConfig(config: FlowVizConfig): void {
    this.config = config;
    this.graph.setConfig(config);
    if (config.animation?.paused) this.pause();
    if (config.animation?.globalSpeed !== undefined) {
      this.loop.setSpeed(config.animation.globalSpeed);
    }
    if (config.animation?.particleCount !== undefined) {
      this.particleSystem.setGlobalParticleCount(config.animation.particleCount);
    }
  }

  setSpeed(multiplier: number): void {
    this.loop.setSpeed(multiplier);
  }

  // ─── Graph mutations ──────────────────────────────────────────────────────

  setNodes(defs: NodeDefinition[]): void {
    const diff = this.graph.setNodes(defs);
    this.applyLayout();

    // Rebuild paths for any nodes that changed
    if (diff.updated.length || diff.removed.length) {
      const nodeMap = new Map(this.graph.nodes.map(n => [n.id, n]));
      for (const nodeId of [...diff.updated, ...diff.removed]) {
        this.pathCache.invalidateForNode(nodeId, this.graph.edges);
      }
      this.rebuildPaths();
    }

    this.events.emit('graph:update', { type: 'nodes', diff });
  }

  setEdges(defs: EdgeDefinition[]): void {
    const diff = this.graph.setEdges(defs);
    this.rebuildPaths();
    this.particleSystem.syncEdges(this.graph.edges);
    this.events.emit('graph:update', { type: 'edges', diff });
  }

  addNode(def: NodeDefinition): void {
    this.graph.addNode(def);
    this.applyLayout();
    this.events.emit('graph:update', { type: 'nodes', action: 'add', id: def.id });
  }

  removeNode(id: string): void {
    this.graph.removeNode(id);
    this.pathCache.invalidateForNode(id, this.graph.edges);
    this.particleSystem.syncEdges(this.graph.edges);
    this.events.emit('graph:update', { type: 'nodes', action: 'remove', id });
  }

  addEdge(def: EdgeDefinition): void {
    this.graph.addEdge(def);
    this.rebuildPaths();
    this.particleSystem.addEdge(this.graph.getEdge(def.id)!);
    this.events.emit('graph:update', { type: 'edges', action: 'add', id: def.id });
  }

  removeEdge(id: string): void {
    this.graph.removeEdge(id);
    this.pathCache.invalidate(id);
    this.particleSystem.removeEdge(id);
    this.events.emit('graph:update', { type: 'edges', action: 'remove', id });
  }

  setParticleCount(edgeId: string, count: number): void {
    const edge = this.graph.getEdge(edgeId);
    if (!edge) return;
    edge.particles.count = count;
    this.particleSystem.syncEdges(this.graph.edges);
  }

  resize(width: number, height: number): void {
    this._width = width;
    this._height = height;
    this.renderer.resize(width, height);
    this.applyLayout();
    this.rebuildPaths();
  }

  // ─── Layout & Paths ───────────────────────────────────────────────────────

  private applyLayout(): void {
    const layoutConfig = this.config.layout ?? {};
    const strategy = createLayout(layoutConfig);
    const result = strategy.compute(
      this.graph.nodes.map(n => n.definition),
      this.graph.edges.map(e => e.definition),
      { width: this._width, height: this._height }
    );

    for (const [id, pos] of result.positions) {
      this.graph.updateNodePosition(id, pos.x, pos.y);
    }
  }

  private rebuildPaths(): void {
    const nodeMap = new Map(this.graph.nodes.map(n => [n.id, n]));
    for (const edge of this.graph.edges) {
      this.pathCache.computeForEdge(edge, nodeMap);
    }
  }

  // ─── Tick ─────────────────────────────────────────────────────────────────

  private tick = (dt: number): void => {
    const edges = this.graph.edges;
    const getLUT = (id: string) => this.pathCache.get(id)?.lut;

    this.particleSystem.update(dt, edges, getLUT);

    const pathMap = new Map<string, PathData>();
    for (const edge of edges) {
      const p = this.pathCache.get(edge.id);
      if (p) pathMap.set(edge.id, p);
    }

    this.renderer.drawFrame(
      this._width,
      this._height,
      this.config.background ?? {},
      this.config.render ?? {},
      edges,
      this.particleSystem.allParticles,
      pathMap
    );
  };

  // ─── Accessors ────────────────────────────────────────────────────────────

  get width(): number { return this._width; }
  get height(): number { return this._height; }
  get isPaused(): boolean { return this.loop.paused; }
  get nodes(): ResolvedNode[] { return this.graph.nodes; }

  getPathData(edgeId: string): PathData | undefined {
    return this.pathCache.get(edgeId);
  }
}
