import type {
  NodeDefinition,
  EdgeDefinition,
  FlowConfig,
  FlowMode,
  EngineOptions,
  EngineEventType,
} from '../types/index';
import { Node } from '../entities/Node';
import { Edge } from '../entities/Edge';
import { ParticleSystem } from '../systems/ParticleSystem';
import { InteractionSystem } from '../systems/InteractionSystem';
import { Ticker } from './Ticker';
import { Renderer } from './Renderer';
import { createLayout } from '../layout/index';

// ─── FlowEngine ───────────────────────────────────────────────────────────────
//
// Headless, framework-agnostic flow visualization engine.
//
// Public API:
//   const engine = new FlowEngine({ canvas, nodes, edges, config })
//   engine.start()
//   engine.stop()
//   engine.update({ nodes?, edges?, config? })
//   engine.setFlowMode('hover')
//   engine.trigger(edgeId)   // manual mode
//   engine.destroy()
//
// Architecture:
//   FlowEngine orchestrates:
//     Ticker       – RAF loop with deltaTime
//     Renderer     – Canvas2D render pipeline
//     ParticleSystem – Object-pooled particle lifecycle
//     InteractionSystem – Canvas event + spatial hit testing
//
// Node/Edge state lives in Map<string, Node/Edge> — direct access, no copies.

type EventCallback = (payload: unknown) => void;

export class FlowEngine {
  // ─── Internal state ────────────────────────────────────────────────────────

  private nodeMap  = new Map<string, Node>();
  private edgeMap  = new Map<string, Edge>();
  private config: FlowConfig = {};

  private _width  = 0;
  private _height = 0;

  private ticker:       Ticker;
  private renderer:     Renderer;
  private particles:    ParticleSystem;
  private interaction:  InteractionSystem;

  private flowMode:   FlowMode   = 'always';
  private activeEdges = new Set<string>(); // manual mode triggers
  private hoverEdges  = new Set<string>(); // hover mode active set

  private listeners = new Map<EngineEventType, Set<EventCallback>>();

  // ─── Constructor ──────────────────────────────────────────────────────────

