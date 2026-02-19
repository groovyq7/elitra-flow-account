import { describe, it, expect } from "vitest";
import { computeApy24hLinear, computeApy24hLinearCurrentDenom } from "@/lib/utils/apy";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Build a snapshot pair spanning exactly `dtSeconds` seconds with the
 *  specified rates, anchored to `nowSec`.
 *  The "3-day window" in pick24hWindow means the anchor is `nowSec - 3*86400`. */
function makeSnapshots(
  r0: bigint,
  r1: bigint,
  nowSec: number,
  dtSeconds = 86400 * 3
) {
  const t0 = nowSec - dtSeconds;
  const t1 = nowSec - 1; // 1s before now so it's the "latest"
  return [
    { rate: r1, timestamp: t1 }, // latest first (descending)
    { rate: r0, timestamp: t0 },
  ];
}

// 1e18 scale
const ONE = 1_000_000_000_000_000_000n;

// ---------------------------------------------------------------------------
// computeApy24hLinear
// ---------------------------------------------------------------------------
describe("computeApy24hLinear", () => {
  it("returns undefined for empty snapshots", () => {
    const result = computeApy24hLinear([]);
    expect(result.apy).toBeUndefined();
    expect(result.apyScaled).toBeUndefined();
  });

  it("returns undefined for single snapshot (no window)", () => {
    const now = Math.floor(Date.now() / 1000);
    const result = computeApy24hLinear([{ rate: ONE, timestamp: now - 1 }], now);
    expect(result.apy).toBeUndefined();
  });

  it("returns zero apy when rate is unchanged", () => {
    const now = 1_700_000_000;
    const snapshots = makeSnapshots(ONE, ONE, now);
    const result = computeApy24hLinear(snapshots, now);
    // (r1 - r0) = 0 → simpleReturn = 0 → apy = 0
    expect(result.apy).toBe("0");
    expect(result.apyScaled).toBe(0n);
  });

  it("returns a positive APY when rate increases", () => {
    const now = 1_700_000_000;
    // Rate grew from 1e18 to 1.1e18 over 3 days
    const r0 = ONE;
    const r1 = ONE + ONE / 10n; // +10%
    const snapshots = makeSnapshots(r0, r1, now);
    const result = computeApy24hLinear(snapshots, now);
    expect(result.apy).toBeDefined();
    const apyNum = parseFloat(result.apy!);
    expect(apyNum).toBeGreaterThan(0);
    // 10% over 3 days → annualised ≈ 10% * (365/3) ≈ 1216% — very high but correct for 3d window
    expect(apyNum).toBeGreaterThan(100);
  });

  it("returns a negative APY when rate decreases", () => {
    const now = 1_700_000_000;
    const r0 = ONE + ONE / 10n; // higher
    const r1 = ONE;              // lower
    const snapshots = makeSnapshots(r0, r1, now);
    const result = computeApy24hLinear(snapshots, now);
    const apyNum = parseFloat(result.apy!);
    expect(apyNum).toBeLessThan(0);
  });

  it("clamps extreme values to MAX_ABS (1e21 = ~1000%)", () => {
    const now = 1_700_000_000;
    // Huge rate jump over a short but valid time window → would produce astronomical APY
    // We need t1 != t0 and the anchor to be at or before cutoff (now - 3*86400).
    // Use a dt slightly larger than 3*86400 so anchor is placed right at the boundary.
    const r0 = 1n;
    const r1 = ONE * 1_000_000n; // 1e24 rate — gigantic jump
    const dtSeconds = 86400 * 3 + 100; // just over 3 days, so anchor is at cutoff
    const snapshots = makeSnapshots(r0, r1, now, dtSeconds);
    const result = computeApy24hLinear(snapshots, now);
    // apyScaled should be clamped to MAX_ABS
    const MAX_ABS = 1_000_000_000_000_000_000_000n; // 1e21
    expect(result.apyScaled).toBe(MAX_ABS);
  });

  it("returns apy as percentage string (e.g. '8' means 8%)", () => {
    const now = 1_700_000_000;
    // Construct snapshots that give exactly 8% annualised APY
    // simpleReturnScaled = 0.08e18 → apyScaled = 0.08e18 * SECONDS_IN_YEAR / dt
    // We set dt = SECONDS_IN_YEAR so apyScaled = 0.08e18 → apy = "8"
    const SECONDS_IN_YEAR = 31536000;
    const r0 = ONE; // 1e18
    // r1 - r0 = 0.08 * r0 / (SECONDS_IN_YEAR / dt), with dt = SECONDS_IN_YEAR:
    // simpleReturn = (r1-r0)/r0 = 0.08 → r1 = 1.08 * r0
    const r1 = (r0 * 108n) / 100n;
    // dt > 3*86400 so we can use a sufficiently large dt
    const dtSeconds = SECONDS_IN_YEAR;
    const t0 = now - dtSeconds;
    const t1 = now - 1;
    const snapshots = [
      { rate: r1, timestamp: t1 },
      { rate: r0, timestamp: t0 },
    ];
    const result = computeApy24hLinear(snapshots, now);
    // Expected: (0.08 / SECONDS_IN_YEAR) * SECONDS_IN_YEAR = 0.08 → *100 = 8
    const apyNum = parseFloat(result.apy!);
    expect(apyNum).toBeCloseTo(8, 1);
  });

  it("dt field reflects the actual window in seconds", () => {
    const now = 1_700_000_000;
    const dtSeconds = 86400 * 3;
    const snapshots = makeSnapshots(ONE, ONE + 1n, now, dtSeconds);
    const result = computeApy24hLinear(snapshots, now);
    // dt is approx dtSeconds (t1 = now-1, t0 = now-dtSeconds → dt = dtSeconds - 1)
    expect(result.dt).toBeGreaterThan(dtSeconds - 5);
    expect(result.dt).toBeLessThanOrEqual(dtSeconds);
  });

  it("handles out-of-order snapshots (sorts descending internally)", () => {
    const now = 1_700_000_000;
    const r0 = ONE;
    const r1 = ONE + ONE / 20n; // +5%
    // Pass in ascending order (oldest first)
    const ascending = [
      { rate: r0, timestamp: now - 86400 * 3 },
      { rate: r1, timestamp: now - 1 },
    ];
    const descending = [
      { rate: r1, timestamp: now - 1 },
      { rate: r0, timestamp: now - 86400 * 3 },
    ];
    const r1Asc = computeApy24hLinear(ascending, now);
    const r1Desc = computeApy24hLinear(descending, now);
    expect(r1Asc.apy).toBe(r1Desc.apy);
  });
});

