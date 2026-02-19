/**
 * Unit tests for hooks/useVaultPageData.ts
 *
 * Strategy: mock all external async calls so the hook's effects can be
 * controlled deterministically in jsdom without real network / chain access.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useVaultPageData } from "@/hooks/useVaultPageData";
import type { Vault } from "@/lib/types";
import type { Chain } from "viem";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetVaultByIdWithSubgraph = vi.fn();
vi.mock("@/lib/contracts/vault-registry", () => ({
  getVaultByIdWithSubgraph: (...args: unknown[]) =>
    mockGetVaultByIdWithSubgraph(...args),
  getVaultsByChain: vi.fn(() => []),
  getVaultsByChainWithSubgraph: vi.fn(() => Promise.resolve([])),
}));

const mockGetUserVaultPositionFromSubgraph = vi.fn();
vi.mock("@/lib/contracts/user-positions", () => ({
  getUserVaultPositionFromSubgraph: (...args: unknown[]) =>
    mockGetUserVaultPositionFromSubgraph(...args),
}));

const mockComputePositionPnL = vi.fn();
vi.mock("@/lib/utils/pnl", () => ({
  computePositionPnL: (...args: unknown[]) => mockComputePositionPnL(...args),
}));

const mockGetTokenBalance = vi.fn();
const mockGetTokenPrice = vi.fn();
const mockGetVaultRate = vi.fn();
vi.mock("@/lib/utils/get-token-balance", () => ({
  getTokenBalance: (...args: unknown[]) => mockGetTokenBalance(...args),
  getTokenPrice: (...args: unknown[]) => mockGetTokenPrice(...args),
  getVaultRate: (...args: unknown[]) => mockGetVaultRate(...args),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CITREA_CHAIN: Chain = {
  id: 5115,
  name: "Citrea",
  nativeCurrency: { name: "cBTC", symbol: "CBTC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.devnet.citrea.xyz"] } },
} as unknown as Chain;

const MOCK_VAULT: Vault = {
  id: "0xvault0000000000000000000000000000000001",
  name: "CBTC Vault",
  symbol: "eCBTC",
  decimals: 18,
  apy: "6",
  chainId: 5115,
  token0: {
    address: "0xcbtc0000000000000000000000000000000001",
    symbol: "CBTC",
    decimals: 18,
    name: "Citrea BTC",
  },
  token1: null,
  launchDate: "2025-01-01",
  breakdown: [],
} as unknown as Vault;

const USER_ADDRESS = "0xuser000000000000000000000000000000000001" as `0x${string}`;

const BASE_PROPS = {
  vault: MOCK_VAULT,
  vaultChain: CITREA_CHAIN,
  address: USER_ADDRESS,
  embeddedWalletAddress: undefined as string | undefined | null,
  isConnected: true,
  formattedTotalSupply: "1000",
};

// Default successful responses
const DEFAULT_RATE = {
  rate: "1.05",
  rateRaw: 1050000000000000000n,
};
const DEFAULT_PRICE = { price: 60000 };
const DEFAULT_BALANCE = { balance: 100n * 10n ** 18n, decimals: 18, formatted: "100" };
const DEFAULT_SHARE_BALANCE = { balance: 95n * 10n ** 18n, decimals: 18, formatted: "95" };
const DEFAULT_PNL = {
  underlyingValue: "100",
  underlyingValueRaw: 100n * 10n ** 18n,
  unrealizedPnLRaw: 5n * 10n ** 18n,
  totalPnLRaw: 5n * 10n ** 18n,
  pnlPctScaled: undefined,
  costBasis: "95",
  realizedPnL: "0",
  unrealizedPnL: "5",
  totalPnL: "5",
  pnlPct: "0.052631578947368421",
};
const DEFAULT_SUBGRAPH_POSITION = {
  data: {
    currentShareBalance: 95n * 10n ** 18n,
    costBasis: 95n * 10n ** 18n,
    realizedPnL: 0n,
  },
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  mockGetVaultByIdWithSubgraph.mockResolvedValue(MOCK_VAULT);
  mockGetUserVaultPositionFromSubgraph.mockResolvedValue(DEFAULT_SUBGRAPH_POSITION);
  mockComputePositionPnL.mockReturnValue(DEFAULT_PNL);
  mockGetVaultRate.mockResolvedValue(DEFAULT_RATE);
  mockGetTokenPrice.mockResolvedValue(DEFAULT_PRICE);
  mockGetTokenBalance.mockImplementation((_addr: unknown, _user: unknown) => {
    // Return share balance when vault id is queried, token balance otherwise
    return Promise.resolve(DEFAULT_BALANCE);
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useVaultPageData — loading state", () => {
  it("returns undefined vaultData before async fetch resolves", () => {
    // Make getVaultByIdWithSubgraph hang so we can observe the initial state
    mockGetVaultByIdWithSubgraph.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useVaultPageData(BASE_PROPS));

    // vaultData starts undefined while fetch is in flight
    expect(result.current.vaultData).toBeUndefined();
  });

  it("returns undefined userPositionPnlInfo before PnL fetch resolves", () => {
    mockGetVaultRate.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useVaultPageData(BASE_PROPS));

    expect(result.current.userPositionPnlInfo).toBeUndefined();
  });
});

describe("useVaultPageData — vault data fetch", () => {
  it("populates vaultData when getVaultByIdWithSubgraph resolves", async () => {
    const enrichedVault = { ...MOCK_VAULT, apy: "8.5" };
    mockGetVaultByIdWithSubgraph.mockResolvedValue(enrichedVault);

    const { result } = renderHook(() => useVaultPageData(BASE_PROPS));

    await waitFor(() => {
      expect(result.current.vaultData).toBeDefined();
    });

    expect(result.current.vaultData?.apy).toBe("8.5");
    expect(result.current.vaultData?.id).toBe(MOCK_VAULT.id);
  });

  it("calls getVaultByIdWithSubgraph with the correct vault id and chain id", async () => {
    const { result } = renderHook(() => useVaultPageData(BASE_PROPS));

    await waitFor(() => {
      expect(result.current.vaultData).toBeDefined();
    });

    expect(mockGetVaultByIdWithSubgraph).toHaveBeenCalledWith(
      MOCK_VAULT.id,
      CITREA_CHAIN.id
    );
  });

  it("does not fetch vault data when vault prop is undefined", () => {
    const { result } = renderHook(() =>
      useVaultPageData({ ...BASE_PROPS, vault: undefined })
    );

    // Should not attempt any fetch without a vault
    expect(result.current.vaultData).toBeUndefined();
    expect(mockGetVaultByIdWithSubgraph).not.toHaveBeenCalled();
  });
});

describe("useVaultPageData — 404 handling (vault not found)", () => {
  it("leaves vaultData undefined when subgraph returns undefined (not found)", async () => {
    // Subgraph returns undefined for an unknown vault — the page renders 404
    mockGetVaultByIdWithSubgraph.mockResolvedValue(undefined);

    const { result } = renderHook(() => useVaultPageData(BASE_PROPS));

    // After fetch completes, vaultData should still be undefined
    await waitFor(() => {
      expect(mockGetVaultByIdWithSubgraph).toHaveBeenCalled();
    });

    // Give the state update a chance to run
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.vaultData).toBeUndefined();
  });

  it("leaves vaultData undefined when subgraph returns null", async () => {
    mockGetVaultByIdWithSubgraph.mockResolvedValue(null);

    const { result } = renderHook(() => useVaultPageData(BASE_PROPS));

    await waitFor(() => {
      expect(mockGetVaultByIdWithSubgraph).toHaveBeenCalled();
    });

    await new Promise((r) => setTimeout(r, 50));
    // null from subgraph means vault not found — vaultData stays undefined
    // (state was never set from null)
    expect(result.current.vaultData).toBeUndefined();
  });
});

describe("useVaultPageData — PnL calculation", () => {
  it("computes userPositionPnlInfo when connected with shares", async () => {
    const { result } = renderHook(() => useVaultPageData(BASE_PROPS));

    await waitFor(() => {
      expect(result.current.userPositionPnlInfo).toBeDefined();
    });

    expect(result.current.userPositionPnlInfo?.pnl).toBe(5); // unrealizedPnL=5
    expect(result.current.userPositionPnlInfo?.underlyingValue).toBe(100);
  });

  it("derives tokenPrice from getTokenPrice result", async () => {
    mockGetTokenPrice.mockResolvedValue({ price: 75000 });

    const { result } = renderHook(() => useVaultPageData(BASE_PROPS));

    await waitFor(() => {
      expect(result.current.tokenPrice).toBe(75000);
    });
  });

  it("derives tokenRate from getVaultRate result", async () => {
    mockGetVaultRate.mockResolvedValue({ rate: "1.1", rateRaw: 1100000000000000000n });

    const { result } = renderHook(() => useVaultPageData(BASE_PROPS));

    await waitFor(() => {
      expect(result.current.tokenRate).toBe(1.1);
    });
  });

  it("skips PnL fetch when not connected", async () => {
    const { result } = renderHook(() =>
      useVaultPageData({ ...BASE_PROPS, isConnected: false })
    );

    // Wait a tick to ensure effects have run
    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.userPositionPnlInfo).toBeUndefined();
    expect(mockGetVaultRate).not.toHaveBeenCalled();
  });

  it("combines external and embedded wallet PnL", async () => {
    // External wallet: 5 PnL; embedded wallet: 10 PnL
    mockComputePositionPnL
      .mockReturnValueOnce({ ...DEFAULT_PNL, unrealizedPnL: "5", underlyingValue: "100" })
      .mockReturnValueOnce({ ...DEFAULT_PNL, unrealizedPnL: "10", underlyingValue: "50" });

    const { result } = renderHook(() =>
      useVaultPageData({
        ...BASE_PROPS,
        embeddedWalletAddress: "0xembedded000000000000000000000000000001",
      })
    );

    await waitFor(() => {
      expect(result.current.userPositionPnlInfo).toBeDefined();
    });

    // Combined PnL: 5 + 10 = 15
    expect(result.current.userPositionPnlInfo?.pnl).toBe(15);
    // Combined underlyingValue: 100 + 50 = 150
    expect(result.current.userPositionPnlInfo?.underlyingValue).toBe(150);
  });
});

describe("useVaultPageData — TVL calculation", () => {
  it("computes vaultTvl from totalSupply × rate × price", async () => {
    // totalSupply=1000, rate=1.05, price=60000 → 1000 * 1.05 * 60000 = 63_000_000
    const { result } = renderHook(() => useVaultPageData(BASE_PROPS));

    await waitFor(() => {
      expect(result.current.vaultTvl).toBeDefined();
    });

    // 1000 (supply) * 1.05 (rate) * 60000 (price) = 63_000_000
    expect(result.current.vaultTvl).toBeCloseTo(63_000_000, -3);
  });

  it("returns undefined vaultTvl when totalSupply is not provided", async () => {
    const { result } = renderHook(() =>
      useVaultPageData({ ...BASE_PROPS, formattedTotalSupply: undefined })
    );

    await new Promise((r) => setTimeout(r, 100));
    expect(result.current.vaultTvl).toBeUndefined();
  });
});

describe("useVaultPageData — error handling", () => {
  it("handles getVaultByIdWithSubgraph errors gracefully (no crash)", async () => {
    mockGetVaultByIdWithSubgraph.mockRejectedValue(new Error("Subgraph unreachable"));

    const { result } = renderHook(() => useVaultPageData(BASE_PROPS));

    // Should not throw; hook stays in a stable undefined state
    await new Promise((r) => setTimeout(r, 100));
    expect(result.current.vaultData).toBeUndefined();
  });

  it("handles getVaultRate errors gracefully (no crash)", async () => {
    mockGetVaultRate.mockRejectedValue(new Error("RPC timeout"));

    const { result } = renderHook(() => useVaultPageData(BASE_PROPS));

    await new Promise((r) => setTimeout(r, 100));
    // PnL info remains undefined; no crash
    expect(result.current.userPositionPnlInfo).toBeUndefined();
  });

  it("handles getUserVaultPositionFromSubgraph errors gracefully", async () => {
    mockGetUserVaultPositionFromSubgraph.mockRejectedValue(new Error("Not indexed"));

    const { result } = renderHook(() => useVaultPageData(BASE_PROPS));

    await new Promise((r) => setTimeout(r, 100));
    expect(result.current.userPositionPnlInfo).toBeUndefined();
  });
});
