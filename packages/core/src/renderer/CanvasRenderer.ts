import type { ResolvedEdge, BackgroundConfig, ParticleState, RenderConfig } from '../types';
import { ShapeRegistry } from './ShapeRegistry';
import type { PathData } from '../path/BezierPath';

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.dpr = window.devicePixelRatio || 1;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(this.dpr, this.dpr);
  }

  drawFrame(
    width: number,
    height: number,
    background: BackgroundConfig,
    render: RenderConfig,
    edges: ResolvedEdge[],
    particles: ParticleState[],
    pathMap: Map<string, PathData>
  ): void {
    const ctx = this.ctx;
    const bgColor = background.color ?? '#000000';

    // ── Background / trail fade ───────────────────────────────────────────────
    ctx.globalCompositeOperation = 'source-over';
    if (render.noTrailFade) {
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, width, height);
      this.drawBackground(width, height, background);
    } else {
      // Semi-transparent fill creates the motion-blur "trail" persistence effect.
      // Higher alpha = trails fade faster (cleaner). Lower = ghost persistence.
      const fadeAlpha = render.trailFadeAlpha ?? 0.18;
      ctx.globalAlpha = fadeAlpha;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.globalAlpha = 1;

    // ── Optional edge visual layers ───────────────────────────────────────────
    const useNeon  = render.neonBeams  ?? false;
    const useTubes = render.edgeTubes  ?? false;

    if (useNeon || useTubes) {
      ctx.globalCompositeOperation = render.particleBlend ?? 'screen';
      const ref = Math.min(width, height);
      for (const edge of edges) {
        const path = pathMap.get(edge.id);
        if (!path || path.length < 1) continue;
        if (useNeon) {
          this.drawNeonBeam(path, edge.color, edge.opacity ?? 1, ref);
        } else {
          // Subtle glow tube — much gentler than neon
          this.drawEdgeTube(path, edge.color, edge.opacity ?? 1, edge.width,
            render.tubeOpacity ?? 0.6);
        }
      }
    }

    // ── Particles ─────────────────────────────────────────────────────────────
    const blend = render.particleBlend ?? 'screen';
    ctx.globalCompositeOperation = blend;

    const edgeMap = new Map<string, ParticleState[]>();
    for (const p of particles) {
      if (!edgeMap.has(p.edgeId)) edgeMap.set(p.edgeId, []);
      edgeMap.get(p.edgeId)!.push(p);
    }

    const showGlow = render.particleGlow !== false; // default true

    for (const edge of edges) {
      const pts = edgeMap.get(edge.id);
      if (!pts) continue;
      const pc    = edge.particles;
      const color = pc.color     || edge.color;
      const glowC = pc.glowColor || color;

      for (const p of pts) {
        if (!isFinite(p.x) || !isFinite(p.y)) continue;

        // Trail
        if (p.trail.length > 1) {
          this.drawTrail(p.trail, p.x, p.y, color, pc.size);
        }

        // Bloom glow halo around particle head
        if (showGlow) {
          const bR = pc.glowRadius > 0 ? pc.glowRadius : pc.size * 3;
          this.drawGlow(p.x, p.y, pc.size, glowC, bR);
        }

        // Particle shape (dot / streak / ring / etc.)
        ShapeRegistry.draw(pc.shape, ctx, p.x, p.y, pc.size, color, p.angle, 1);
      }
    }

    // ── Optional vignette ─────────────────────────────────────────────────────
    if (render.vignette) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      this.drawVignette(width, height, bgColor);
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // ─── Subtle edge glow tube (opt-in, gentler than neon) ───────────────────────
  // 3 additive passes: outer soft haze → mid glow → thin bright core
  private drawEdgeTube(
    path: PathData,
    color: string,
    opacity: number,
    edgeWidth: number,
    tubeOpacity: number
  ): void {
    const ctx = this.ctx;
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    const { r, g, b } = rgb;
    const p2d = new Path2D(path.svgD);

    ctx.save();
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
    const base = edgeWidth;

    // Outer soft haze
    ctx.globalAlpha = opacity * tubeOpacity * 0.08;
    ctx.lineWidth   = base * 12;
    ctx.strokeStyle = `rgb(${r},${g},${b})`;
    ctx.stroke(p2d);

    // Mid glow
    ctx.globalAlpha = opacity * tubeOpacity * 0.25;
    ctx.lineWidth   = base * 5;
    ctx.strokeStyle = `rgb(${r},${g},${b})`;
    ctx.stroke(p2d);

    // Core bright line
    ctx.globalAlpha = opacity * tubeOpacity * 0.70;
    ctx.lineWidth   = base * 1.2;
    ctx.strokeStyle = `rgb(${r},${g},${b})`;
    ctx.stroke(p2d);

    ctx.restore();
  }

  // ─── Heavy neon beam (opt-in) — 6-layer canvas-proportional light ray ────────
  // Recreates the fiber-optic / abstract glowing strokes aesthetic.
  // ref = Math.min(canvasWidth, canvasHeight) for proportional sizing.
  private drawNeonBeam(
    path: PathData,
    color: string,
    opacity: number,
    ref: number
  ): void {
    const ctx  = this.ctx;
    const lut  = path.lut;
    const total = lut.length / 3;
    if (total < 2) return;

    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    const { r, g, b } = rgb;

    const STEPS = 180;
    const step  = Math.max(1, Math.floor(total / STEPS));

    const buildPath = () => {
      ctx.beginPath();
      let first = true;
      for (let i = 0; i < total; i += step) {
        const x = lut[i * 3], y = lut[i * 3 + 1];
        if (!isFinite(x) || !isFinite(y)) continue;
        if (first) { ctx.moveTo(x, y); first = false; }
        else ctx.lineTo(x, y);
      }
    };

    ctx.save();
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    // 1. Atmospheric haze
    ctx.globalAlpha = opacity * 0.025; ctx.lineWidth = ref * 0.22;
    ctx.strokeStyle = `rgb(${r},${g},${b})`; buildPath(); ctx.stroke();
    // 2. Outer bloom
    ctx.globalAlpha = opacity * 0.080; ctx.lineWidth = ref * 0.10;
    ctx.strokeStyle = `rgb(${r},${g},${b})`; buildPath(); ctx.stroke();
    // 3. Mid glow
    ctx.globalAlpha = opacity * 0.20;  ctx.lineWidth = ref * 0.04;
    ctx.strokeStyle = `rgb(${r},${g},${b})`; buildPath(); ctx.stroke();
    // 4. Inner glow
    ctx.globalAlpha = opacity * 0.50;  ctx.lineWidth = ref * 0.014;
    ctx.strokeStyle = `rgb(${r},${g},${b})`; buildPath(); ctx.stroke();
    // 5. Core beam
    ctx.globalAlpha = opacity * 0.90;  ctx.lineWidth = ref * 0.004;
    ctx.strokeStyle = `rgb(${r},${g},${b})`; buildPath(); ctx.stroke();
    // 6. White-hot specular
    ctx.globalAlpha = opacity * 0.80;  ctx.lineWidth = ref * 0.0015;
    ctx.strokeStyle = `rgb(255,255,255)`; buildPath(); ctx.stroke();

    ctx.restore();
  }

  // ─── Particle comet trail ─────────────────────────────────────────────────────
  private drawTrail(
    trail: Array<{ x: number; y: number }>,
    headX: number, headY: number,
    color: string, size: number
  ): void {
    const ctx = this.ctx;
    if (trail.length < 2) return;
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    const { r, g, b } = rgb;

    // Use only the continuous segment nearest the head (avoids wrap-around artifacts)
    const MAX_JUMP_SQ = (size * 80) * (size * 80);
    const pts: Array<{ x: number; y: number }> = [...trail, { x: headX, y: headY }];
    const total = pts.length;
    let segStart = total - 2;
    for (let i = total - 2; i >= 0; i--) {
      const dx = pts[i + 1].x - pts[i].x;
      const dy = pts[i + 1].y - pts[i].y;
      if (dx * dx + dy * dy > MAX_JUMP_SQ) break;
      segStart = i;
    }
    const seg = pts.slice(segStart);
    if (seg.length < 2) return;

    const tail = seg[0];
    const head = seg[seg.length - 1];
    if (Math.hypot(head.x - tail.x, head.y - tail.y) < 0.5) return;

    const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    grad.addColorStop(0,    `rgba(${r},${g},${b},0)`);
    grad.addColorStop(0.45, `rgba(${r},${g},${b},0.25)`);
    grad.addColorStop(0.80, `rgba(${r},${g},${b},0.70)`);
    grad.addColorStop(1,    `rgba(${r},${g},${b},0.95)`);

    const hw = size * 1.4;
    ctx.save();
    ctx.lineCap   = 'round';
    ctx.globalAlpha = 1;
    ctx.lineWidth   = hw * 1.6;
    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) ctx.lineTo(seg[i].x, seg[i].y);
    ctx.stroke();

    // White specular on the head-facing portion of the trail
    const si = Math.floor(seg.length * 0.65);
    ctx.globalAlpha = 0.65;
    ctx.lineWidth   = hw * 0.4;
    ctx.strokeStyle = `rgba(255,255,255,0.75)`;
    ctx.beginPath();
    ctx.moveTo(seg[si].x, seg[si].y);
    for (let i = si + 1; i < seg.length; i++) ctx.lineTo(seg[i].x, seg[i].y);
    ctx.stroke();

    ctx.restore();
  }

  // ─── Radial glow bloom around particle head ───────────────────────────────────
  private drawGlow(x: number, y: number, size: number, color: string, radius: number): void {
    if (!isFinite(x) || !isFinite(y) || !isFinite(size) || !isFinite(radius)) return;
    const ctx = this.ctx;
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    const { r, g, b } = rgb;

    const outerR = Math.max(0.1, radius * 4 + size);
    const outer  = ctx.createRadialGradient(x, y, 0, x, y, outerR);
    outer.addColorStop(0,    `rgba(${r},${g},${b},0.60)`);
    outer.addColorStop(0.25, `rgba(${r},${g},${b},0.25)`);
    outer.addColorStop(0.65, `rgba(${r},${g},${b},0.06)`);
    outer.addColorStop(1,    'transparent');
    ctx.fillStyle = outer;
    ctx.beginPath(); ctx.arc(x, y, outerR, 0, Math.PI * 2); ctx.fill();

    const innerR = Math.max(0.1, radius * 1.0 + size);
    const inner  = ctx.createRadialGradient(x, y, 0, x, y, innerR);
    inner.addColorStop(0,    `rgba(255,255,255,1)`);
    inner.addColorStop(0.15, `rgba(${r},${g},${b},0.90)`);
    inner.addColorStop(0.50, `rgba(${r},${g},${b},0.40)`);
    inner.addColorStop(1,    'transparent');
    ctx.fillStyle = inner;
    ctx.beginPath(); ctx.arc(x, y, innerR, 0, Math.PI * 2); ctx.fill();
  }

  // ─── Dark radial vignette (opt-in) ────────────────────────────────────────────
  private drawVignette(width: number, height: number, baseColor: string): void {
    const ctx = this.ctx;
    const cx = width / 2, cy = height / 2;
    const r  = Math.max(width, height) * 0.75;
    if (!isFinite(r) || r <= 0) return;
    const grad = ctx.createRadialGradient(cx, cy, r * 0.30, cx, cy, r);
    grad.addColorStop(0,   'transparent');
    grad.addColorStop(0.6, baseColor + '55');
    grad.addColorStop(1,   baseColor + 'ee');
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle   = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // ─── Background fill (used when noTrailFade=true) ────────────────────────────
  private drawBackground(width: number, height: number, bg: BackgroundConfig): void {
    const ctx = this.ctx;
    if (bg.gradient && bg.gradient.length === 2) {
      const angle = ((bg.gradientAngle ?? 135) * Math.PI) / 180;
      const cx = width / 2, cy = height / 2;
      const r  = Math.sqrt(width * width + height * height) / 2;
      const grad = ctx.createLinearGradient(
        cx - Math.cos(angle) * r, cy - Math.sin(angle) * r,
        cx + Math.cos(angle) * r, cy + Math.sin(angle) * r
      );
      grad.addColorStop(0, bg.gradient[0]);
      grad.addColorStop(1, bg.gradient[1]);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = bg.color ?? '#000000';
    }
    ctx.fillRect(0, 0, width, height);
    this.drawBackgroundDecor(width, height, bg);
  }

  private drawBackgroundDecor(width: number, height: number, bg: BackgroundConfig): void {
    const ctx = this.ctx;
    if (bg.showDots) {
      const spacing  = bg.dotSpacing ?? 30;
      const dotColor = bg.dotColor   ?? 'rgba(255,255,255,0.05)';
      ctx.fillStyle  = dotColor;
      for (let x = 0; x < width; x += spacing) {
        for (let y = 0; y < height; y += spacing) {
          ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    if (bg.showGrid) {
      const spacing   = bg.gridSpacing ?? 40;
      const gridColor = bg.gridColor   ?? 'rgba(255,255,255,0.04)';
      ctx.strokeStyle = gridColor;
      ctx.lineWidth   = 0.5;
      for (let x = 0; x < width; x += spacing) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y < height; y += spacing) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }
    }
  }

  // ─── Color parser ─────────────────────────────────────────────────────────────
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const full  = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (full)  return { r: parseInt(full[1], 16),  g: parseInt(full[2], 16),  b: parseInt(full[3], 16)  };
    const short = hex.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i);
    if (short) return { r: parseInt(short[1] + short[1], 16), g: parseInt(short[2] + short[2], 16), b: parseInt(short[3] + short[3], 16) };
    const rgb   = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgb)   return { r: parseInt(rgb[1]), g: parseInt(rgb[2]), b: parseInt(rgb[3]) };
    return null;
  }

  getContext(): CanvasRenderingContext2D { return this.ctx; }
}
