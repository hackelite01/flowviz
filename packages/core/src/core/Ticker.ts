// ─── Animation Ticker (RAF Loop) ─────────────────────────────────────────────
//
// Wraps requestAnimationFrame with:
// • deltaTime calculation (capped at 100ms to prevent spiral of death)
// • Speed multiplier for global animation speed control
// • Pause/resume without losing RAF handle
// • Multiple callback support

const MAX_DELTA = 0.1; // cap at 100ms — prevents huge dt spikes after tab switch

export type TickFn = (dt: number) => void;

export class Ticker {
  private callbacks: TickFn[] = [];
  private rafId    = 0;
  private lastTime = 0;
  private _paused  = false;
  private _speed   = 1;
  private _running = false;

  add(fn: TickFn): void {
    this.callbacks.push(fn);
  }

  remove(fn: TickFn): void {
    const idx = this.callbacks.indexOf(fn);
    if (idx !== -1) this.callbacks.splice(idx, 1);
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this._paused  = false;
    this.lastTime = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  /**
   * Stop the RAF loop entirely (cancels requestAnimationFrame).
   * Calling start() after stop() will restart the loop from scratch.
   * Use pause()/resume() for lower-overhead temporary suspension.
   */
  stop(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this._running = false;
  }

  pause(): void {
    this._paused = true;
  }

  resume(): void {
    if (this._paused) {
      this._paused  = false;
      this.lastTime = 0; // reset so dt doesn't spike on resume
    }
  }

  setSpeed(multiplier: number): void {
    this._speed = Math.max(0, multiplier);
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    this._running = false;
    this.callbacks.length = 0;
  }

  get paused(): boolean { return this._paused; }
  get speed(): number   { return this._speed;  }
  get running(): boolean { return this._running; }

  private tick = (timestamp: number): void => {
    if (!this._running) return;
    this.rafId = requestAnimationFrame(this.tick);

    if (this._paused) return;

    const rawDt = this.lastTime > 0 ? (timestamp - this.lastTime) / 1000 : 0;
    this.lastTime = timestamp;

    const dt = Math.min(rawDt, MAX_DELTA) * this._speed;
    if (dt <= 0) return; // first frame or speed=0

    for (const fn of this.callbacks) {
      fn(dt);
    }
  };
}
