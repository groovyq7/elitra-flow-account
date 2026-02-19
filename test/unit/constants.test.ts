import { describe, it, expect } from "vitest";
import { getAddresses } from "@/lib/constants";

// ---------------------------------------------------------------------------
// getAddresses — lib/constants.ts
// ---------------------------------------------------------------------------
// Tests the multi-symbol vault address lookup, backward compatibility path,
// and unknown-chain / unknown-symbol handling.

describe("getAddresses", () => {
  it("returns addresses for a known chainId + symbol", () => {
    const addrs = getAddresses(1329, "SEI");
    expect(addrs).toBeDefined();
    expect(addrs!.vaultAddress).toBeTruthy();
    expect(addrs!.tellerAddress).toBeTruthy();
    expect(addrs!.accountantAddress).toBeTruthy();
  });

  it("is case-insensitive for the symbol", () => {
    const lower = getAddresses(1329, "sei");
    const upper = getAddresses(1329, "SEI");
    expect(lower).toEqual(upper);
  });

  it("returns the first symbol entry when no symbol is provided (backward compat)", () => {
    const defaultAddrs = getAddresses(1329);
    expect(defaultAddrs).toBeDefined();
    // Should equal the SEI entry (first key defined for chain 1329)
    const seiAddrs = getAddresses(1329, "SEI");
    expect(defaultAddrs!.vaultAddress).toBe(seiAddrs!.vaultAddress);
  });

  it("returns undefined for an unknown chainId", () => {
    expect(getAddresses(99999)).toBeUndefined();
    expect(getAddresses(99999, "ETH")).toBeUndefined();
  });

  it("returns undefined for an unknown symbol on a known chain", () => {
    expect(getAddresses(1329, "UNKNOWN_TOKEN")).toBeUndefined();
  });

  it("returns addresses for Citrea testnet CBTC vault", () => {
    const addrs = getAddresses(5115, "CBTC");
    expect(addrs).toBeDefined();
    expect(addrs!.vaultAddress.startsWith("0x")).toBe(true);
  });

  it("returns addresses for Citrea testnet NUSD vault", () => {
    const addrs = getAddresses(5115, "NUSD");
    expect(addrs).toBeDefined();
    expect(addrs!.vaultAddress.startsWith("0x")).toBe(true);
    // NUSD and CBTC have different vault addresses
    const cbtcAddrs = getAddresses(5115, "CBTC");
    expect(addrs!.vaultAddress.toLowerCase()).not.toBe(cbtcAddrs!.vaultAddress.toLowerCase());
  });

  it("ECBTC entry matches CBTC (share token aliases same contracts)", () => {
    const cbtc = getAddresses(5115, "CBTC");
    const ecbtc = getAddresses(5115, "ECBTC");
    expect(cbtc).toBeDefined();
    expect(ecbtc).toBeDefined();
    expect(ecbtc!.vaultAddress).toBe(cbtc!.vaultAddress);
  });
});
