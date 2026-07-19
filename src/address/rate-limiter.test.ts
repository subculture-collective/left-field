import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter } from "./rate-limiter";
describe("FixedWindowRateLimiter", () => { it("has deterministic fixed-window boundaries", () => { let now = 100; const limiter = new FixedWindowRateLimiter(2, 10, () => now); expect(limiter.tryAcquire()).toBe(true); expect(limiter.tryAcquire()).toBe(true); expect(limiter.tryAcquire()).toBe(false); now = 110; expect(limiter.tryAcquire()).toBe(true); }); it("rejects invalid limits", () => expect(() => new FixedWindowRateLimiter(0, 1)).toThrow()); });
