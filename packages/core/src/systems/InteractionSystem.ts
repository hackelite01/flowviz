import type { Node } from '../entities/Node';
import type { Edge } from '../entities/Edge';
import type { FlowConfig, NodeDefinition, EdgeDefinition } from '../types/index';

// ─── Interaction System ───────────────────────────────────────────────────────
//
// Centralized spatial hit testing for canvas events.
// All DOM listeners are here — nothing in Node or Edge classes.
//
// Hit test order per mouse event:
//   1. Nodes (shape-accurate boundary test — O(n))
//   2. Edges (distance-to-bezier via LUT scan — O(n × LUT_SIZE))
//
// DPR handling:
//   Canvas is styled at logicalW × logicalH CSS pixels.
//   getBoundingClientRect() returns CSS pixel coords.
//   All internal geometry is in logical pixels.
//   So: logicalX = (e.clientX - rect.left) * (rect.width / clientWidth)
//   which simplifies to just (e.clientX - rect.left) since CSS size = logical size.

const EDGE_HIT_RADIUS = 12; // logical pixels — distance threshold for edge click/hover

export class InteractionSystem {
  private canvas: HTMLCanvasElement;
  private nodes: Map<string, Node> = new Map();
  private edges: Map<string, Edge> = new Map();
  private config: FlowConfig = {};

  private hoveredNodeId: string | null = null;
  private hoveredEdgeId: string | null = null;

  /** Called by FlowEngine when flow mode is 'hover' to report active edge set */
  onHoverActiveEdges?: (edgeIds: Set<string>) => void;

