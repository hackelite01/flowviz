import type { Node } from '../entities/Node';
import type { Edge } from '../entities/Edge';
import type { Particle } from '../entities/Particle';
import type { BackgroundConfig, RenderConfig } from '../types/index';
import { drawNodeShape } from '../geometry/NodeShapes';

// ─── Canvas2D Renderer ────────────────────────────────────────────────────────
//
// Pure rendering — no state beyond canvas/ctx/dpr.
// All frame data is passed as parameters.
//
// Render pipeline order:
//   1. Background / trail-fade
//   2. Edge lines (subtle base line + optional glow tubes / neon beams)
//   3. Particles (trails → glow bloom → shape core)
//   4. Nodes (shape → icon → label)
//   5. Optional: vignette

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d')!;
    this.dpr    = window.devicePixelRatio || 1;
  }

  resize(width: number, height: number): void {
    const dpr   = window.devicePixelRatio || 1;
    const physW = Math.round(width  * dpr);
    const physH = Math.round(height * dpr);
    // Skip if physical backing-store size is unchanged (browser zoom fires resize
    // via ResizeObserver even when CSS dimensions haven't moved; resizing the canvas
    // clears it and causes a visible flash / unwanted motion.)
    if (this.canvas.width === physW && this.canvas.height === physH) {
      this.dpr = dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return;
    }
    this.dpr           = dpr;
    this.canvas.width  = physW;
    this.canvas.height = physH;
    this.canvas.style.width  = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  renderFrame(options: {
    width:         number;
    height:        number;
    background:    BackgroundConfig;
    render:        RenderConfig;
    nodes:         Node[];
    edges:         Edge[];
    particles:     Map<string, Particle[]>; // edgeId → particles
    hoveredNodeId: string | null;
    hoveredEdgeId: string | null;
  }): void {
    const { width, height, background, render, nodes, edges, particles } = options;
    const ctx = this.ctx;
    const bgColor = background.color ?? '#000000';

    // ── 1. Background / trail-fade ───────────────────────────────────────────
    ctx.globalCompositeOperation = 'source-over';
    if (render.noTrailFade) {
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, width, height);
      this.drawBackground(width, height, background);
    } else {
      // Dim previous frame to create particle trail persistence
      const fadeAlpha = render.trailFadeAlpha ?? 0.18;
      ctx.globalAlpha = fadeAlpha;
      ctx.fillStyle   = bgColor;
      ctx.fillRect(0, 0, width, height);
      // Redraw background patterns (grid/dots) fresh every frame so they remain visible.
      // Grid/dots are geometry — they should not be subject to trail fade.
      ctx.globalAlpha = 1;
      this.drawBackgroundPattern(width, height, background);
    }
    ctx.globalAlpha = 1;

    // ── 2. Edge lines ────────────────────────────────────────────────────────
    const useNeon  = render.neonBeams  ?? false;
    const useTubes = render.edgeTubes  ?? false;

    if (useNeon || useTubes) {
      ctx.globalCompositeOperation = render.particleBlend ?? 'screen';
      const ref = Math.min(width, height);
      for (const edge of edges) {
        if (useNeon) {
          this.drawNeonBeam(edge, ref);
        } else {
          this.drawEdgeTube(edge, render.tubeOpacity ?? 0.6);
        }
      }
    }

    // Base edge lines (subtle)
    ctx.globalCompositeOperation = 'source-over';
    for (const edge of edges) {
      edge.renderLine(ctx);
    }

    // ── 3. Particles ─────────────────────────────────────────────────────────
    ctx.globalCompositeOperation = render.particleBlend ?? 'screen';
    const showGlow = render.particleGlow !== false; // default true

    for (const edge of edges) {
      const pts = particles.get(edge.id);
      if (!pts || pts.length === 0) continue;
      const pc    = edge.particles;
      const color = pc.color     || edge.color;
      const glowC = pc.glowColor || color;

      for (const p of pts) {
        if (!p.active || !isFinite(p.x) || !isFinite(p.y)) continue;

        // Trail
        if (p.trailLen >= 2) {
          this.drawParticleTrail(p, color, pc.size);
        }

        // Glow bloom at head
        if (showGlow) {
          const bR = (pc.glowRadius > 0 ? pc.glowRadius : pc.size * 3) * (pc.glow ?? 1);
          this.drawGlowBloom(p.x, p.y, pc.size, glowC, bR);
        }

        // Particle shape
        this.drawParticleShape(p, pc.shape, pc.size, color);
      }
    }

    // ── 4. Nodes ─────────────────────────────────────────────────────────────
    ctx.globalCompositeOperation = 'source-over';
    for (const node of nodes) {
      node.render(ctx);
    }

    // ── 5. Vignette (optional) ───────────────────────────────────────────────
    if (render.vignette) {
      this.drawVignette(width, height, bgColor);
    }

    ctx.globalAlpha              = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ─── Background ──────────────────────────────────────────────────────────────

  private drawBackground(width: number, height: number, bg: BackgroundConfig): void {
    const ctx = this.ctx;
    if (bg.gradient && bg.gradient.length === 2) {
      const angle = ((bg.gradientAngle ?? 135) * Math.PI) / 180;
      const cx = width / 2, cy = height / 2;
      const r  = Math.sqrt(width * width + height * height) / 2;
      const g  = ctx.createLinearGradient(
        cx - Math.cos(angle) * r, cy - Math.sin(angle) * r,
        cx + Math.cos(angle) * r, cy + Math.sin(angle) * r
      );
      g.addColorStop(0, bg.gradient[0]);
      g.addColorStop(1, bg.gradient[1]);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = bg.color ?? '#000000';
    }
    ctx.fillRect(0, 0, width, height);
    this.drawBackgroundPattern(width, height, bg);
  }

  /** Draw only the grid / dot pattern — no background fill. */
  private drawBackgroundPattern(width: number, height: number, bg: BackgroundConfig): void {
    const ctx = this.ctx;

    // Grid
    if (bg.showGrid) {
      const sp    = bg.gridSpacing ?? 40;
      const color = bg.gridColor   ?? 'rgba(255,255,255,0.04)';
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth   = 0.5;
      for (let x = 0; x < width; x += sp) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y < height; y += sp) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }
      ctx.restore();
    }

    // Dots
    if (bg.showDots) {
      const sp    = bg.dotSpacing ?? 30;
      const color = bg.dotColor   ?? 'rgba(255,255,255,0.05)';
      ctx.save();
      ctx.fillStyle = color;
      for (let x = 0; x < width; x += sp) {
        for (let y = 0; y < height; y += sp) {
          ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  // ─── Edge Glow Tube ──────────────────────────────────────────────────────────

  private drawEdgeTube(edge: Edge, tubeOpacity: number): void {
    const ctx = this.ctx;
    const rgb = hexToRgb(edge.color);
    if (!rgb) return;
    const { r, g, b } = rgb;
    const p2d = new Path2D(edge.path.svgD);
    const base = edge.width;

    ctx.save();
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    ctx.globalAlpha = edge.opacity * tubeOpacity * 0.08;
    ctx.lineWidth   = base * 12;
    ctx.strokeStyle = `rgb(${r},${g},${b})`;
    ctx.stroke(p2d);

    ctx.globalAlpha = edge.opacity * tubeOpacity * 0.25;
    ctx.lineWidth   = base * 5;
    ctx.stroke(p2d);

    ctx.globalAlpha = edge.opacity * tubeOpacity * 0.70;
    ctx.lineWidth   = base * 1.2;
    ctx.stroke(p2d);

    ctx.restore();
  }

  // ─── Heavy Neon Beam ─────────────────────────────────────────────────────────

  private drawNeonBeam(edge: Edge, ref: number): void {
    const ctx = this.ctx;
    const rgb = hexToRgb(edge.color);
    if (!rgb) return;
    const { r, g, b } = rgb;
    const lut   = edge.path.lut;
    const total = lut.length / 3;
    if (total < 2) return;

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

    const op = edge.opacity;
    ctx.globalAlpha = op * 0.025; ctx.lineWidth = ref * 0.22; ctx.strokeStyle = `rgb(${r},${g},${b})`; buildPath(); ctx.stroke();
    ctx.globalAlpha = op * 0.080; ctx.lineWidth = ref * 0.10; buildPath(); ctx.stroke();
    ctx.globalAlpha = op * 0.200; ctx.lineWidth = ref * 0.04; buildPath(); ctx.stroke();
    ctx.globalAlpha = op * 0.500; ctx.lineWidth = ref * 0.014; buildPath(); ctx.stroke();
    ctx.globalAlpha = op * 0.900; ctx.lineWidth = ref * 0.004; buildPath(); ctx.stroke();
    ctx.globalAlpha = op * 0.800; ctx.lineWidth = ref * 0.0015; ctx.strokeStyle = 'rgb(255,255,255)'; buildPath(); ctx.stroke();

    ctx.restore();
  }

  // ─── Particle Trail ──────────────────────────────────────────────────────────

  private drawParticleTrail(p: Particle, color: string, size: number): void {
    const ctx = this.ctx;
    const rgb = hexToRgb(color);
    if (!rgb) return;
    const { r, g, b } = rgb;

    // Collect trail points (oldest first, newest last)
    const pts: Array<{ x: number; y: number }> = [];
    p.forEachTrailPoint((x, y) => pts.push({ x, y }));
    if (pts.length < 2) return;

    // Discontinuity guard: discard old points if there is a large jump
    const maxJumpSq = (size * 80) ** 2;
    let segStart = pts.length - 2;
    for (let i = pts.length - 2; i >= 0; i--) {
      const dx = pts[i + 1].x - pts[i].x;
      const dy = pts[i + 1].y - pts[i].y;
      if (dx * dx + dy * dy > maxJumpSq) break;
      segStart = i;
    }
    const seg = pts.slice(segStart);
    if (seg.length < 2) return;

    const tail = seg[0], head = seg[seg.length - 1];
    if (Math.hypot(head.x - tail.x, head.y - tail.y) < 0.5) return;

    const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    grad.addColorStop(0,    `rgba(${r},${g},${b},0)`);
    grad.addColorStop(0.45, `rgba(${r},${g},${b},0.10)`);
    grad.addColorStop(0.80, `rgba(${r},${g},${b},0.28)`);
    grad.addColorStop(1,    `rgba(${r},${g},${b},0.50)`);

    const hw = size * 0.6;
    ctx.save();
    ctx.lineCap     = 'round';
    ctx.globalAlpha = 1;
    ctx.lineWidth   = hw;
    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) ctx.lineTo(seg[i].x, seg[i].y);
    ctx.stroke();
    ctx.restore();
  }

  // ─── Glow Bloom ──────────────────────────────────────────────────────────────

  private drawGlowBloom(x: number, y: number, size: number, color: string, radius: number): void {
    if (!isFinite(x) || !isFinite(y) || radius <= 0) return;
    const ctx = this.ctx;
    const rgb = hexToRgb(color);
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

    const innerR = Math.max(0.1, radius + size);
    const inner  = ctx.createRadialGradient(x, y, 0, x, y, innerR);
    inner.addColorStop(0,    `rgba(255,255,255,1)`);
    inner.addColorStop(0.15, `rgba(${r},${g},${b},0.90)`);
    inner.addColorStop(0.50, `rgba(${r},${g},${b},0.40)`);
    inner.addColorStop(1,    'transparent');
    ctx.fillStyle = inner;
    ctx.beginPath(); ctx.arc(x, y, innerR, 0, Math.PI * 2); ctx.fill();
  }

  // ─── Particle Shape Core ─────────────────────────────────────────────────────

  private drawParticleShape(p: Particle, shape: string, size: number, color: string): void {
    const ctx = this.ctx;
    const rgb = hexToRgb(color);
    if (!rgb) return;
    const { r, g, b } = rgb;

    ctx.save();
    ctx.globalAlpha = 1;

    switch (shape) {
      case 'dot':
      default: {
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'streak': {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        const len = size * 5;
        const grad = ctx.createLinearGradient(-len, 0, size, 0);
        grad.addColorStop(0,    `rgba(${r},${g},${b},0)`);
        grad.addColorStop(0.55, `rgba(${r},${g},${b},0.7)`);
        grad.addColorStop(0.85, `rgba(${r},${g},${b},0.95)`);
        grad.addColorStop(1,    'rgba(255,255,255,1)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse((-len + size) / 2, 0, (len + size) / 2, size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'ring': {
        ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`;
        ctx.lineWidth   = size * 0.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 1.1, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }

  // ─── Vignette ────────────────────────────────────────────────────────────────

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

  getContext(): CanvasRenderingContext2D { return this.ctx; }
}

// ─── Color Utilities ─────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const full  = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (full) return { r: parseInt(full[1], 16), g: parseInt(full[2], 16), b: parseInt(full[3], 16) };
  const short = hex.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i);
  if (short) return { r: parseInt(short[1] + short[1], 16), g: parseInt(short[2] + short[2], 16), b: parseInt(short[3] + short[3], 16) };
  const rgb   = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgb)   return { r: parseInt(rgb[1]), g: parseInt(rgb[2]), b: parseInt(rgb[3]) };
  return null;
}