  constructor(options: EngineOptions) {
    const { canvas, width, height, config, nodes, edges } = options;

    this._width  = width  ?? canvas.clientWidth  ?? 800;
    this._height = height ?? canvas.clientHeight ?? 600;

    this.renderer    = new Renderer(canvas);
    this.renderer.resize(this._width, this._height);

    this.ticker      = new Ticker();
    this.particles   = new ParticleSystem();
    this.interaction = new InteractionSystem(canvas);

    // Hook hover mode into interaction system
    this.interaction.onHoverActiveEdges = (edgeIds) => {
      this.hoverEdges = edgeIds;
    };

    if (config)  this.applyConfig(config);
    if (nodes)   this.setNodes(nodes);
    if (edges)   this.setEdges(edges);

    this.ticker.add(this.tick);
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  start(): void {
    this.ticker.start();
    this.emit('engine:start', null);
  }

  /**
   * Stop the animation loop entirely (cancels RAF).
   * Call start() to restart. For temporary suspension, prefer pause()/resume().
   */
  stop(): void {
    this.ticker.stop();
    this.emit('engine:stop', null);
  }

  pause(): void {
    this.ticker.pause();
    this.emit('engine:pause', null);
  }

  resume(): void {
    this.ticker.resume();
    this.emit('engine:resume', null);
  }

  destroy(): void {
    this.ticker.destroy();
    this.particles.clear();
    this.interaction.destroy();
    this.listeners.clear();
  }

  // ─── Configuration ────────────────────────────────────────────────────────

  setConfig(config: FlowConfig): void {
    this.applyConfig(config);
  }

  private applyConfig(config: FlowConfig): void {
    // ── Normalize top-level shorthands into the defaults tree ────────────────
    // This lets `particleSize: 3, particleSpeed: 100` work alongside the full
    // `defaults.edge.particles` path — both are equivalent in effect.
    const normalized: FlowConfig = { ...config };
    const edgeDefaults  = { ...(config.defaults?.edge  ?? {}) };
    const partDefaults  = { ...(edgeDefaults.particles ?? {}) };

    if (config.particleSize  != null) partDefaults.size  ??= config.particleSize;
    if (config.particleSpeed != null) partDefaults.speed ??= config.particleSpeed;
    if (config.glowIntensity != null) partDefaults.glow  ??= config.glowIntensity;
    if (config.particleDensity != null) partDefaults.count ??= config.particleDensity;
    if (config.edgeWidth  != null) edgeDefaults.width     ??= config.edgeWidth;
    if (config.curvature  != null) edgeDefaults.curvature ??= config.curvature;

    edgeDefaults.particles = partDefaults;
    normalized.defaults = {
      node: config.defaults?.node,
      edge: edgeDefaults,
    };

    // ── trailDecay → render.trailFadeAlpha ───────────────────────────────────
    if (config.trailDecay != null) {
      normalized.render = { ...(config.render ?? {}), trailFadeAlpha: config.trailDecay };
    }

    this.config = normalized;
    this.interaction.setConfig(normalized);

    if (normalized.animation?.paused) this.ticker.pause();
    if (normalized.animation?.globalSpeed != null) {
      this.ticker.setSpeed(normalized.animation.globalSpeed);
    }

    // ── Particle density: animation.particleCount overrides particleDensity ──
    const globalCount = normalized.animation?.particleCount ?? config.particleDensity;
    this.particles.setGlobalParticleCount(globalCount);

    if (normalized.flowMode) {
      this.flowMode = normalized.flowMode;
    }
  }

  // ─── Graph API ────────────────────────────────────────────────────────────

  /**
   * Set the full node list. Reconciles additions, removals, and updates.
   */
  setNodes(defs: NodeDefinition[]): void {
    const incoming = new Set(defs.map(d => d.id));
    const nodeDefaults = this.config.defaults?.node ?? {};

    // Remove stale
    for (const [id] of this.nodeMap) {
      if (!incoming.has(id)) this.nodeMap.delete(id);
    }

    // Add / update
    for (const def of defs) {
      if (this.nodeMap.has(def.id)) {
        this.nodeMap.get(def.id)!.update(def, nodeDefaults as never);
      } else {
        this.nodeMap.set(def.id, new Node(def, nodeDefaults as never));
      }
    }

    this.interaction.setNodes(this.nodeMap);
    this.applyLayout();
    this.rebuildEdgePaths();
    this.particles.syncEdges(Array.from(this.edgeMap.values()));
    this.emit('graph:update', { type: 'nodes' });
  }

  /**
   * Set the full edge list. Reconciles additions, removals, and updates.
   */
  setEdges(defs: EdgeDefinition[]): void {
    const incoming = new Set(defs.map(d => d.id));
    const edgeDefaults = this.config.defaults?.edge ?? {};

    // Remove stale
    for (const [id] of this.edgeMap) {
      if (!incoming.has(id)) {
        this.edgeMap.delete(id);
        this.particles.removeEdge(id);
      }
    }

    // Add / update
    for (const def of defs) {
      if (this.edgeMap.has(def.id)) {
        this.edgeMap.get(def.id)!.update(def, edgeDefaults as never);
      } else {
        this.edgeMap.set(def.id, new Edge(def, edgeDefaults as never));
      }
    }

    this.interaction.setEdges(this.edgeMap);
    this.rebuildEdgePaths();
    this.particles.syncEdges(Array.from(this.edgeMap.values()));
    this.emit('graph:update', { type: 'edges' });
  }

  /**
   * Batch update — pass any combination of nodes, edges, config.
   */
  update(data: { nodes?: NodeDefinition[]; edges?: EdgeDefinition[]; config?: FlowConfig }): void {
    if (data.config) this.applyConfig(data.config);
    if (data.nodes)  this.setNodes(data.nodes);
    if (data.edges)  this.setEdges(data.edges);
  }

  addNode(def: NodeDefinition): void {
    const nodeDefaults = this.config.defaults?.node ?? {};
    const node = new Node(def, nodeDefaults as never);
    this.nodeMap.set(def.id, node);
    this.interaction.setNodes(this.nodeMap);
    this.applyLayout();
    this.rebuildEdgePaths();
    this.emit('graph:update', { type: 'nodes', action: 'add', id: def.id });
  }

  removeNode(id: string): void {
    this.nodeMap.delete(id);
    // Remove connected edges
    for (const [eid, edge] of this.edgeMap) {
      if (edge.sourceId === id || edge.targetId === id) {
        this.edgeMap.delete(eid);
        this.particles.removeEdge(eid);
      }
    }
    this.interaction.setNodes(this.nodeMap);
    this.interaction.setEdges(this.edgeMap);
    this.emit('graph:update', { type: 'nodes', action: 'remove', id });
  }

  addEdge(def: EdgeDefinition): void {
    const edgeDefaults = this.config.defaults?.edge ?? {};
    const edge = new Edge(def, edgeDefaults as never);
    this.edgeMap.set(def.id, edge);
    this.buildEdgePath(edge);
    this.particles.addEdge(edge);
    this.interaction.setEdges(this.edgeMap);
    this.emit('graph:update', { type: 'edges', action: 'add', id: def.id });
  }

  removeEdge(id: string): void {
    this.edgeMap.delete(id);
    this.particles.removeEdge(id);
    this.interaction.setEdges(this.edgeMap);
    this.emit('graph:update', { type: 'edges', action: 'remove', id });
  }

  // ─── Flow Mode ────────────────────────────────────────────────────────────

  /**
   * Switch animation mode.
   * Does NOT recreate particles — they retain their positions.
   */
  setFlowMode(mode: FlowMode): void {
    this.flowMode   = mode;
    this.activeEdges.clear();
    this.hoverEdges = new Set();
  }

  /**
   * Activate an edge in manual flow mode.
   * Call again with the same edgeId to keep it active.
   */
  trigger(edgeId: string): void {
    if (this.flowMode === 'manual') {
      this.activeEdges.add(edgeId);
    }
  }

  /** Deactivate an edge in manual mode */
  untrigger(edgeId: string): void {
    this.activeEdges.delete(edgeId);
  }

  // ─── Speed / Particle Controls ────────────────────────────────────────────

  setSpeed(multiplier: number): void {
    this.ticker.setSpeed(multiplier);
  }

  setParticleCount(edgeId: string, count: number): void {
    const edge = this.edgeMap.get(edgeId);
    if (!edge) return;
    edge.particles.count = count;
    this.particles.syncEdges(Array.from(this.edgeMap.values()));
  }

  // ─── Resize ───────────────────────────────────────────────────────────────

  resize(width: number, height: number): void {
    this._width  = width;
    this._height = height;
    this.renderer.resize(width, height);
    this.applyLayout();
    this.rebuildEdgePaths();
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  on(event: EngineEventType, cb: EventCallback): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
  }

  off(event: EngineEventType, cb: EventCallback): void {
    this.listeners.get(event)?.delete(cb);
  }

  private emit(event: EngineEventType, payload: unknown): void {
    this.listeners.get(event)?.forEach(cb => cb(payload));
  }

  // ─── Layout ───────────────────────────────────────────────────────────────

  private applyLayout(): void {
    const layoutConfig = this.config.layout ?? {};
    const strategy = createLayout(layoutConfig);
    const nodeDefs  = Array.from(this.nodeMap.values()).map(n => n.definition);
    const edgeDefs  = Array.from(this.edgeMap.values()).map(e => e.definition);
    const result    = strategy.compute(nodeDefs, edgeDefs, { width: this._width, height: this._height });

    for (const [id, pos] of result.positions) {
      const node = this.nodeMap.get(id);
      if (node) node.setPosition(pos.x, pos.y);
    }
  }

  private rebuildEdgePaths(): void {
    for (const edge of this.edgeMap.values()) {
      this.buildEdgePath(edge);
    }
  }

  private buildEdgePath(edge: Edge): void {
    const src = this.nodeMap.get(edge.sourceId);
    const tgt = this.nodeMap.get(edge.targetId);
    if (src && tgt) {
      edge.buildPath(src, tgt);
    }
  }

  // ─── Tick ─────────────────────────────────────────────────────────────────

  private tick = (dt: number): void => {
    const edges = Array.from(this.edgeMap.values());

    // Determine active edges based on flow mode
    let activeSet: Set<string> | null;
    switch (this.flowMode) {
      case 'always': activeSet = null; break;          // null = all edges active
      case 'hover':  activeSet = this.hoverEdges; break;
      case 'manual': activeSet = this.activeEdges; break;
      default:       activeSet = null;
    }

    // Update particles
    this.particles.update(dt, edges, activeSet);

    // Build per-edge particle map for renderer
    const particleMap = new Map<string, import('../entities/Particle').Particle[]>();
    this.particles.forEach((pts, edgeId) => {
      particleMap.set(edgeId, pts);
    });

    // Render frame
    this.renderer.renderFrame({
      width:         this._width,
      height:        this._height,
      background:    this.config.background ?? {},
      render:        this.config.render     ?? {},
      nodes:         Array.from(this.nodeMap.values()),
      edges,
      particles:     particleMap,
      hoveredNodeId: this.interaction.hoveredNode,
      hoveredEdgeId: this.interaction.hoveredEdge,
    });
  };

  // ─── Accessors ────────────────────────────────────────────────────────────

  get width():    number  { return this._width;          }
  get height():   number  { return this._height;         }
  get isPaused(): boolean { return this.ticker.paused;   }
  get nodes():    Node[]  { return Array.from(this.nodeMap.values()); }
  get edges():    Edge[]  { return Array.from(this.edgeMap.values()); }

  getNode(id: string): Node | undefined { return this.nodeMap.get(id); }
  getEdge(id: string): Edge | undefined { return this.edgeMap.get(id); }
}
