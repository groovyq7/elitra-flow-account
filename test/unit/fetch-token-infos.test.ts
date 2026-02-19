import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchTokenInfos, mergeTokenInfos } from "@/lib/fetchTokenInfos";
import type { TokenType } from "@/lib/types";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/utils/get-token-balance", () => ({
  getTokenBalance: vi.fn(),
  getTokenPrice: vi.fn(),
  getVaultRate: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  getTokenImage: vi.fn((symbol: string) => `/icons/${symbol.toLowerCase()}.png`),
}));

vi.mock("@/lib/contracts/vault-registry", () => ({
  VAULTS: {
    5115: [
      {
        id: "0xvault1",
        token0: { address: "0xtoken1", symbol: "CBTC" },
        apy: 8,
      },
    ],
  },
}));

import {
  getTokenBalance,
  getTokenPrice,
  getVaultRate,
} from "@/lib/utils/get-token-balance";

const mockGetTokenBalance = vi.mocked(getTokenBalance);
const mockGetTokenPrice = vi.mocked(getTokenPrice);
const mockGetVaultRate = vi.mocked(getVaultRate);

// Minimal viem-shaped chain
const mockChain = {
  id: 5115,
  name: "Citrea",
  rpcUrls: { default: { http: ["https://rpc.citrea.test"] } },
} as never;

const makeToken = (symbol: string, address: string): TokenType => ({
  symbol,
  address,
  decimals: 18,
  name: symbol,
});

// ── fetchTokenInfos ───────────────────────────────────────────────────────────

describe("fetchTokenInfos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTokenBalance.mockResolvedValue({
      balance: BigInt(1e18),
      decimals: 18,
      formatted: "1",
    });
    // getTokenPrice returns { price, error, cached, stale? }
    mockGetTokenPrice.mockResolvedValue({ price: 60000, error: false, cached: false });
    // getVaultRate returns { rate: string (from formatUnits), rateRaw, cached }
    mockGetVaultRate.mockResolvedValue({ rate: "1", rateRaw: BigInt(1e18), cached: false });
  });

  // ── Empty token list ────────────────────────────────────────────────────────

  it("returns an empty array when tokens list is empty", async () => {
    const result = await fetchTokenInfos([], "0xuser", mockChain);
    expect(result).toHaveLength(0);
  });

  // ── Successful fetch ────────────────────────────────────────────────────────

  it("returns correct structure for a successful fetch", async () => {
    const tokens = [makeToken("CBTC", "0xtoken1")];
    const result = await fetchTokenInfos(tokens, "0xuser", mockChain);
    expect(result).toHaveLength(1);
    const token = result[0];
    expect(token.symbol).toBe("CBTC");
    expect(token.available).toBe(1);
    expect(token.price).toBe(60000);
    expect(token.availableUSD).toBe(60000);
    expect(token.icon).toMatch(/cbtc/);
    expect(typeof token.apy).toBe("number");
    expect(typeof token.yearlyReward).toBe("number");
    expect(typeof token.yearlyRewardUSD).toBe("number");
    expect(token.token).toEqual(tokens[0]);
  });

  it("computes availableUSD as available * price", async () => {
    mockGetTokenBalance.mockResolvedValue({ balance: BigInt(2e18), decimals: 18, formatted: "2" });
    mockGetTokenPrice.mockResolvedValue({ price: 50000, error: false, cached: false });
    const result = await fetchTokenInfos([makeToken("CBTC", "0xtoken1")], "0xuser", mockChain);
    expect(result[0].available).toBe(2);
    expect(result[0].price).toBe(50000);
    expect(result[0].availableUSD).toBeCloseTo(100000);
  });

  it("computes yearlyReward as available * apy / 100", async () => {
    mockGetTokenBalance.mockResolvedValue({ balance: BigInt(1e18), decimals: 18, formatted: "1" });
    mockGetTokenPrice.mockResolvedValue({ price: 100, error: false, cached: false });
    // APY from vault registry for 0xtoken1 is 8
    const result = await fetchTokenInfos([makeToken("CBTC", "0xtoken1")], "0xuser", mockChain);
    expect(result[0].yearlyReward).toBeCloseTo(1 * 8 / 100);
    expect(result[0].yearlyRewardUSD).toBeCloseTo(1 * 8 / 100 * 100);
  });

  // ── Error isolation ─────────────────────────────────────────────────────────

  it("an error in one token does not prevent others from loading", async () => {
    const tokens = [
      makeToken("FAIL", "0xfail"),
      makeToken("CBTC", "0xtoken1"),
      makeToken("FAIL2", "0xfail2"),
    ];
    mockGetTokenBalance
      .mockRejectedValueOnce(new Error("RPC timeout"))   // FAIL fails
      .mockResolvedValueOnce({ balance: BigInt(1e18), decimals: 18, formatted: "1" }) // CBTC succeeds
      .mockRejectedValueOnce(new Error("Network error")); // FAIL2 fails

    const result = await fetchTokenInfos(tokens, "0xuser", mockChain);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe("CBTC");
  });

  it("returns empty array when all tokens fail", async () => {
    const tokens = [makeToken("T1", "0xa"), makeToken("T2", "0xb")];
    mockGetTokenBalance.mockRejectedValue(new Error("All failed"));
    const result = await fetchTokenInfos(tokens, "0xuser", mockChain);
    expect(result).toHaveLength(0);
  });

  it("does not throw when a single token fails", async () => {
    const tokens = [makeToken("BAD", "0xbad")];
    mockGetTokenBalance.mockRejectedValue(new Error("fail"));
    await expect(fetchTokenInfos(tokens, "0xuser", mockChain)).resolves.toEqual([]);
  });

  // ── eXxx vault tokens (price computation) ─────────────────────────────────

  it("uses vault rate for tokens starting with 'e' (vault share tokens)", async () => {
    mockGetTokenBalance.mockResolvedValue({ balance: BigInt(1e18), decimals: 18, formatted: "1" });
    mockGetTokenPrice.mockResolvedValue({ price: 60000, error: false, cached: false });
    // rate is a string from formatUnits, fetchTokenInfos uses Number(ratio.rate)
    mockGetVaultRate.mockResolvedValue({ rate: "1.05", rateRaw: BigInt(105e16), cached: false });

    // "eCBTC" starts with 'e', so price = underlying price * vault rate
    const result = await fetchTokenInfos([makeToken("eCBTC", "0xecbtc")], "0xuser", mockChain);
    expect(result).toHaveLength(1);
    // getTokenPrice is called with "CBTC" (strips leading 'e' and uppercases)
    expect(mockGetTokenPrice).toHaveBeenCalledWith("CBTC");
    expect(result[0].price).toBeCloseTo(60000 * 1.05);
  });

  // ── undefined address ───────────────────────────────────────────────────────

  it("handles undefined user address gracefully", async () => {
    mockGetTokenBalance.mockResolvedValue({ balance: BigInt(0), decimals: 18, formatted: "0" });
    const result = await fetchTokenInfos(
      [makeToken("CBTC", "0xtoken1")],
      undefined,
      mockChain
    );
    expect(result).toHaveLength(1);
    expect(result[0].available).toBe(0);
  });
});

