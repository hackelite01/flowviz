import type { ShapeDrawFn } from '../types/index';

// ─── Built-in shape drawers ───────────────────────────────────────────────────

// dot → bright radial light-burst point (like a photon head)
const dotShape: ShapeDrawFn = (ctx, x, y, size, color, _angle, alpha) => {
  ctx.globalAlpha = alpha;
  // Outer bloom
  const outerGrad = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
  outerGrad.addColorStop(0, color + 'cc');
  outerGrad.addColorStop(0.35, color + '55');
  outerGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.arc(x, y, size * 3, 0, Math.PI * 2);
  ctx.fill();
  // White-hot core
  const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, size * 0.85);
  coreGrad.addColorStop(0, 'rgba(255,255,255,1)');
  coreGrad.addColorStop(0.5, color);
  coreGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.85, 0, Math.PI * 2);
  ctx.fill();
};

const rectShape: ShapeDrawFn = (ctx, x, y, size, color, _angle, alpha) => {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  const half = size / 2;
  ctx.fillRect(x - half, y - half, size, size);
};

// streak → elongated photon bolt with massive outer bloom
const streakShape: ShapeDrawFn = (ctx, x, y, size, color, angle, alpha) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const len = size * 7;
  const halfLen = len / 2;
  const halfW = size * 0.6;

  // ── Outermost bloom halo (very wide, very faint)
  ctx.globalAlpha = alpha * 0.18;
  const haloGrad = ctx.createLinearGradient(-halfLen * 1.2, 0, halfLen * 1.2, 0);
  haloGrad.addColorStop(0, 'transparent');
  haloGrad.addColorStop(0.25, color + '18');
  haloGrad.addColorStop(0.5, color + '44');
  haloGrad.addColorStop(0.75, color + '18');
  haloGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = haloGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, halfLen * 1.2, halfW * 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Middle glow envelope
  ctx.globalAlpha = alpha * 0.50;
  const midGrad = ctx.createLinearGradient(-halfLen, 0, halfLen, 0);
  midGrad.addColorStop(0, 'transparent');
  midGrad.addColorStop(0.15, color + '22');
  midGrad.addColorStop(0.5, color + '88');
  midGrad.addColorStop(0.85, color + '22');
  midGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = midGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, halfLen, halfW * 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Bright colored core beam
  ctx.globalAlpha = alpha * 0.90;
  const coreGrad = ctx.createLinearGradient(-halfLen * 0.8, 0, halfLen * 0.8, 0);
  coreGrad.addColorStop(0, 'transparent');
  coreGrad.addColorStop(0.15, color + '44');
  coreGrad.addColorStop(0.5, color);
  coreGrad.addColorStop(0.85, color + '44');
  coreGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, halfLen * 0.8, halfW * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── White-hot specular center point
  ctx.globalAlpha = alpha * 0.95;
  const hotspot = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.2);
  hotspot.addColorStop(0, 'rgba(255,255,255,1)');
  hotspot.addColorStop(0.3, color + 'ee');
  hotspot.addColorStop(0.7, color + '55');
  hotspot.addColorStop(1, 'transparent');
  ctx.fillStyle = hotspot;
  ctx.beginPath();
  ctx.arc(0, 0, size * 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

const ringShape: ShapeDrawFn = (ctx, x, y, size, color, _angle, alpha) => {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.stroke();
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export class ShapeRegistry {
  private static shapes = new Map<string, ShapeDrawFn>([
    ['dot', dotShape],
    ['rect', rectShape],
    ['streak', streakShape],
    ['ring', ringShape],
  ]);

  static register(name: string, fn: ShapeDrawFn): void {
    ShapeRegistry.shapes.set(name, fn);
  }

  static draw(
    name: string,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
    angle: number,
    alpha: number
  ): void {
    const fn = ShapeRegistry.shapes.get(name) ?? dotShape;
    fn(ctx, x, y, size, color, angle, alpha);
  }

  static has(name: string): boolean {
    return ShapeRegistry.shapes.has(name);
  }

  static list(): string[] {
    return Array.from(ShapeRegistry.shapes.keys());
  }
}
