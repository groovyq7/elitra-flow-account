/**
 * Unit tests for hooks/use-vault-data.ts
 *
 * Strategy: mock wagmi hooks and vault-registry so all sub-hooks return
 * controlled deterministic values. useVaultData composes useVaultList,
 * useUserPositions and useUserRewards — we verify the composite shape.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useVaultData, useVaultList, useVaultDetails, useUserPositions, useUserRewards } from "@/hooks/use-vault-data";
import type { Vault } from "@/lib/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// wagmi
vi.mock("wagmi", () => ({
  useChainId: vi.fn(() => 5115),
  useAccount: vi.fn(() => ({ address: "0xabc" as `0x${string}` })),
}));

// vault registry
const mockGetVaultsByChain = vi.fn();
const mockGetVaultById = vi.fn();
vi.mock("@/lib/contracts/vault-registry", () => ({
  getVaultsByChain: (...args: unknown[]) => mockGetVaultsByChain(...args),
  getVaultById: (...args: unknown[]) => mockGetVaultById(...args),
}));

// @tanstack/react-query — keep real implementation but control async responses
// via the mocked vault-registry functions above (no mock of useQuery itself,
// so we test the real hook wiring with renderHook + React Query in memory)
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_VAULT: Vault = {
  id: "vault-1",
  name: "BTC Vault",
  symbol: "eCBTC",
  token0: { symbol: "CBTC", address: "0x0000", decimals: 18, name: "Citrea BTC" },
  address: "0x2876a1fb400c238b0a9e4edd2e7e03d3cf9b53c2",
  chainId: 5115,
  apy: 5.0,
  tvl: 100000,
  protocol: "Elitra",
  shareToken: {
    address: "0x2876a1fb400c238b0a9e4edd2e7e03d3cf9b53c2",
    symbol: "eCBTC",
    decimals: 18,
    name: "Elitra BTC Vault",
  },
} as unknown as Vault;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useVaultList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns vaults when query resolves", async () => {
    mockGetVaultsByChain.mockResolvedValue([MOCK_VAULT]);
    const { result } = renderHook(() => useVaultList(), {
      wrapper: makeWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for data
    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([MOCK_VAULT]);
    expect(mockGetVaultsByChain).toHaveBeenCalledWith(5115);
  });

  it("enters error state when query fails", async () => {
    mockGetVaultsByChain.mockRejectedValue(new Error("RPC unreachable"));
    const { result } = renderHook(() => useVaultList(), {
      wrapper: makeWrapper(),
    });

    await vi.waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe("RPC unreachable");
  });
});

describe("useVaultDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns vault details for a given id", async () => {
    mockGetVaultById.mockResolvedValue(MOCK_VAULT);
    const { result } = renderHook(() => useVaultDetails("vault-1"), {
      wrapper: makeWrapper(),
    });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(MOCK_VAULT);
    expect(mockGetVaultById).toHaveBeenCalledWith("vault-1", 5115);
  });

  it("does not fetch when vaultId is empty", () => {
    const { result } = renderHook(() => useVaultDetails(""), {
      wrapper: makeWrapper(),
    });
    // enabled: !!vaultId === false — query stays idle (not loading)
    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGetVaultById).not.toHaveBeenCalled();
  });
});

describe("useVaultData (composite hook)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns correct composite structure with vault data", async () => {
    mockGetVaultsByChain.mockResolvedValue([MOCK_VAULT]);
    const { result } = renderHook(() => useVaultData(), {
      wrapper: makeWrapper(),
    });

    // Initial state — vaultList is loading, empty defaults provided
    expect(result.current.vaults).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.userPositions).toEqual([]);
    expect(result.current.userRewards).toBe(BigInt(0));

    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.vaults).toEqual([MOCK_VAULT]);
  });

  it("returns loading=true while vaultList is fetching", () => {
    // Never resolves within this test
    mockGetVaultsByChain.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useVaultData(), {
      wrapper: makeWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.vaults).toEqual([]);
  });

  it("returns empty vaults array on query error (safe default)", async () => {
    mockGetVaultsByChain.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useVaultData(), {
      wrapper: makeWrapper(),
    });

    // Wait for error to settle
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
    // vaults falls back to [] even on error
    expect(result.current.vaults).toEqual([]);
  });

  it("exposes a refetch function that can be called without throwing", async () => {
    mockGetVaultsByChain.mockResolvedValue([]);
    const { result } = renderHook(() => useVaultData(), {
      wrapper: makeWrapper(),
    });

    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(() => result.current.refetch()).not.toThrow();
  });
});

describe("useUserPositions", () => {
  it("returns empty array for a connected wallet (stub implementation)", async () => {
    const { result } = renderHook(() => useUserPositions(), {
      wrapper: makeWrapper(),
    });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

describe("useUserRewards", () => {
  it("returns BigInt(0) (stub implementation)", async () => {
    const { result } = renderHook(() => useUserRewards(), {
      wrapper: makeWrapper(),
    });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(BigInt(0));
  });
});
