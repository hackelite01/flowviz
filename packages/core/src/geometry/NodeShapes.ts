import type { NodeShape } from '../types/index';
import type { Vec2 } from './Vec2';

// ─── Node Geometry: Boundary Intersection + Rendering ────────────────────────
//
// Each node shape needs two operations:
// 1. getBoundaryPoint(center, shape, size, direction): Vec2
//    → Returns the boundary point of the shape facing `direction`.
//    → Used to compute edge start/end points so edges attach to the shape surface.
//
// 2. hitTest(center, shape, size, point): boolean
//    → Returns true if `point` is inside the shape (with optional padding).
//    → Used by InteractionSystem for hover/click detection.

interface NodeGeom {
  x: number;
  y: number;
  shape: NodeShape;
  radius: number;
  width: number;
  height: number;
}

/**
 * Returns the point on the node shape boundary along the direction from
 * the node center toward `target`.
 * Edges use this so they visually terminate at the shape surface, not the center.
 */
export function getBoundaryPoint(node: NodeGeom, target: Vec2): Vec2 {
  const dx = target.x - node.x;
  const dy = target.y - node.y;
  const d  = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-6) return { x: node.x, y: node.y };

  const ux = dx / d; // unit vector toward target
  const uy = dy / d;

  const shape = normalizeShape(node.shape);

  switch (shape) {
    case 'circle':
      return { x: node.x + ux * node.radius, y: node.y + uy * node.radius };

    case 'ring':
      return { x: node.x + ux * node.radius, y: node.y + uy * node.radius };

    case 'square':
    case 'roundedRect': {
      const hw = node.width / 2;
      const hh = node.height / 2;
      return rectBoundary(node.x, node.y, hw, hh, ux, uy);
    }

    case 'hexagon':
      return polygonBoundary(node.x, node.y, node.radius, 6, Math.PI / 6, ux, uy);

    case 'triangle':
      return polygonBoundary(node.x, node.y, node.radius, 3, -Math.PI / 2, ux, uy);

    case 'diamond': {
      // Diamond = square rotated 45°; half-diagonals are node.radius
      const hw = node.radius;
      const hh = node.radius;
      // Ray-diamond intersection: diamond has vertices at ±hw on x and ±hh on y
      if (Math.abs(ux) < 1e-9) return { x: node.x, y: node.y + Math.sign(uy) * hh };
      if (Math.abs(uy) < 1e-9) return { x: node.x + Math.sign(ux) * hw, y: node.y };
      // Parametric: intersect ray with side of diamond
      // Diamond sides: |x/hw| + |y/hh| = 1
      const t = 1 / (Math.abs(ux) / hw + Math.abs(uy) / hh);
      return { x: node.x + ux * t, y: node.y + uy * t };
    }

    default:
      return { x: node.x + ux * node.radius, y: node.y + uy * node.radius };
  }
}

/**
 * Returns true if `point` lies within the node shape (+ optional hit padding).
 */
export function hitTestNode(node: NodeGeom, point: Vec2, padding = 8): boolean {
  const dx = point.x - node.x;
  const dy = point.y - node.y;
  const shape = normalizeShape(node.shape);

  switch (shape) {
    case 'circle':
    case 'ring': {
      const r = node.radius + padding;
      return dx * dx + dy * dy <= r * r;
    }

    case 'square':
    case 'roundedRect': {
      const hw = node.width / 2 + padding;
      const hh = node.height / 2 + padding;
      return Math.abs(dx) <= hw && Math.abs(dy) <= hh;
    }

    case 'hexagon':
    case 'triangle':
    case 'diamond': {
      const r = node.radius + padding;
      return dx * dx + dy * dy <= r * r; // fast circular approximation
    }

    default: {
      const r = node.radius + padding;
      return dx * dx + dy * dy <= r * r;
    }
  }
}

/**
 * Draw a node shape using canvas 2D context.
 * Caller is responsible for saving/restoring ctx state if needed.
 */
