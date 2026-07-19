/** Process-local prototype guard only: deployment must provide distributed limiting. */
export class FixedWindowRateLimiter {
  private windowStart: number | null = null;
  private used = 0;

  constructor(private readonly limit: number, private readonly windowMs: number, private readonly now: () => number = Date.now) {
    if (!Number.isInteger(limit) || limit <= 0 || !Number.isInteger(windowMs) || windowMs <= 0) throw new Error("Rate limiter requires positive integer limit and window");
  }

  tryAcquire(): boolean {
    const current = this.now();
    if (this.windowStart === null || current - this.windowStart >= this.windowMs || current < this.windowStart) {
      this.windowStart = current;
      this.used = 0;
    }
    if (this.used >= this.limit) return false;
    this.used += 1;
    return true;
  }
}
