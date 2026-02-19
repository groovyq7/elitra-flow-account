import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// ── Module-level cache isolation ──────────────────────────────────────────────
// We re-import the module per test group so each describe block starts with a
// clean cache state. vitest resets modules between describe blocks when
// vi.resetModules() is called before the import.

// ---------------------------------------------------------------------------
// getCached / setCached — simple-api-cache
// ---------------------------------------------------------------------------

describe("simple-api-cache", () => {
  // We use vi.useFakeTimers to control Date.now() for TTL expiry tests.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Import after fake timers are installed so Date.now() is controlled.
  it("returns undefined for a missing key", async () => {
    const { getCached } = await import("@/lib/utils/simple-api-cache");
    expect(getCached("no-such-key")).toBeUndefined();
  });

  it("stores and retrieves a value", async () => {
    const { getCached, setCached } = await import("@/lib/utils/simple-api-cache");
    setCached("foo", { x: 1 });
    expect(getCached("foo")).toEqual({ x: 1 });
  });

  it("returns undefined for an expired entry (> 1 hour old)", async () => {
    const { getCached, setCached } = await import("@/lib/utils/simple-api-cache");
    setCached("expires", "value");
    expect(getCached("expires")).toBe("value");

    // Advance time by 61 minutes (past the 1-hour TTL)
    vi.advanceTimersByTime(61 * 60 * 1000);
    expect(getCached("expires")).toBeUndefined();
  });

  it("updates an existing key without eviction", async () => {
    const { getCached, setCached } = await import("@/lib/utils/simple-api-cache");
    setCached("k", "v1");
    setCached("k", "v2");
    expect(getCached("k")).toBe("v2");
  });

  it("stores falsy values (0, false, empty string)", async () => {
    const { getCached, setCached } = await import("@/lib/utils/simple-api-cache");
    setCached("zero", 0);
    setCached("false", false);
    setCached("empty", "");
    expect(getCached("zero")).toBe(0);
    expect(getCached("false")).toBe(false);
    expect(getCached("empty")).toBe("");
  });
});