export function drawNodeShape(
  ctx: CanvasRenderingContext2D,
  node: NodeGeom,
  fillColor: string,
  strokeColor: string,
  strokeWidth: number,
  opacity: number,
  glowColor: string,
  glowRadius: number
): void {
  const shape = normalizeShape(node.shape);

  ctx.save();
  ctx.globalAlpha = opacity;

  if (glowRadius > 0) {
    ctx.shadowBlur  = glowRadius;
    ctx.shadowColor = glowColor;
  }

  ctx.fillStyle   = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth   = strokeWidth;
  ctx.beginPath();
  buildShapePath(ctx, node, shape);
  ctx.fill();
  if (strokeWidth > 0) ctx.stroke();

  ctx.restore();

  // Ring: draw as hollow circle with thicker stroke (no fill)
  if (shape === 'ring') {
    ctx.save();
    ctx.globalAlpha = opacity;
    if (glowRadius > 0) {
      ctx.shadowBlur  = glowRadius;
      ctx.shadowColor = glowColor;
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth   = Math.max(strokeWidth, node.radius * 0.28);
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    // Dashed inner ring accent
    ctx.setLineDash([node.radius * 0.5, node.radius * 0.4]);
    ctx.globalAlpha = opacity * 0.5;
    ctx.lineWidth   = 1;
    ctx.strokeStyle = glowColor;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalize backward-compat shape aliases */
function normalizeShape(shape: NodeShape): string {
  if (shape === 'rect') return 'square';
  return shape;
}

function buildShapePath(
  ctx: CanvasRenderingContext2D,
  node: NodeGeom,
  normalizedShape: string
): void {
  const { x, y, radius, width, height } = node;

  switch (normalizedShape) {
    case 'circle':
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      break;

    case 'ring':
      // Fill: small center dot
      ctx.arc(x, y, radius * 0.38, 0, Math.PI * 2);
      break;

    case 'square': {
      const hw = width / 2, hh = height / 2;
      ctx.rect(x - hw, y - hh, width, height);
      break;
    }

    case 'roundedRect': {
      const hw = width / 2, hh = height / 2;
      const r  = Math.min(width, height) * 0.15;
      ctx.moveTo(x - hw + r, y - hh);
      ctx.lineTo(x + hw - r, y - hh);
      ctx.arcTo(x + hw, y - hh, x + hw, y - hh + r, r);
      ctx.lineTo(x + hw, y + hh - r);
      ctx.arcTo(x + hw, y + hh, x + hw - r, y + hh, r);
      ctx.lineTo(x - hw + r, y + hh);
      ctx.arcTo(x - hw, y + hh, x - hw, y + hh - r, r);
      ctx.lineTo(x - hw, y - hh + r);
      ctx.arcTo(x - hw, y - hh, x - hw + r, y - hh, r);
      ctx.closePath();
      break;
    }

    case 'hexagon':
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = x + radius * Math.cos(a), py = y + radius * Math.sin(a);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;

    case 'diamond': {
      ctx.moveTo(x, y - radius);
      ctx.lineTo(x + radius, y);
      ctx.lineTo(x, y + radius);
      ctx.lineTo(x - radius, y);
      ctx.closePath();
      break;
    }

    case 'triangle':
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI * 2 / 3) * i - Math.PI / 2;
        const px = x + radius * Math.cos(a), py = y + radius * Math.sin(a);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;

    default:
      ctx.arc(x, y, radius, 0, Math.PI * 2);
  }
}

/** Axis-aligned rectangle boundary intersection */
function rectBoundary(cx: number, cy: number, hw: number, hh: number, ux: number, uy: number): Vec2 {
  if (Math.abs(ux) < 1e-9) return { x: cx, y: cy + Math.sign(uy) * hh };
  if (Math.abs(uy) < 1e-9) return { x: cx + Math.sign(ux) * hw, y: cy };
  const tx = hw / Math.abs(ux);
  const ty = hh / Math.abs(uy);
  const t  = Math.min(tx, ty);
  return { x: cx + ux * t, y: cy + uy * t };
}

/** Regular polygon boundary intersection */
function polygonBoundary(
  cx: number, cy: number, r: number,
  sides: number, startAngle: number,
  ux: number, uy: number
): Vec2 {
  const dirAngle = Math.atan2(uy, ux);
  const sectorAngle = (Math.PI * 2) / sides;
  const sector = Math.floor(((dirAngle - startAngle + Math.PI * 4) % (Math.PI * 2)) / sectorAngle);
  const a1 = startAngle + sector * sectorAngle;
  const a2 = a1 + sectorAngle;
  const v1: Vec2 = { x: cx + r * Math.cos(a1), y: cy + r * Math.sin(a1) };
  const v2: Vec2 = { x: cx + r * Math.cos(a2), y: cy + r * Math.sin(a2) };
  const pt = raySegmentIntersect(cx, cy, ux, uy, v1, v2);
  return pt ?? { x: cx + ux * r, y: cy + uy * r };
}

/** Ray from (ox,oy) in direction (dx,dy) intersects segment p1→p2 */
function raySegmentIntersect(
  ox: number, oy: number, dx: number, dy: number,
  p1: Vec2, p2: Vec2
): Vec2 | null {
  const ex = p2.x - p1.x, ey = p2.y - p1.y;
  const denom = dx * ey - dy * ex;
  if (Math.abs(denom) < 1e-9) return null;
  const tx = p1.x - ox, ty = p1.y - oy;
  const t  = (tx * ey - ty * ex) / denom;
  const u  = (tx * dy - ty * dx) / denom;
  if (t < 0 || u < 0 || u > 1) return null;
  return { x: ox + dx * t, y: oy + dy * t };
}
