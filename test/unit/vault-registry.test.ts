import { describe, it, expect } from "vitest";
import {
  getVaultsByChain,
  getVaultById,
  getAllVaults,
  getChainMetadata,
  VAULTS,
} from "@/lib/contracts/vault-registry";

// ---------------------------------------------------------------------------
// vault-registry — getVaultsByChain, getVaultById, getAllVaults, getChainMetadata
// ---------------------------------------------------------------------------

describe("getVaultsByChain", () => {
  it("returns an array for a known chainId", () => {
    // Chain 5115 = Citrea testnet (always defined in VAULTS)
    const vaults = getVaultsByChain(5115);
    expect(Array.isArray(vaults)).toBe(true);
    expect(vaults.length).toBeGreaterThan(0);
  });

  it("returns an empty array for an unknown chainId", () => {
    const vaults = getVaultsByChain(99999);
    expect(vaults).toEqual([]);
  });

  it("each vault has required fields", () => {
    const vaults = getVaultsByChain(5115);
    for (const v of vaults) {
      expect(typeof v.id).toBe("string");
      expect(typeof v.name).toBe("string");
      expect(typeof v.symbol).toBe("string");
      expect(typeof v.decimals).toBe("number");
      expect(v.token0).toBeDefined();
      expect(typeof v.token0.address).toBe("string");
    }
  });
});

describe("getVaultById", () => {
  it("finds a vault by its id on the correct chain", () => {
    const chainVaults = getVaultsByChain(5115);
    const target = chainVaults[0];
    const found = getVaultById(target.id, 5115);
    expect(found).toBeDefined();
    expect(found!.id.toLowerCase()).toBe(target.id.toLowerCase());
  });

  it("is case-insensitive for the vault id", () => {
    const chainVaults = getVaultsByChain(5115);
    const target = chainVaults[0];
    const upperFound = getVaultById(target.id.toUpperCase(), 5115);
    const lowerFound = getVaultById(target.id.toLowerCase(), 5115);
    expect(upperFound?.id.toLowerCase()).toBe(target.id.toLowerCase());
    expect(lowerFound?.id.toLowerCase()).toBe(target.id.toLowerCase());
  });

  it("returns undefined for a non-existent vault id on a known chain", () => {
    const result = getVaultById("0x0000000000000000000000000000000000000001", 5115);
    expect(result).toBeUndefined();
  });

  it("falls back to the global VAULTS registry for cross-chain lookup", () => {
    // Pick a vault from a different chain (e.g. SEI Mainnet = 1329)
    const seiVaults = VAULTS[1329];
    if (!seiVaults || seiVaults.length === 0) return; // skip if SEI not configured
    const seiVault = seiVaults[0];
    // Query with the wrong chainId — should still find via the global fallback
    const found = getVaultById(seiVault.id, 99999);
    expect(found).toBeDefined();
    expect(found!.id.toLowerCase()).toBe(seiVault.id.toLowerCase());
  });
});

describe("getAllVaults", () => {
  it("returns an array of {chainId, vaults} objects", () => {
    const all = getAllVaults();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);
    for (const entry of all) {
      expect(typeof entry.chainId).toBe("number");
      expect(Array.isArray(entry.vaults)).toBe(true);
    }
  });

  it("includes all chains defined in VAULTS", () => {
    const all = getAllVaults();
    const chainIds = all.map((e) => e.chainId);
    for (const chainId of Object.keys(VAULTS)) {
      expect(chainIds).toContain(Number(chainId));
    }
  });
});

describe("getChainMetadata", () => {
  it("returns metadata for a known chain", () => {
    const meta = getChainMetadata(1329);
    expect(meta).toBeDefined();
    expect(typeof meta.name).toBe("string");
    expect(typeof meta.shortName).toBe("string");
    expect(typeof meta.icon).toBe("string");
    expect(typeof meta.blockExplorer).toBe("string");
  });

  it("returns undefined for an unknown chain", () => {
    const meta = getChainMetadata(99999);
    expect(meta).toBeUndefined();
  });
});
