import type {
  NodeDefinition,
  EdgeDefinition,
  FlowVizConfig,
  ResolvedNode,
  ResolvedEdge,
} from '../types';

const NODE_DEFAULTS: Omit<ResolvedNode, 'id' | 'definition' | 'x' | 'y'> = {
  label: '',
  shape: 'circle',
  size: 44,
  color: '#4f8ef7',
  borderColor: '#7ab3ff',
  borderWidth: 1.5,
  glowColor: '#4f8ef7',
  glowRadius: 12,
  labelColor: '#e8eaf6',
  labelSize: 12,
  opacity: 1,
  layer: 0,
  gridRow: 0,
  gridCol: 0,
  data: {},
};

const EDGE_DEFAULTS = {
  curvature: 0.3,
  color: '#4f8ef7',
  width: 1.5,
  opacity: 0.5,
  dashed: false,
  dashArray: '6 3',
  particles: {
    count: 3,
    speed: 0.18,
    size: 4,
    shape: 'dot' as const,
    color: '',
    trailLength: 28,
    glowRadius: 6,
    glowColor: '',
  },
};

export class GraphModel {
  private _nodes = new Map<string, ResolvedNode>();
  private _edges = new Map<string, ResolvedEdge>();
  private config: FlowVizConfig = {};

  setConfig(config: FlowVizConfig): void {
    this.config = config;
  }

  // ─── Nodes ───────────────────────────────────────────────────────────────

  setNodes(defs: NodeDefinition[]): { added: string[]; removed: string[]; updated: string[] } {
    const incoming = new Set(defs.map(d => d.id));
    const added: string[] = [];
    const removed: string[] = [];
    const updated: string[] = [];

    // Remove stale
    for (const id of this._nodes.keys()) {
      if (!incoming.has(id)) {
        this._nodes.delete(id);
        removed.push(id);
      }
    }

    // Add / update
    for (const def of defs) {
      if (!this._nodes.has(def.id)) {
        this._nodes.set(def.id, this.resolveNode(def));
        added.push(def.id);
      } else {
        this._nodes.set(def.id, this.resolveNode(def, this._nodes.get(def.id)!));
        updated.push(def.id);
      }
    }

    return { added, removed, updated };
  }

  addNode(def: NodeDefinition): void {
    this._nodes.set(def.id, this.resolveNode(def));
  }

  removeNode(id: string): void {
    this._nodes.delete(id);
    // also remove connected edges
    for (const [eid, edge] of this._edges) {
      if (edge.source === id || edge.target === id) {
        this._edges.delete(eid);
      }
    }
  }

  updateNodePosition(id: string, x: number, y: number): void {
    const node = this._nodes.get(id);
    if (node) {
      node.x = x;
      node.y = y;
    }
  }

  // ─── Edges ───────────────────────────────────────────────────────────────

  setEdges(defs: EdgeDefinition[]): { added: string[]; removed: string[]; updated: string[] } {
    const incoming = new Set(defs.map(d => d.id));
    const added: string[] = [];
    const removed: string[] = [];
    const updated: string[] = [];

    for (const id of this._edges.keys()) {
      if (!incoming.has(id)) {
        this._edges.delete(id);
        removed.push(id);
      }
    }

    for (const def of defs) {
      if (!this._edges.has(def.id)) {
        this._edges.set(def.id, this.resolveEdge(def));
        added.push(def.id);
      } else {
        this._edges.set(def.id, this.resolveEdge(def));
        updated.push(def.id);
      }
    }

    return { added, removed, updated };
  }

  addEdge(def: EdgeDefinition): void {
    this._edges.set(def.id, this.resolveEdge(def));
  }

  removeEdge(id: string): void {
    this._edges.delete(id);
  }

  // ─── Accessors ───────────────────────────────────────────────────────────

  getNode(id: string): ResolvedNode | undefined {
    return this._nodes.get(id);
  }

  getEdge(id: string): ResolvedEdge | undefined {
    return this._edges.get(id);
  }

  get nodes(): ResolvedNode[] {
    return Array.from(this._nodes.values());
  }

  get edges(): ResolvedEdge[] {
    return Array.from(this._edges.values());
  }

  // ─── Resolution ──────────────────────────────────────────────────────────

  private resolveNode(def: NodeDefinition, existing?: ResolvedNode): ResolvedNode {
    const configDefaults = this.config.defaults?.node ?? {};
    return {
      ...NODE_DEFAULTS,
      ...configDefaults,
      ...def,
      label: def.label ?? def.id,
      x: existing?.x ?? def.x ?? 0,
      y: existing?.y ?? def.y ?? 0,
      layer: def.layer ?? 0,
      gridRow: def.gridRow ?? 0,
      gridCol: def.gridCol ?? 0,
      data: def.data ?? {},
      definition: def,
    } as ResolvedNode;
  }

  private resolveEdge(def: EdgeDefinition): ResolvedEdge {
    const configDefaults = this.config.defaults?.edge ?? {};
    const baseParticles = { ...EDGE_DEFAULTS.particles };
    return {
      ...EDGE_DEFAULTS,
      ...configDefaults,
      ...def,
      particles: {
        ...baseParticles,
        ...(configDefaults.particles ?? {}),
        ...(def.particles ?? {}),
        color: def.particles?.color ?? def.color ?? EDGE_DEFAULTS.color,
        glowColor: def.particles?.glowColor ?? def.particles?.color ?? def.color ?? EDGE_DEFAULTS.color,
      },
      definition: def,
    } as ResolvedEdge;
  }
}
