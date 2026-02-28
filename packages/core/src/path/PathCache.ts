import { BezierPath, PathData, Point } from './BezierPath';
import type { ResolvedEdge, ResolvedNode } from '../types';

export class PathCache {
  private cache = new Map<string, PathData>();

  computeForEdge(edge: ResolvedEdge, nodes: Map<string, ResolvedNode>): PathData | null {
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    if (!source || !target) return null;

    const sourcePoint: Point = { x: source.x, y: source.y };
    const targetPoint: Point = { x: target.x, y: target.y };

    const path = BezierPath.compute(
      sourcePoint,
      targetPoint,
      edge.curvature,
      edge.controlPointOffset
    );

    this.cache.set(edge.id, path);
    return path;
  }

  get(edgeId: string): PathData | undefined {
    return this.cache.get(edgeId);
  }

  invalidate(edgeId: string): void {
    this.cache.delete(edgeId);
  }

  invalidateForNode(nodeId: string, edges: ResolvedEdge[]): void {
    for (const edge of edges) {
      if (edge.source === nodeId || edge.target === nodeId) {
        this.cache.delete(edge.id);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  rebuildAll(edges: ResolvedEdge[], nodeMap: Map<string, ResolvedNode>): void {
    this.clear();
    for (const edge of edges) {
      this.computeForEdge(edge, nodeMap);
    }
  }
}
