import { describe, it, expect } from "vitest";
import { computePositionPnL } from "@/lib/utils/pnl";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
const ONE18 = 1_000_000_000_000_000_000n; // 1e18

// ---------------------------------------------------------------------------
// computePositionPnL
// ---------------------------------------------------------------------------
describe("computePositionPnL", () => {
  it("zero shares → all values zero", () => {
    const result = computePositionPnL({
      shareBalance: 0n,
      rate: ONE18, // 1.0
      costBasis: 0n,
      realizedPnL: 0n,
      assetDecimals: 18,
    });
    expect(result.underlyingValueRaw).toBe(0n);
    expect(result.unrealizedPnLRaw).toBe(0n);
    expect(result.totalPnLRaw).toBe(0n);
    expect(result.underlyingValue).toBe("0");
    expect(result.pnlPctScaled).toBeUndefined(); // costBasis = 0
  });

  it("1:1 rate — shares equal underlying assets", () => {
    // 500 shares at rate 1.0 → 500 underlying
    const shares = 500n * ONE18;
    const result = computePositionPnL({
      shareBalance: shares,
      rate: ONE18,
      costBasis: 500n * ONE18,
      realizedPnL: 0n,
      assetDecimals: 18,
    });
    expect(result.underlyingValueRaw).toBe(500n * ONE18);
    expect(result.underlyingValue).toBe("500");
    expect(result.unrealizedPnLRaw).toBe(0n);
    expect(result.unrealizedPnL).toBe("0");
    expect(result.totalPnL).toBe("0");
  });

  it("rate > 1 — shares are worth more than deposited", () => {
    // 500 shares at rate 1.2 → 600 underlying; cost basis 500 → PnL = +100
    const shares = 500n * ONE18;
    const rate = (12n * ONE18) / 10n; // 1.2e18
    const costBasis = 500n * ONE18;
    const result = computePositionPnL({
      shareBalance: shares,
      rate,
      costBasis,
      realizedPnL: 0n,
      assetDecimals: 18,
    });
    expect(result.underlyingValueRaw).toBe(600n * ONE18);
    expect(result.underlyingValue).toBe("600");
    expect(result.unrealizedPnLRaw).toBe(100n * ONE18);
    expect(result.unrealizedPnL).toBe("100");
    expect(result.totalPnL).toBe("100");
  });

  it("rate < 1 — unrealized PnL is negative", () => {
    // 500 shares at rate 0.9 → 450 underlying; cost basis 500 → PnL = -50
    const shares = 500n * ONE18;
    const rate = (9n * ONE18) / 10n; // 0.9e18
    const costBasis = 500n * ONE18;
    const result = computePositionPnL({
      shareBalance: shares,
      rate,
      costBasis,
      realizedPnL: 0n,
      assetDecimals: 18,
    });
    expect(result.unrealizedPnLRaw).toBe(-50n * ONE18);
    expect(result.unrealizedPnL).toBe("-50");
    expect(result.totalPnL).toBe("-50");
  });

  it("realized PnL is included in totalPnL", () => {
    const shares = 500n * ONE18;
    const rate = ONE18; // 1:1
    const costBasis = 500n * ONE18;
    const realizedPnL = 25n * ONE18; // already realized profit
    const result = computePositionPnL({
      shareBalance: shares,
      rate,
      costBasis,
      realizedPnL,
      assetDecimals: 18,
    });
    expect(result.unrealizedPnLRaw).toBe(0n); // 500 underlying = 500 cost → 0 unrealized
    expect(result.totalPnLRaw).toBe(25n * ONE18); // only realized
    expect(result.totalPnL).toBe("25");
  });

  it("pnlPct is undefined when costBasis is zero", () => {
    const result = computePositionPnL({
      shareBalance: 100n * ONE18,
      rate: ONE18,
      costBasis: 0n,
      realizedPnL: 0n,
      assetDecimals: 18,
    });
    expect(result.pnlPctScaled).toBeUndefined();
    expect(result.pnlPct).toBeUndefined();
  });

  it("pnlPct is a ratio string (e.g. '0.2' = 20%)", () => {
    // 500 shares, rate 1.2, costBasis 500 → PnL = +100, pnlPct = 100/500 = 0.2
    const shares = 500n * ONE18;
    const rate = (12n * ONE18) / 10n;
    const costBasis = 500n * ONE18;
    const result = computePositionPnL({
      shareBalance: shares,
      rate,
      costBasis,
      realizedPnL: 0n,
      assetDecimals: 18,
    });
    expect(result.pnlPct).toBeDefined();
    const pct = parseFloat(result.pnlPct!);
    expect(pct).toBeCloseTo(0.2, 5); // 20% as ratio
  });

  it("works with 6-decimal USDC-like tokens", () => {
    // 1000 USDC deposited, rate 1.05 → 1050 USDC returned
    const USDC_DECIMALS = 6;
    const USDC_UNIT = 10n ** BigInt(USDC_DECIMALS); // 1e6
    const rate = (105n * ONE18) / 100n; // 1.05
    // shares are vault shares (18 decimals), assets are USDC (6 decimals)
    // 1000 shares at 1.05 rate → 1050 raw USDC units
    const shares = 1000n * ONE18;
    const costBasis = 1000n * USDC_UNIT;
    const result = computePositionPnL({
      shareBalance: shares,
      rate,
      costBasis,
      realizedPnL: 0n,
      assetDecimals: USDC_DECIMALS,
    });
    // underlyingValueRaw = 1000 * 1.05 * 1e18 / 1e18 = 1050 (but in 18-decimal units!)
    // NOTE: rate is 1e18-scaled; result is in 18-decimal raw units regardless of assetDecimals
    // The assetDecimals only affects the *formatted* string output
    expect(result.underlyingValueRaw).toBe((1050n * ONE18) / 1n);
    // With assetDecimals=6, the formatted value will show 1050 / 1e6 = 1050000000000 in string
    // The raw value is in 18-decimal units (vault share math is always 18 decimals)
  });

  it("negative realized PnL reduces totalPnL", () => {
    const shares = 500n * ONE18;
    const rate = ONE18;
    const costBasis = 500n * ONE18;
    const realizedPnL = -10n * ONE18; // realized loss
    const result = computePositionPnL({
      shareBalance: shares,
      rate,
      costBasis,
      realizedPnL,
      assetDecimals: 18,
    });
    expect(result.totalPnLRaw).toBe(-10n * ONE18);
    expect(result.totalPnL).toBe("-10");
  });

  it("costBasis formatted string matches expected", () => {
    const result = computePositionPnL({
      shareBalance: 0n,
      rate: ONE18,
      costBasis: 250n * ONE18,
      realizedPnL: 0n,
      assetDecimals: 18,
    });
    expect(result.costBasis).toBe("250");
  });

  it("realizedPnL formatted string matches expected", () => {
    const result = computePositionPnL({
      shareBalance: 0n,
      rate: ONE18,
      costBasis: 0n,
      realizedPnL: 50n * ONE18,
      assetDecimals: 18,
    });
    expect(result.realizedPnL).toBe("50");
  });
});
