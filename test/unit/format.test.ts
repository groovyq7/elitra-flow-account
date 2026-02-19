import { describe, it, expect } from "vitest";
import {
  formatTokenAmount,
  formatAPY,
  formatCurrency,
  formatPrice,
  formatTVL,
  formatPercentage,
  formatSharePrice,
  shortenAddress,
  abbreviateNumber,
  toFixedDown,
} from "@/lib/utils/format";

// ---------------------------------------------------------------------------
// formatTokenAmount
// ---------------------------------------------------------------------------
describe("formatTokenAmount", () => {
  it("returns '0' for zero", () => {
    expect(formatTokenAmount(0)).toBe("0");
    expect(formatTokenAmount(BigInt(0))).toBe("0");
  });

  it("returns '0' for NaN input", () => {
    expect(formatTokenAmount(NaN)).toBe("0");
  });

  it("returns '0' for Infinity", () => {
    expect(formatTokenAmount(Infinity)).toBe("0");
    expect(formatTokenAmount(-Infinity)).toBe("0");
  });

  it("formats a regular number", () => {
    expect(formatTokenAmount(1.5)).toBe("1.5");
  });

  it("formats a bigint with default 18 decimals", () => {
    // 1.5 * 10^18
    const val = BigInt("1500000000000000000");
    expect(formatTokenAmount(val)).toBe("1.5");
  });

  it("returns '<0.000001' for very small numbers", () => {
    expect(formatTokenAmount(0.0000001)).toBe("<0.000001");
  });

  it("handles string input", () => {
    expect(formatTokenAmount("42.123")).toBe("42.123");
  });

  it("formats large numbers with commas", () => {
    expect(formatTokenAmount(1234567)).toBe("1,234,567");
  });

  it("handles negative numbers", () => {
    // Negative: not < 0.000001, not 0, not NaN — goes to formatter
    const result = formatTokenAmount(-5);
    expect(result).toBe("-5");
  });
});

// ---------------------------------------------------------------------------
// formatAPY
// ---------------------------------------------------------------------------
describe("formatAPY", () => {
  it("formats a number as percentage", () => {
    expect(formatAPY(12.345)).toBe("12.35%");
  });

  it("returns '0.00%' for zero", () => {
    expect(formatAPY(0)).toBe("0.00%");
  });

  it("returns '0.00%' for NaN", () => {
    expect(formatAPY(NaN)).toBe("0.00%");
  });

  it("returns '0.00%' for Infinity", () => {
    expect(formatAPY(Infinity)).toBe("0.00%");
  });

  it("handles string input", () => {
    expect(formatAPY("7.5")).toBe("7.50%");
  });

  it("handles negative APY", () => {
    expect(formatAPY(-3.14)).toBe("-3.14%");
  });
});

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------
describe("formatCurrency", () => {
  it("returns '$0.00' for zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("returns '$0.00' for NaN", () => {
    expect(formatCurrency(NaN)).toBe("$0.00");
  });

  it("returns '$0.00' for undefined-like string", () => {
    expect(formatCurrency("")).toBe("$0.00");
    expect(formatCurrency("abc")).toBe("$0.00");
  });

  it("returns '$0.00' for Infinity", () => {
    expect(formatCurrency(Infinity)).toBe("$0.00");
  });

  it("formats small amounts with USD style", () => {
    const result = formatCurrency(42.5);
    expect(result).toBe("$42.50");
  });

  it("abbreviates thousands", () => {
    expect(formatCurrency(1500)).toBe("$1.50K");
  });

  it("abbreviates millions", () => {
    expect(formatCurrency(2500000)).toBe("$2.50M");
  });

  it("abbreviates billions", () => {
    expect(formatCurrency(3000000000)).toBe("$3.00B");
  });

  it("handles string input", () => {
    expect(formatCurrency("99.99")).toBe("$99.99");
  });

  it("returns '$0.00' for negative zero-ish amounts", () => {
    // !numericAmount is truthy for 0 → returns $0.00
    expect(formatCurrency(0)).toBe("$0.00");
  });
});

