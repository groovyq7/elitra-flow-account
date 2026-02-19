import { describe, it, expect } from "vitest";
import {
  generateCurvedChartData,
  generateRealisticChartData,
  generateHoldingComparisonData,
} from "@/lib/utils/chart-data";

// ── generateCurvedChartData ──────────────────────────────────────────────────

describe("generateCurvedChartData", () => {
  it("returns the correct number of data points", () => {
    const data = generateCurvedChartData("2025-01-01", 10, 1000, 10, "weekly");
    expect(data).toHaveLength(10);
  });

  it("returns an empty array when points = 0", () => {
    const data = generateCurvedChartData("2025-01-01", 0, 1000, 10, "weekly");
    expect(data).toHaveLength(0);
  });

  it("returns a single data point when points = 1", () => {
    const data = generateCurvedChartData("2025-01-01", 1, 1000, 10, "weekly");
    expect(data).toHaveLength(1);
    expect(data[0].value).toBe(1000);
  });

  it("first data point equals the initial balance", () => {
    const data = generateCurvedChartData("2025-06-01", 5, 5000, 20, "weekly");
    expect(data[0].value).toBe(5000);
  });

  it("balance grows over time (not flat)", () => {
    const data = generateCurvedChartData("2025-01-01", 12, 1000, 10, "weekly");
    expect(data[data.length - 1].value).toBeGreaterThan(data[0].value);
  });

  it("each date is 7 days apart for weekly timeframe", () => {
    const data = generateCurvedChartData("2025-01-01", 3, 1000, 10, "weekly");
    const d0 = new Date(data[0].date).getTime();
    const d1 = new Date(data[1].date).getTime();
    const d2 = new Date(data[2].date).getTime();
    expect(d1 - d0).toBe(7 * 24 * 60 * 60 * 1000);
    expect(d2 - d1).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("each date is roughly one month apart for monthly timeframe", () => {
    const data = generateCurvedChartData("2025-01-01", 3, 1000, 10, "monthly");
    expect(data[0].date).toBe("2025-01-01");
    expect(data[1].date).toBe("2025-02-01");
    expect(data[2].date).toBe("2025-03-01");
  });

  it("dates are ISO date strings (YYYY-MM-DD)", () => {
    const data = generateCurvedChartData("2025-03-15", 3, 1000, 5, "weekly");
    for (const point of data) {
      expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("returns zeroed values when initialBalance is 0", () => {
    const data = generateCurvedChartData("2025-01-01", 5, 0, 10, "weekly");
    for (const point of data) {
      expect(point.value).toBe(0);
    }
  });

  it("returns flat values when apy is 0", () => {
    const data = generateCurvedChartData("2025-01-01", 5, 1000, 0, "weekly");
    for (const point of data) {
      expect(point.value).toBe(1000);
    }
  });

  it("values are rounded to 2 decimal places", () => {
    const data = generateCurvedChartData("2025-01-01", 5, 999.999, 7, "weekly");
    for (const point of data) {
      const decimalStr = point.value.toString().split(".")[1] ?? "";
      expect(decimalStr.length).toBeLessThanOrEqual(2);
    }
  });

  it("does not produce NaN or Infinity with very high APY (1000%)", () => {
    const data = generateCurvedChartData("2025-01-01", 12, 1000, 1000, "weekly");
    expect(data).toHaveLength(12);
    for (const point of data) {
      expect(Number.isNaN(point.value)).toBe(false);
      expect(Number.isFinite(point.value)).toBe(true);
      expect(point.value).toBeGreaterThanOrEqual(0);
    }
  });

  it("balance decreases with negative APY (deflation scenario)", () => {
    const data = generateCurvedChartData("2025-01-01", 6, 1000, -20, "weekly");
    expect(data).toHaveLength(6);
    // First point should be the initial balance
    expect(data[0].value).toBe(1000);
    // With negative APY the balance should fall below the starting value
    expect(data[data.length - 1].value).toBeLessThan(data[0].value);
  });

  it("does not produce NaN with negative APY", () => {
    const data = generateCurvedChartData("2025-01-01", 8, 1000, -50, "monthly");
    for (const point of data) {
      expect(Number.isNaN(point.value)).toBe(false);
    }
  });

  it("growth accelerates (each increment is larger than the previous)", () => {
    const data = generateCurvedChartData("2025-01-01", 5, 10000, 50, "weekly");
    const increments = data.slice(1).map((p, i) => p.value - data[i].value);
    // With growth acceleration, each increment should be >= the previous
    for (let i = 1; i < increments.length; i++) {
      expect(increments[i]).toBeGreaterThanOrEqual(increments[i - 1] - 0.01);
    }
  });
});

// ── generateRealisticChartData ───────────────────────────────────────────────

describe("generateRealisticChartData", () => {
  it("returns the correct number of data points", () => {
    const data = generateRealisticChartData("2025-01-01", 8, 1000, 12, "weekly");
    expect(data).toHaveLength(8);
  });

  it("first data point equals the initial balance", () => {
    const data = generateRealisticChartData("2025-01-01", 4, 2000, 15, "monthly");
    expect(data[0].value).toBe(2000);
  });

  it("balance grows over time with positive APY", () => {
    const data = generateRealisticChartData("2025-01-01", 12, 1000, 10, "weekly");
    expect(data[data.length - 1].value).toBeGreaterThan(data[0].value);
  });

  it("returns flat line when apy is 0", () => {
    const data = generateRealisticChartData("2025-01-01", 5, 500, 0, "weekly");
    for (const point of data) {
      expect(point.value).toBe(500);
    }
  });

  it("does NOT accelerate (constant growth rate, unlike curved)", () => {
    const data = generateRealisticChartData("2025-01-01", 6, 10000, 50, "weekly");
    const increments = data.slice(1).map((p, i) => p.value - data[i].value);
    // Realistic growth compounds at a fixed rate; increments grow only due to
    // compounding (slightly), NOT due to an explicit acceleration factor.
    // The ratio between consecutive increments should be nearly constant.
    const ratios = increments.slice(1).map((inc, i) => inc / increments[i]);
    for (const ratio of ratios) {
      // Each ratio should be close to (1 + growthRate), not exponentially larger
      expect(ratio).toBeLessThan(1.1);
    }
  });
});

// ── generateHoldingComparisonData ───────────────────────────────────────────

describe("generateHoldingComparisonData", () => {
  it("returns an array of the same length as the input", () => {
    const chart = generateRealisticChartData("2025-01-01", 10, 1000, 5, "weekly");
    const holding = generateHoldingComparisonData(chart, 1000);
    expect(holding).toHaveLength(10);
  });

  it("all holding values equal the initial balance (flat line)", () => {
    const chart = generateRealisticChartData("2025-01-01", 6, 2500, 20, "weekly");
    const holding = generateHoldingComparisonData(chart, 2500);
    for (const point of holding) {
      expect(point.value).toBe(2500);
    }
  });

  it("preserves the dates from the input chart data", () => {
    const chart = generateRealisticChartData("2025-01-01", 4, 1000, 10, "monthly");
    const holding = generateHoldingComparisonData(chart, 1000);
    for (let i = 0; i < chart.length; i++) {
      expect(holding[i].date).toBe(chart[i].date);
    }
  });

  it("returns an empty array when passed an empty chart", () => {
    const holding = generateHoldingComparisonData([], 1000);
    expect(holding).toHaveLength(0);
  });

  it("uses the provided initialBalance, not the first chart value", () => {
    const chart = [{ date: "2025-01-01", value: 999 }];
    const holding = generateHoldingComparisonData(chart, 1234);
    expect(holding[0].value).toBe(1234);
  });
});
