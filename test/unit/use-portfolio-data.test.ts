/**
 * Unit tests for hooks/usePortfolioData.ts
 *
 * Strategy: mock fetchTokenInfos and mergeTokenInfos so we can control
 * exactly what data the hook receives.  usePortfolioData takes address /
 * embeddedWalletAddress as props (not via wagmi useAccount), so no wagmi
 * mocking is needed for the core portfolio calculations.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import type { TokenInfo, TokenType, Vault } from "@/lib/types";
import type { Chain } from "viem";

// ── Mock fetchTokenInfos / mergeTokenInfos ────────────────────────────────────

const mockFetchTokenInfos = vi.fn();
const mockMergeTokenInfos = vi.fn();

vi.mock("@/lib/fetchTokenInfos", () => ({
  fetchTokenInfos: (...args: unknown[]) => mockFetchTokenInfos(...args),
  mergeTokenInfos: (...args: unknown[]) => mockMergeTokenInfos(...args),
}));

// Mock constants so we don't need real token lists
vi.mock("@/lib/constants", () => ({
  OFFICIAL_TOKENS: {
    5115: [
      { symbol: "CBTC", address: "0xcbtc", decimals: 18, name: "CBTC" },
    ],
  },
  VAULT_TOKENS: {
    5115: [
      { symbol: "eCBTC", address: "0xecbtc", decimals: 18, name: "eCBTC" },
    ],
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTokenInfo(
  symbol: string,
  availableUSD: number,
  address = "0xcbtc",
  yearlyRewardUSD = 0
): TokenInfo {
  return {
    symbol,
    token: { symbol, address, decimals: 18, name: symbol } as TokenType,
    icon: null,
    available: 1,
    availableUSD,
    apy: 0.05,
    yearlyReward: yearlyRewardUSD / 40000,
    yearlyRewardUSD,
    price: 40000,
  };
}

const CITREA_CHAIN: Chain = {
  id: 5115,
  name: "Citrea",
  nativeCurrency: { name: "cBTC", symbol: "CBTC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.devnet.citrea.xyz"] } },
} as unknown as Chain;

const USER_ADDRESS = "0xuser000000000000000000000000000000000001" as `0x${string}`;

const BASE_PROPS = {
  depositTokens: [
    { symbol: "CBTC", address: "0xcbtc", decimals: 18, name: "CBTC" } as TokenType,
  ],
  address: USER_ADDRESS,
  embeddedWalletAddress: undefined as string | undefined | null,
  chain: CITREA_CHAIN,
  citreaChain: CITREA_CHAIN,
  vaultsData: [] as Vault[],
  isModalOpen: false,
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Default: fetchTokenInfos returns an empty array; mergeTokenInfos passes through
  mockFetchTokenInfos.mockResolvedValue([]);
  mockMergeTokenInfos.mockImplementation((external: TokenInfo[]) => external);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("usePortfolioData — totalBalance calculation", () => {
  it("sums availableUSD across all combined token infos", async () => {
    const token1 = makeTokenInfo("CBTC", 500, "0xcbtc");
    const token2 = makeTokenInfo("USDC", 1500, "0xusdc");

    // External fetch returns two tokens; vault fetch returns empty
    mockFetchTokenInfos.mockImplementation(
      (_tokens: unknown, addr: string) => {
        if (addr === USER_ADDRESS) return Promise.resolve([token1, token2]);
        return Promise.resolve([]);
      }
    );
    mockMergeTokenInfos.mockImplementation(
      (external: TokenInfo[], embedded: TokenInfo[]) => [...external, ...embedded]
    );

    const { result } = renderHook(() => usePortfolioData(BASE_PROPS));

    await waitFor(() => {
      expect(result.current.portfolioData).not.toBeNull();
    });

    expect(result.current.portfolioData!.totalBalance).toBe(2000); // 500 + 1500
  });

  it("calculates eligibleToEarn for deposit token addresses only", async () => {
    const cbtcToken = makeTokenInfo("CBTC", 800, "0xcbtc");
    const usdcToken = makeTokenInfo("USDC", 200, "0xusdc");

    mockFetchTokenInfos.mockImplementation(
      (_tokens: unknown, addr: string) => {
        if (addr === USER_ADDRESS)
          return Promise.resolve([cbtcToken, usdcToken]);
        return Promise.resolve([]);
      }
    );
    mockMergeTokenInfos.mockImplementation(
      (external: TokenInfo[], embedded: TokenInfo[]) => [...external, ...embedded]
    );

    const { result } = renderHook(() => usePortfolioData(BASE_PROPS));

    await waitFor(() => {
      expect(result.current.portfolioData).not.toBeNull();
    });

    // depositTokens only has CBTC (0xcbtc), so eligibleToEarn = CBTC only
    expect(result.current.portfolioData!.eligibleToEarn).toBe(800);
    // totalBalance includes both CBTC and USDC
    expect(result.current.portfolioData!.totalBalance).toBe(1000);
  });

  it("includes embedded wallet balance in totalBalance", async () => {
    const externalToken = makeTokenInfo("CBTC", 300, "0xcbtc");
    const embeddedToken = makeTokenInfo("CBTC", 200, "0xcbtc");
    const mergedToken = makeTokenInfo("CBTC", 500, "0xcbtc");

    mockFetchTokenInfos.mockImplementation(
      (_tokens: unknown, addr: string) => {
        if (addr === USER_ADDRESS) return Promise.resolve([externalToken]);
        return Promise.resolve([embeddedToken]);
      }
    );
    // Merge sums the available amounts
    mockMergeTokenInfos.mockReturnValue([mergedToken]);

    const props = {
      ...BASE_PROPS,
      embeddedWalletAddress: "0xembedded",
    };
    const { result } = renderHook(() => usePortfolioData(props));

    await waitFor(() => {
      expect(result.current.portfolioData).not.toBeNull();
    });

    expect(result.current.portfolioData!.totalBalance).toBe(500);
  });
});

describe("usePortfolioData — empty vault list", () => {
  it("returns portfolioData with zero balances for empty token results", async () => {
    mockFetchTokenInfos.mockResolvedValue([]);
    mockMergeTokenInfos.mockReturnValue([]);

    const { result } = renderHook(() => usePortfolioData(BASE_PROPS));

    await waitFor(() => {
      expect(result.current.portfolioData).not.toBeNull();
    });

    const data = result.current.portfolioData!;
    expect(data.totalBalance).toBe(0);
    expect(data.eligibleToEarn).toBe(0);
    expect(data.estimatedRewards).toBe(0);
    expect(data.depositedAmountUSD).toBe(0);
  });

  it("returns empty tokenInfos array for empty token results", async () => {
    mockFetchTokenInfos.mockResolvedValue([]);
    mockMergeTokenInfos.mockReturnValue([]);

    const { result } = renderHook(() => usePortfolioData(BASE_PROPS));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tokenInfos).toHaveLength(0);
    expect(result.current.vaultTokenInfos).toHaveLength(0);
  });
});

describe("usePortfolioData — when address is undefined", () => {
  it("returns null portfolioData and empty arrays when no address", () => {
    const { result } = renderHook(() =>
      usePortfolioData({ ...BASE_PROPS, address: undefined })
    );

    // With no address, the hook short-circuits without calling fetchTokenInfos
    expect(result.current.portfolioData).toBeNull();
    expect(result.current.tokenInfos).toHaveLength(0);
    expect(mockFetchTokenInfos).not.toHaveBeenCalled();
  });
});

describe("usePortfolioData — fetch errors", () => {
  it("handles fetchTokenInfos rejection gracefully (leaves portfolioData null)", async () => {
    mockFetchTokenInfos.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => usePortfolioData(BASE_PROPS));

    // After the rejected promise, isLoading should settle to false
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // portfolioData stays null because the fetch failed
    expect(result.current.portfolioData).toBeNull();
  });
});

describe("usePortfolioData — loading state", () => {
  it("isLoading starts false when no address provided", () => {
    const { result } = renderHook(() =>
      usePortfolioData({ ...BASE_PROPS, address: undefined })
    );

    expect(result.current.isLoading).toBe(false);
  });

  it("isLoading becomes false after fetch resolves", async () => {
    mockFetchTokenInfos.mockResolvedValue([]);
    mockMergeTokenInfos.mockReturnValue([]);

    const { result } = renderHook(() => usePortfolioData(BASE_PROPS));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });
});

describe("usePortfolioData — estimatedRewards / monthlyRewards", () => {
  it("calculates estimatedRewards from deposit token yearlyRewardUSD", async () => {
    const cbtcToken = makeTokenInfo("CBTC", 1000, "0xcbtc", 50); // 50 USD/year reward

    mockFetchTokenInfos.mockImplementation(
      (_tokens: unknown, addr: string) => {
        if (addr === USER_ADDRESS) return Promise.resolve([cbtcToken]);
        return Promise.resolve([]);
      }
    );
    mockMergeTokenInfos.mockImplementation(
      (external: TokenInfo[], embedded: TokenInfo[]) => [...external, ...embedded]
    );

    const { result } = renderHook(() => usePortfolioData(BASE_PROPS));

    await waitFor(() => {
      expect(result.current.portfolioData).not.toBeNull();
    });

    expect(result.current.portfolioData!.estimatedRewards).toBe(50);
    expect(result.current.portfolioData!.monthlyRewards).toBeCloseTo(50 / 12, 5);
  });
});