  private boundMouseMove  = this.handleMouseMove.bind(this);
  private boundClick      = this.handleClick.bind(this);
  private boundMouseLeave = this.handleMouseLeave.bind(this);
  private boundTouchStart = this.handleTouchStart.bind(this);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.attachListeners();
  }

  // ─── State sync ─────────────────────────────────────────────────────────────

  setNodes(nodes: Map<string, Node>): void { this.nodes = nodes; }
  setEdges(edges: Map<string, Edge>): void { this.edges = edges; }
  setConfig(config: FlowConfig): void { this.config = config; }

  get hoveredNode(): string | null { return this.hoveredNodeId; }
  get hoveredEdge(): string | null { return this.hoveredEdgeId; }

  // ─── Event Listeners ────────────────────────────────────────────────────────

  private attachListeners(): void {
    this.canvas.addEventListener('mousemove',  this.boundMouseMove,  { passive: true });
    this.canvas.addEventListener('click',      this.boundClick);
    this.canvas.addEventListener('mouseleave', this.boundMouseLeave, { passive: true });
    this.canvas.addEventListener('touchstart', this.boundTouchStart, { passive: true });
  }

  destroy(): void {
    this.canvas.removeEventListener('mousemove',  this.boundMouseMove);
    this.canvas.removeEventListener('click',      this.boundClick);
    this.canvas.removeEventListener('mouseleave', this.boundMouseLeave);
    this.canvas.removeEventListener('touchstart', this.boundTouchStart);
  }

  private getLogicalPoint(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.canvas.width / (rect.width  * (window.devicePixelRatio || 1))),
      y: (e.clientY - rect.top)  * (this.canvas.height / (rect.height * (window.devicePixelRatio || 1))),
    };
  }

  private handleMouseMove(e: MouseEvent): void {
    const pt = this.getLogicalPoint(e);

    // 1. Test nodes first (higher priority)
    const node = this.hitTestNodes(pt.x, pt.y);

    if (node) {
      // Hovered a node
      if (this.hoveredNodeId !== node.id) {
        // Left previous node
        if (this.hoveredNodeId) {
          const prev = this.nodes.get(this.hoveredNodeId);
          if (prev) { prev.hovered = false; }
          this.config.onNodeHover?.(null, e);
        }
        // Enter new node
        this.hoveredNodeId = node.id;
        node.hovered = true;
        this.config.onNodeHover?.(node.definition, e);
      }

      // Clear edge hover
      if (this.hoveredEdgeId) {
        const prev = this.edges.get(this.hoveredEdgeId);
        if (prev) { prev.hovered = false; }
        this.config.onEdgeHover?.(null, e);
        this.hoveredEdgeId = null;
      }

      // Notify flow mode: activate connected edges
      this.emitHoverEdges(node.id);
      return;
    }

    // 2. Clear node hover
    if (this.hoveredNodeId) {
      const prev = this.nodes.get(this.hoveredNodeId);
      if (prev) { prev.hovered = false; }
      this.config.onNodeHover?.(null, e);
      this.hoveredNodeId = null;
    }

    // 3. Test edges
    const edge = this.hitTestEdges(pt.x, pt.y);

    if (edge) {
      if (this.hoveredEdgeId !== edge.id) {
        if (this.hoveredEdgeId) {
          const prev = this.edges.get(this.hoveredEdgeId);
          if (prev) { prev.hovered = false; }
          this.config.onEdgeHover?.(null, e);
        }
        this.hoveredEdgeId = edge.id;
        edge.hovered = true;
        this.config.onEdgeHover?.(edge.definition, e);
      }
      // Hover mode: activate this edge
      this.onHoverActiveEdges?.(new Set([edge.id]));
    } else {
      if (this.hoveredEdgeId) {
        const prev = this.edges.get(this.hoveredEdgeId);
        if (prev) { prev.hovered = false; }
        this.config.onEdgeHover?.(null, e);
        this.hoveredEdgeId = null;
      }
      // Nothing hovered
      this.onHoverActiveEdges?.(new Set());
    }
  }

  private handleClick(e: MouseEvent): void {
    const pt = this.getLogicalPoint(e);
    const node = this.hitTestNodes(pt.x, pt.y);
    if (node) {
      this.config.onNodeClick?.(node.definition, e);
      return;
    }
    const edge = this.hitTestEdges(pt.x, pt.y);
    if (edge) {
      this.config.onEdgeClick?.(edge.definition, e);
    }
  }

  private handleMouseLeave(e: MouseEvent): void {
    if (this.hoveredNodeId) {
      const n = this.nodes.get(this.hoveredNodeId);
      if (n) n.hovered = false;
      this.config.onNodeHover?.(null, e);
      this.hoveredNodeId = null;
    }
    if (this.hoveredEdgeId) {
      const ed = this.edges.get(this.hoveredEdgeId);
      if (ed) ed.hovered = false;
      this.config.onEdgeHover?.(null, e);
      this.hoveredEdgeId = null;
    }
    this.onHoverActiveEdges?.(new Set());
  }

  private handleTouchStart(e: TouchEvent): void {
    if (e.touches.length === 0) return;
    const t = e.touches[0];
    const fakeEvent = { clientX: t.clientX, clientY: t.clientY } as MouseEvent;
    const pt = this.getLogicalPoint(fakeEvent);
    const node = this.hitTestNodes(pt.x, pt.y);
    if (node) {
      this.config.onNodeClick?.(node.definition, e as unknown as MouseEvent);
      return;
    }
    const edge = this.hitTestEdges(pt.x, pt.y);
    if (edge) {
      this.config.onEdgeClick?.(edge.definition, e as unknown as MouseEvent);
    }
  }

  // ─── Spatial Hit Tests ───────────────────────────────────────────────────────

  private hitTestNodes(x: number, y: number): Node | null {
    let closest: Node | null = null;
    let closestDsq = Infinity;
    for (const node of this.nodes.values()) {
      if (node.hitTest({ x, y })) {
        const dx = x - node.x, dy = y - node.y;
        const dsq = dx * dx + dy * dy;
        if (dsq < closestDsq) { closestDsq = dsq; closest = node; }
      }
    }
    return closest;
  }

  private hitTestEdges(x: number, y: number): Edge | null {
    let closest: Edge | null = null;
    let closestDsq = Infinity;
    const threshold = EDGE_HIT_RADIUS * EDGE_HIT_RADIUS;

    for (const edge of this.edges.values()) {
      const result = edge.path.closestPoint(x, y);
      if (result.distSq < threshold && result.distSq < closestDsq) {
        closestDsq = result.distSq;
        closest    = edge;
      }
    }
    return closest;
  }

  // ─── Flow Mode Helpers ───────────────────────────────────────────────────────

  private emitHoverEdges(nodeId: string): void {
    if (!this.onHoverActiveEdges) return;
    const active = new Set<string>();
    for (const edge of this.edges.values()) {
      if (edge.sourceId === nodeId || edge.targetId === nodeId) {
        active.add(edge.id);
      }
    }
    this.onHoverActiveEdges(active);
  }
}
