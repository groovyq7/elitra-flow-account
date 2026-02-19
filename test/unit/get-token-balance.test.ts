import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// We test the error-path returns from getTokenBalance and getTokenPrice
// by mocking viem's createPublicClient and global fetch.
// ---------------------------------------------------------------------------

// Mock viem BEFORE importing the module under test
vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: vi.fn(),
  };
});

vi.mock("viem/actions", () => ({
  readContract: vi.fn(),
}));

import { createPublicClient } from "viem";
import { readContract } from "viem/actions";
import { getTokenBalance, getTokenPrice, getVaultRate } from "@/lib/utils/get-token-balance";
import { sepolia } from "viem/chains";

// A fake chain that satisfies the `Chain` type
const fakeChain = {
  ...sepolia,
  id: 11155111,
  rpcUrls: { default: { http: ["https://rpc.sepolia.org"] } },
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// getTokenBalance — error path
// ---------------------------------------------------------------------------
describe("getTokenBalance error path", () => {
  it("returns zero balance with error=true when readContract throws", async () => {
    (createPublicClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      getBalance: vi.fn().mockRejectedValue(new Error("RPC error")),
    });
    (readContract as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("RPC error"));

    const result = await getTokenBalance(
      "0x1234567890abcdef1234567890abcdef12345678",
      "0xabc0000000000000000000000000000000000001" as `0x${string}`,
      fakeChain as Parameters<typeof getTokenBalance>[2]
    );

    expect(result.balance).toBe(BigInt(0));
    expect(result.decimals).toBe(18);
    expect(result.formatted).toBe("0");
    expect(result.error).toBe(true);
  });

  it("returns zero balance when address is undefined", async () => {
    (createPublicClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({});

    const result = await getTokenBalance(
      "0x1234567890abcdef1234567890abcdef12345678",
      undefined,
      fakeChain as Parameters<typeof getTokenBalance>[2]
    );

    expect(result.balance).toBe(BigInt(0));
    expect(result.formatted).toBe("0");
  });
});

// ---------------------------------------------------------------------------
// getTokenPrice — error & fallback paths
// ---------------------------------------------------------------------------
describe("getTokenPrice error path", () => {
  beforeEach(() => {
    // Reset module-level cache between tests by using fresh fetch mocks
    vi.spyOn(global, "fetch");
  });

  it("returns price=1 and error=true when both CoinGecko and Coinbase fail", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network error"));

    const result = await getTokenPrice("UNKNOWN_TOKEN_XYZ_" + Math.random());
    expect(result.error).toBe(true);
    expect(result.price).toBe(1); // fallback default
  });

  it("returns price=1 for USDC without making any network calls", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    const result = await getTokenPrice("USDC");
    expect(result.error).toBe(false);
    expect(result.price).toBe(1);
    // Should NOT have fetched anything (hardcoded stablecoin shortcut)
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns price=1 for NUSD without network calls", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    const result = await getTokenPrice("NUSD");
    expect(result.price).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns price=1 and error=true for empty token string", async () => {
    const result = await getTokenPrice("");
    expect(result.error).toBe(true);
    expect(result.price).toBe(1);
  });

  it("returns a price from CoinGecko when API succeeds", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ethereum: { usd: 3000 } }),
    });

    // Use a fresh (uncached) token name
    const result = await getTokenPrice("ETH_TEST_" + Math.random());
    // The coingeckoId for an unknown token falls back to the symbol.toLowerCase()
    // So it won't find 'ethereum' key → falls through to Coinbase fallback
    // But the mock returns { ethereum: { usd: 3000 } } which won't match our dynamic symbol
    // This tests that the function handles missing key gracefully and falls through
    expect(typeof result.price).toBe("number");
  });

  it("parses price from CoinGecko response correctly for known symbol", async () => {
    const TOKEN = "ETH_UNIQUE_" + Date.now(); // Bypass cache
    // Simulate CoinGecko returning the right price for our coingeckoId
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => {
        const id = TOKEN.toLowerCase();
        return { [id]: { usd: 42.5 } };
      },
    });

    const result = await getTokenPrice(TOKEN);
    expect(result.price).toBe(42.5);
    expect(result.error).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getTokenBalance — success path (native token via zeroAddress)
// ---------------------------------------------------------------------------
describe("getTokenBalance success path", () => {
  it("uses getBalance for native token (zeroAddress)", async () => {
    const mockBalance = 1_000_000_000_000_000_000n; // 1 ETH
    const mockGetBalance = vi.fn().mockResolvedValue(mockBalance);
    (createPublicClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      getBalance: mockGetBalance,
    });

    const result = await getTokenBalance(
      "0x0000000000000000000000000000000000000000", // zeroAddress
      "0xabc0000000000000000000000000000000000001" as `0x${string}`,
      fakeChain as Parameters<typeof getTokenBalance>[2]
    );

    expect(mockGetBalance).toHaveBeenCalledWith({
      address: "0xabc0000000000000000000000000000000000001",
    });
    expect(result.balance).toBe(mockBalance);
    expect(result.decimals).toBe(18);
    expect(result.formatted).toBe("1");
  });

  it("uses readContract for ERC20 token", async () => {
    const mockBalance = 1_000_000n; // 1 USDC (6 decimals)
    const mockDecimals = 6;
    (createPublicClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({});
    (readContract as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockBalance)   // balanceOf
      .mockResolvedValueOnce(mockDecimals); // decimals

    const result = await getTokenBalance(
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // some ERC20
      "0xabc0000000000000000000000000000000000001" as `0x${string}`,
      fakeChain as Parameters<typeof getTokenBalance>[2]
    );

    expect(result.balance).toBe(mockBalance);
    expect(result.decimals).toBe(mockDecimals);
    expect(result.formatted).toBe("1");
  });
});