// ---------------------------------------------------------------------------
// formatPrice
// ---------------------------------------------------------------------------
describe("formatPrice", () => {
  it("returns '0' for undefined", () => {
    expect(formatPrice(undefined)).toBe("0");
  });

  it("returns '0' for NaN string", () => {
    expect(formatPrice("not a number")).toBe("0");
  });

  it("returns '0' for zero", () => {
    expect(formatPrice(0)).toBe("0");
    expect(formatPrice("0")).toBe("0");
  });

  it("formats a regular number (1-999)", () => {
    const result = formatPrice(42.567);
    expect(result).toBe("42.56");
  });

  it("abbreviates thousands", () => {
    // toFixedDown(1.5, 2) = "1.50", regex only strips ".00" not ".50"
    expect(formatPrice(1500)).toBe("1.50K");
  });

  it("abbreviates millions", () => {
    expect(formatPrice(2500000)).toBe("2.50M");
  });

  it("abbreviates billions", () => {
    expect(formatPrice(3000000000)).toBe("3B");
  });

  it("does not abbreviate when shouldAbbreviate is false", () => {
    const result = formatPrice(1500, 2, false);
    expect(result).toBe("1500");
  });

  it("handles very small decimals with subscript notation", () => {
    // 0.00000123 → should use subscript notation
    const result = formatPrice(0.00000123);
    expect(result).toContain("0.0");
    // Should not crash and should return a string
    expect(typeof result).toBe("string");
  });

  it("handles negative numbers < 1", () => {
    const result = formatPrice(-0.5);
    expect(typeof result).toBe("string");
    expect(result).not.toBe("0"); // -0.5 is not 0
  });

  it("rounds down by default (canRoundUp=false)", () => {
    const result = formatPrice(42.999, 2, true, false);
    expect(result).toBe("42.99"); // floor, not 43.00
  });

  it("rounds up when canRoundUp=true", () => {
    const result = formatPrice(42.999, 2, true, true);
    expect(result).toBe("43");
  });
});

// ---------------------------------------------------------------------------
// formatTVL
// ---------------------------------------------------------------------------
describe("formatTVL", () => {
  it("returns '$0.00' for zero", () => {
    expect(formatTVL(0)).toBe("$0.00");
  });

  it("returns '$0.00' for falsy input", () => {
    // !tvl is true for 0
    expect(formatTVL(0)).toBe("$0.00");
  });

  it("formats thousands", () => {
    expect(formatTVL(1500)).toBe("$1.50K");
  });

  it("formats millions", () => {
    expect(formatTVL(2500000)).toBe("$2.50M");
  });

  it("formats billions", () => {
    expect(formatTVL(3000000000)).toBe("$3.00B");
  });

  it("formats small amounts", () => {
    expect(formatTVL(42.5)).toBe("$42.50");
  });
});

// ---------------------------------------------------------------------------
// formatPercentage
// ---------------------------------------------------------------------------
describe("formatPercentage", () => {
  it("formats a number", () => {
    expect(formatPercentage(12.345)).toBe("12.35%");
  });

  it("returns '0.00%' for NaN", () => {
    expect(formatPercentage(NaN)).toBe("0.00%");
  });

  it("handles string input", () => {
    expect(formatPercentage("7.5")).toBe("7.50%");
  });
});

// ---------------------------------------------------------------------------
// formatSharePrice
// ---------------------------------------------------------------------------
describe("formatSharePrice", () => {
  it("formats to 6 decimal places", () => {
    expect(formatSharePrice(1.123456789)).toBe("1.123457");
  });

  it("returns '0.000000' for NaN", () => {
    expect(formatSharePrice(NaN)).toBe("0.000000");
  });

  it("returns '0.000000' for Infinity", () => {
    expect(formatSharePrice(Infinity)).toBe("0.000000");
  });
});

// ---------------------------------------------------------------------------
// shortenAddress
// ---------------------------------------------------------------------------
describe("shortenAddress", () => {
  it("shortens a valid address", () => {
    expect(shortenAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe(
      "0x1234...5678"
    );
  });

  it("returns empty string for empty input", () => {
    expect(shortenAddress("")).toBe("");
  });

  it("respects custom chars param", () => {
    expect(shortenAddress("0x1234567890abcdef1234567890abcdef12345678", 6)).toBe(
      "0x123456...345678"
    );
  });
});

// ---------------------------------------------------------------------------
// abbreviateNumber
// ---------------------------------------------------------------------------
describe("abbreviateNumber", () => {
  it("returns '0' for undefined", () => {
    expect(abbreviateNumber(undefined)).toBe("0");
  });

  it("returns '0' for zero", () => {
    // !0 is true → returns "0"
    expect(abbreviateNumber(0)).toBe("0");
  });

  it("abbreviates thousands", () => {
    expect(abbreviateNumber(1500)).toBe("1.50K");
  });

  it("abbreviates millions", () => {
    expect(abbreviateNumber(2500000)).toBe("2.50M");
  });

  it("abbreviates billions", () => {
    const result = abbreviateNumber(3000000000);
    expect(result).toContain("B");
  });

  it("formats small numbers with decimal places", () => {
    expect(abbreviateNumber(42)).toBe("42.00");
  });

  it("handles string input", () => {
    expect(abbreviateNumber("1500")).toBe("1.50K");
  });
});

// ---------------------------------------------------------------------------
// toFixedDown
// ---------------------------------------------------------------------------
describe("toFixedDown", () => {
  it("floors to given digits", () => {
    expect(toFixedDown(42.999, 2)).toBe("42.99");
  });

  it("handles zero", () => {
    expect(toFixedDown(0, 2)).toBe("0.00");
  });

  it("handles exact values", () => {
    expect(toFixedDown(1.5, 1)).toBe("1.5");
  });
});
