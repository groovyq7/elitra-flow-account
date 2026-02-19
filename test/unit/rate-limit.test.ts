/**
 * Unit tests for lib/utils/rate-limit.ts
 *
 * Tests the createRateLimiter factory: per-IP counters, windowing,
 * and independence across different IP addresses.
 *
 * Time is controlled by replacing Date.now() so tests run instantly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRateLimiter } from "@/lib/utils/rate-limit";

// ── Time helpers ──────────────────────────────────────────────────────────────

let nowMs = 1_000_000; // arbitrary start time

beforeEach(() => {
  nowMs = 1_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => nowMs);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function advanceMs(ms: number) {
  nowMs += ms;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createRateLimiter — first request", () => {
  it("allows the first request from an IP", () => {
    const limiter = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });

    expect(limiter.isRateLimited("1.2.3.4")).toBe(false);
  });

  it("allows the first request from any IP including 'unknown'", () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60_000 });

    expect(limiter.isRateLimited("unknown")).toBe(false);
  });
});

describe("createRateLimiter — requests within limit", () => {
  it("allows all requests up to maxRequests", () => {
    const MAX = 5;
    const limiter = createRateLimiter({ maxRequests: MAX, windowMs: 60_000 });
    const ip = "10.0.0.1";

    for (let i = 0; i < MAX; i++) {
      expect(limiter.isRateLimited(ip)).toBe(false);
    }
  });

  it("each allowed request increments the counter", () => {
    const limiter = createRateLimiter({ maxRequests: 3, windowMs: 60_000 });
    const ip = "10.0.0.2";

    expect(limiter.isRateLimited(ip)).toBe(false); // count = 1
    expect(limiter.isRateLimited(ip)).toBe(false); // count = 2
    expect(limiter.isRateLimited(ip)).toBe(false); // count = 3
    expect(limiter.isRateLimited(ip)).toBe(true);  // count would be 4 → blocked
  });
});

describe("createRateLimiter — request exceeding limit", () => {
  it("blocks the (maxRequests + 1)th request from same IP", () => {
    const limiter = createRateLimiter({ maxRequests: 3, windowMs: 60_000 });
    const ip = "192.168.1.1";

    limiter.isRateLimited(ip); // 1
    limiter.isRateLimited(ip); // 2
    limiter.isRateLimited(ip); // 3 — last allowed
    expect(limiter.isRateLimited(ip)).toBe(true); // 4 — blocked
  });

  it("continues to block subsequent requests once limit is hit", () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60_000 });
    const ip = "192.168.1.2";

    limiter.isRateLimited(ip); // 1
    limiter.isRateLimited(ip); // 2
    expect(limiter.isRateLimited(ip)).toBe(true);
    expect(limiter.isRateLimited(ip)).toBe(true);
    expect(limiter.isRateLimited(ip)).toBe(true);
  });
});

describe("createRateLimiter — window expiry", () => {
  it("allows requests again after the time window has passed", () => {
    const WINDOW = 60_000;
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: WINDOW });
    const ip = "172.16.0.1";

    limiter.isRateLimited(ip); // 1
    limiter.isRateLimited(ip); // 2
    expect(limiter.isRateLimited(ip)).toBe(true); // blocked

    // Advance past the window
    advanceMs(WINDOW + 1);

    // New window starts — should be allowed again
    expect(limiter.isRateLimited(ip)).toBe(false);
  });

  it("resets the counter after window expiry (not just the block)", () => {
    const WINDOW = 30_000;
    const limiter = createRateLimiter({ maxRequests: 3, windowMs: WINDOW });
    const ip = "172.16.0.2";

    // Use up all 3 requests
    limiter.isRateLimited(ip);
    limiter.isRateLimited(ip);
    limiter.isRateLimited(ip);
    expect(limiter.isRateLimited(ip)).toBe(true);

    // Advance past window
    advanceMs(WINDOW + 1);

    // Should have a fresh counter — all 3 requests allowed again
    expect(limiter.isRateLimited(ip)).toBe(false);
    expect(limiter.isRateLimited(ip)).toBe(false);
    expect(limiter.isRateLimited(ip)).toBe(false);
    // 4th should be blocked
    expect(limiter.isRateLimited(ip)).toBe(true);
  });

  it("one IP's window expiry does not affect another IP's counter", () => {
    const WINDOW = 60_000;
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: WINDOW });
    const ip1 = "1.1.1.1";
    const ip2 = "2.2.2.2";

    // ip1 uses up its window
    limiter.isRateLimited(ip1);
    limiter.isRateLimited(ip1);
    expect(limiter.isRateLimited(ip1)).toBe(true);

    // ip2 also uses up its window
    limiter.isRateLimited(ip2);
    limiter.isRateLimited(ip2);
    expect(limiter.isRateLimited(ip2)).toBe(true);

    // Advance time — both windows expire
    advanceMs(WINDOW + 1);

    // Both should be reset independently
    expect(limiter.isRateLimited(ip1)).toBe(false);
    expect(limiter.isRateLimited(ip2)).toBe(false);
  });
});

describe("createRateLimiter — independent IP limits", () => {
  it("different IPs have independent counters", () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60_000 });

    const ip1 = "10.0.0.1";
    const ip2 = "10.0.0.2";
    const ip3 = "10.0.0.3";

    // Exhaust ip1
    limiter.isRateLimited(ip1);
    limiter.isRateLimited(ip1);
    expect(limiter.isRateLimited(ip1)).toBe(true);

    // ip2 and ip3 are unaffected
    expect(limiter.isRateLimited(ip2)).toBe(false);
    expect(limiter.isRateLimited(ip3)).toBe(false);
  });

  it("limiting ip1 does not consume ip2's quota", () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60_000 });

    // ip1 is rate-limited
    limiter.isRateLimited("a.b.c.d"); // 1 — allowed
    expect(limiter.isRateLimited("a.b.c.d")).toBe(true); // blocked

    // ip2 gets its own fresh quota
    expect(limiter.isRateLimited("e.f.g.h")).toBe(false);
  });
});

describe("createRateLimiter — independent limiter instances", () => {
  it("two limiter instances have completely separate state", () => {
    const limiter1 = createRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    const limiter2 = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });

    const ip = "shared-ip";

    // Exhaust limiter1 for this IP
    limiter1.isRateLimited(ip);
    expect(limiter1.isRateLimited(ip)).toBe(true);

    // limiter2 has its own counter — not affected
    expect(limiter2.isRateLimited(ip)).toBe(false);
    expect(limiter2.isRateLimited(ip)).toBe(false);
  });
});

describe("createRateLimiter — default window", () => {
  it("uses 60_000 ms window when windowMs is not provided", () => {
    const limiter = createRateLimiter({ maxRequests: 2 });
    const ip = "default-window-test";

    limiter.isRateLimited(ip);
    limiter.isRateLimited(ip);
    expect(limiter.isRateLimited(ip)).toBe(true);

    // Advance 59 seconds — should still be blocked
    advanceMs(59_000);
    expect(limiter.isRateLimited(ip)).toBe(true);

    // Advance 2 more seconds — now past 60s window
    advanceMs(2_000);
    expect(limiter.isRateLimited(ip)).toBe(false);
  });
});