// ── mergeTokenInfos ───────────────────────────────────────────────────────────

describe("mergeTokenInfos", () => {
  const makeTokenInfo = (symbol: string, available: number, apy = 5) => ({
    symbol,
    token: makeToken(symbol, `0x${symbol}`),
    icon: `/icons/${symbol}.png`,
    available,
    availableUSD: available * 100,
    apy,
    yearlyReward: (available * apy) / 100,
    yearlyRewardUSD: (available * apy * 100) / 100,
    price: 100,
  });

  it("returns external tokens when embedded is empty", () => {
    const ext = [makeTokenInfo("CBTC", 1)];
    const result = mergeTokenInfos(ext, []);
    expect(result).toHaveLength(1);
    expect(result[0].available).toBe(1);
  });

  it("returns embedded tokens when external is empty", () => {
    const emb = [makeTokenInfo("CBTC", 2)];
    const result = mergeTokenInfos([], emb);
    expect(result).toHaveLength(1);
    expect(result[0].available).toBe(2);
  });

  it("merges matching symbols by summing balances", () => {
    const ext = [makeTokenInfo("CBTC", 1)];
    const emb = [makeTokenInfo("CBTC", 0.5)];
    const result = mergeTokenInfos(ext, emb);
    expect(result).toHaveLength(1);
    expect(result[0].available).toBeCloseTo(1.5);
    expect(result[0].availableUSD).toBeCloseTo(150);
  });

  it("keeps separate entries for different symbols", () => {
    const ext = [makeTokenInfo("CBTC", 1)];
    const emb = [makeTokenInfo("USDT", 100)];
    const result = mergeTokenInfos(ext, emb);
    expect(result).toHaveLength(2);
    const symbols = result.map((r) => r.symbol);
    expect(symbols).toContain("CBTC");
    expect(symbols).toContain("USDT");
  });

  it("sums yearlyReward and yearlyRewardUSD for matching tokens", () => {
    const ext = [makeTokenInfo("CBTC", 1, 10)]; // 10% APY on 1 CBTC
    const emb = [makeTokenInfo("CBTC", 1, 10)]; // 10% APY on 1 CBTC
    const result = mergeTokenInfos(ext, emb);
    expect(result[0].yearlyReward).toBeCloseTo(0.2); // 1*10/100 + 1*10/100
  });

  it("returns empty array when both inputs are empty", () => {
    expect(mergeTokenInfos([], [])).toHaveLength(0);
  });

  it("does not mutate the original external array entries", () => {
    const ext = [makeTokenInfo("CBTC", 1)];
    const emb = [makeTokenInfo("CBTC", 2)];
    const original = ext[0].available;
    mergeTokenInfos(ext, emb);
    expect(ext[0].available).toBe(original);
  });
});