// ---------------------------------------------------------------------------
// computeApy24hLinearCurrentDenom
// ---------------------------------------------------------------------------
describe("computeApy24hLinearCurrentDenom", () => {
  it("returns undefined for empty snapshots", () => {
    const result = computeApy24hLinearCurrentDenom([]);
    expect(result.apy).toBeUndefined();
  });

  it("returns zero when rate is unchanged", () => {
    const now = 1_700_000_000;
    const snapshots = makeSnapshots(ONE, ONE, now);
    const result = computeApy24hLinearCurrentDenom(snapshots, now);
    expect(result.apy).toBe("0");
  });

  it("returns apy as ratio string (e.g. '0.08' means 8%)", () => {
    const now = 1_700_000_000;
    // Same 8% APY scenario but using the current-denom formula
    const SECONDS_IN_YEAR = 31536000;
    const r0 = ONE;
    const r1 = (r0 * 108n) / 100n; // +8%
    const dtSeconds = SECONDS_IN_YEAR;
    const snapshots = [
      { rate: r1, timestamp: now - 1 },
      { rate: r0, timestamp: now - dtSeconds },
    ];
    const result = computeApy24hLinearCurrentDenom(snapshots, now);
    // formula: ((r1-r0) * 1e18 * SECONDS_IN_YEAR) / (dt * r1)
    // ≈ (0.08 * r0 * 1e18 * SECONDS_IN_YEAR) / (SECONDS_IN_YEAR * r1) = 0.08 * r0/r1 ≈ 0.074
    const apyNum = parseFloat(result.apy!);
    // Close to 8% ratio (0.08) but slightly less due to r1 > r0 denominator
    expect(apyNum).toBeGreaterThan(0.07);
    expect(apyNum).toBeLessThan(0.09);
  });

  it("positive apy for rising rate", () => {
    const now = 1_700_000_000;
    const snapshots = makeSnapshots(ONE, ONE + ONE / 10n, now);
    const result = computeApy24hLinearCurrentDenom(snapshots, now);
    expect(parseFloat(result.apy!)).toBeGreaterThan(0);
  });

  it("negative apy for falling rate", () => {
    const now = 1_700_000_000;
    const snapshots = makeSnapshots(ONE + ONE / 10n, ONE, now);
    const result = computeApy24hLinearCurrentDenom(snapshots, now);
    expect(parseFloat(result.apy!)).toBeLessThan(0);
  });

  it("clamps extreme positive apy to MAX_ABS (1e21 = ~1000%)", () => {
    // Both snapshots are within the 3-day cutoff, so the fallback anchor is used
    // producing a very short dt (98s). A 2x rate change over 98s annualizes far
    // beyond MAX_ABS and must be clamped.
    const now = 1_700_000_000;
    const snapshots = [
      { rate: 2n * ONE, timestamp: now - 1 },  // latest
      { rate: ONE,      timestamp: now - 99 }, // anchor (fallback — no snapshot at/before cutoff)
    ];
    const result = computeApy24hLinearCurrentDenom(snapshots, now);
    // Clamped value: MAX_ABS = 1e21 → formatUnits(1e21, 18) = "1000"
    expect(parseFloat(result.apy!)).toBeLessThanOrEqual(1000);
    expect(result.apyScaled).toBe(BigInt("1000000000000000000000")); // MAX_ABS
  });

  it("returns undefined when r1 is zero (guard against division by zero)", () => {
    const now = 1_700_000_000;
    // r1=0 triggers the `r1 <= 0n` guard
    const snapshots = [
      { rate: 0n, timestamp: now - 1 },
      { rate: ONE, timestamp: now - 86400 * 3 },
    ];
    const result = computeApy24hLinearCurrentDenom(snapshots, now);
    expect(result.apy).toBeUndefined();
  });

  it("returns undefined for a single snapshot (no window)", () => {
    const now = 1_700_000_000;
    const result = computeApy24hLinearCurrentDenom(
      [{ rate: ONE, timestamp: now - 1 }],
      now
    );
    expect(result.apy).toBeUndefined();
  });
});
