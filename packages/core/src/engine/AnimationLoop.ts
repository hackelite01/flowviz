export type TickCallback = (dt: number, elapsed: number) => void;

export class AnimationLoop {
  private rafId: number | null = null;
  private lastTime = 0;
  private elapsed = 0;
  private callbacks: Set<TickCallback> = new Set();
  private _paused = false;
  private _speedMultiplier = 1;

  get paused(): boolean { return this._paused; }
  get speedMultiplier(): number { return this._speedMultiplier; }

  add(cb: TickCallback): () => void {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  start(): void {
    if (this.rafId !== null) return;
    this.lastTime = performance.now();
    this.tick(this.lastTime);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  pause(): void {
    this._paused = true;
  }

  resume(): void {
    if (this._paused) {
      this._paused = false;
      this.lastTime = performance.now();
    }
  }

  setSpeed(multiplier: number): void {
    this._speedMultiplier = Math.max(0, multiplier);
  }

  private tick = (now: number): void => {
    this.rafId = requestAnimationFrame(this.tick);

    if (this._paused) return;

    const rawDt = Math.min((now - this.lastTime) / 1000, 0.1); // cap at 100ms
    this.lastTime = now;
    const dt = rawDt * this._speedMultiplier;
    this.elapsed += dt;

    this.callbacks.forEach(cb => cb(dt, this.elapsed));
  };

  destroy(): void {
    this.stop();
    this.callbacks.clear();
  }
}
