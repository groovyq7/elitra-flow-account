import { describe, it, expect } from "vitest";
import { getChainConfig, getSupportedTokens, getTargetAddresses } from "@/lib/utils/chains";

// ---------------------------------------------------------------------------
// chains utilities — getChainConfig, getSupportedTokens, getTargetAddresses
// ---------------------------------------------------------------------------

describe("getChainConfig", () => {
  it("returns a config for Citrea testnet (5115)", () => {
    const config = getChainConfig(5115);
    expect(config).toBeDefined();
    expect(config!.id).toBe(5115);
    expect(config!.name).toBeTruthy();
    expect(config!.isTestnet).toBe(true);
  });

  it("returns undefined for an unknown chainId", () => {
    expect(getChainConfig(99999)).toBeUndefined();
    expect(getChainConfig(0)).toBeUndefined();
  });

  it("config includes required shape fields", () => {
    const config = getChainConfig(5115)!;
    expect(typeof config.displayName).toBe("string");
    expect(typeof config.shortName).toBe("string");
    expect(typeof config.delegateContract).toBe("string");
    expect(config.delegateContract.startsWith("0x")).toBe(true);
    expect(Array.isArray(config.rpcUrls)).toBe(true);
    expect(config.rpcUrls.length).toBeGreaterThan(0);
    expect(Array.isArray(config.supportedTokens)).toBe(true);
    expect(config.nativeCurrency).toBeDefined();
    expect(typeof config.nativeCurrency.symbol).toBe("string");
    expect(config.nativeCurrency.decimals).toBe(18);
  });
});

describe("getSupportedTokens", () => {
  it("returns tokens for a configured chain", () => {
    const tokens = getSupportedTokens(5115);
    expect(Array.isArray(tokens)).toBe(true);
    expect(tokens.length).toBeGreaterThan(0);
  });

  it("each token has required fields", () => {
    const tokens = getSupportedTokens(5115);
    for (const t of tokens) {
      expect(typeof t.address).toBe("string");
      expect(t.address.startsWith("0x")).toBe(true);
      expect(typeof t.symbol).toBe("string");
      expect(typeof t.decimals).toBe("number");
    }
  });

  it("returns an empty array for an unknown chain", () => {
    const tokens = getSupportedTokens(99999);
    expect(tokens).toEqual([]);
  });
});

describe("getTargetAddresses", () => {
  it("returns addresses for a mapped spice symbol (CBTC → WBTC)", () => {
    // CBTC maps to WBTC cross-chain symbols. If any chain has WBTC tokens, we get addresses.
    const addrs = getTargetAddresses("CBTC");
    expect(Array.isArray(addrs)).toBe(true);
    // All returned addresses should be lowercase hex strings
    for (const addr of addrs) {
      expect(addr).toMatch(/^0x[0-9a-f]+$/);
    }
  });

  it("returns addresses for WCBTC", () => {
    const addrs = getTargetAddresses("WCBTC");
    expect(Array.isArray(addrs)).toBe(true);
    // WCBTC maps to WCBTC; the Citrea chain has a WCBTC token so at least one address
    expect(addrs.length).toBeGreaterThan(0);
    // Addresses must be lowercase
    for (const addr of addrs) {
      expect(addr).toBe(addr.toLowerCase());
    }
  });

  it("returns an empty array for an unmapped symbol", () => {
    const addrs = getTargetAddresses("NOT_A_REAL_TOKEN");
    expect(addrs).toEqual([]);
  });
});
