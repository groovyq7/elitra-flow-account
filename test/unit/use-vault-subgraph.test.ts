/**
 * Unit tests for hooks/use-vault-subgraph.ts
 *
 * Strategy: mock useQuery (the custom hook) and wagmi's useChainId, plus the
 * vault-registry so we control base vaults. Assert that:
 *  - loading state is propagated from useQuery result
 *  - subgraph data is merged into base vault data when available
 *  - missing fields (null APY, null TVL) fall back to base values
 *  - empty vault list returns empty array (pause=true)
 *  - subgraph error still returns base data shape
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useVaultListSubgraph, useVaultDetailsSubgraph } from "@/hooks/use-vault-subgraph";
import type { Vault } from "@/lib/types";

// ── Mutable state for useQuery stub ──────────────────────────────────────────
let mockQueryResult: {
  data: { Vault: unknown[] } | null;
  fetching: boolean;
  error: unknown;
} = { data: null, fetching: false, error: null };

const mockRefetch = vi.fn();

vi.mock("@/hooks/useQuery", () => ({
  useQuery: vi.fn(() => [mockQueryResult, mockRefetch]),
}));

// ── wagmi ─────────────────────────────────────────────────────────────────────
vi.mock("wagmi", () => ({
  useChainId: vi.fn(() => 5115),
}));

// ── Vault registry ────────────────────────────────────────────────────────────
const BASE_VAULT: Vault = {
  id: "0xvault1",
  name: "BTC Vault",
  symbol: "eCBTC",
  decimals: 8,
  apy: 5.0,
  launchDate: "2024-01-01",
  token0: { symbol: "CBTC", address: "0x0001", decimals: 8, name: "Citrea BTC" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetVaultsByChain = vi.fn<(...args: any[]) => Vault[]>(() => [BASE_VAULT]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetVaultById = vi.fn<(...args: any[]) => Vault>(() => BASE_VAULT);

vi.mock("@/lib/contracts/vault-registry", () => ({
  getVaultsByChain: (chainId: number) => mockGetVaultsByChain(chainId),
  getVaultById: (id: string) => mockGetVaultById(id),
}));

// ── Reset ──────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockGetVaultsByChain.mockReturnValue([BASE_VAULT]);
  mockQueryResult = { data: null, fetching: false, error: null };
});

// ─────────────────────────────────────────────────────────────────────────────
// useVaultListSubgraph
// ─────────────────────────────────────────────────────────────────────────────

describe("useVaultListSubgraph — loading state", () => {
  it("propagates fetching=true from useQuery", () => {
    mockQueryResult = { data: null, fetching: true, error: null };
    const { result } = renderHook(() => useVaultListSubgraph());
    expect(result.current.isLoading).toBe(true);
  });

  it("isLoading is false when not fetching", () => {
    mockQueryResult = { data: null, fetching: false, error: null };
    const { result } = renderHook(() => useVaultListSubgraph());
    expect(result.current.isLoading).toBe(false);
  });
});

describe("useVaultListSubgraph — subgraph data merge", () => {
  it("enriches base vault with subgraph APY and TVL", () => {
    mockQueryResult = {
      data: {
        Vault: [
          {
            id: "0xvault1",
            apy: 12.5,
            rate: "1000000000000000000",
            tvl: 500000,
            totalSupply: "2000000000",
            totalAssetDepositedRaw: "1000000",
            totalAssetWithdrawnRaw: "500000",
            depositsCount: 42,
            withdrawalsCount: 10,
            rateSnapshots: [{ rate: "1000000", timestamp: 1700000000 }],
          },
        ],
      },
      fetching: false,
      error: null,
    };

    const { result } = renderHook(() => useVaultListSubgraph());
    const vaults = result.current.vaults;

    expect(vaults).toHaveLength(1);
    const v = vaults[0];
    expect(v.apy).toBe(12.5);
    expect(v.tvl).toBe(500000);
    expect(v.rate).toBe(BigInt("1000000000000000000"));
    expect(v.totalSupply).toBe(BigInt("2000000000"));
    expect(v.depositsCount).toBe(42);
    expect(v.withdrawalsCount).toBe(10);
    expect(v.rateSnapshots).toHaveLength(1);
    expect(v.rateSnapshots![0].rate).toBe("1000000");
    expect(v.totalAssetDepositedRaw).toBe("1000000");
    expect(v.totalAssetWithdrawnRaw).toBe("500000");
  });

  it("preserves base vault fields not overridden by subgraph", () => {
    mockQueryResult = {
      data: {
        Vault: [
          {
            id: "0xvault1",
            apy: 9,
            rate: "1",
            tvl: 100,
            totalSupply: "1",
            totalAssetDepositedRaw: null,
            totalAssetWithdrawnRaw: null,
            depositsCount: null,
            withdrawalsCount: null,
            rateSnapshots: [],
          },
        ],
      },
      fetching: false,
      error: null,
    };

    const { result } = renderHook(() => useVaultListSubgraph());
    const v = result.current.vaults[0];
    // Base fields preserved
    expect(v.name).toBe("BTC Vault");
    expect(v.symbol).toBe("eCBTC");
    expect(v.token0.symbol).toBe("CBTC");
  });
});

describe("useVaultListSubgraph — null / missing fields fall back", () => {
  it("uses base vault APY when subgraph APY is null", () => {
    mockQueryResult = {
      data: {
        Vault: [
          {
            id: "0xvault1",
            apy: null,
            rate: "1",
            tvl: null,
            totalSupply: null,
            totalAssetDepositedRaw: null,
            totalAssetWithdrawnRaw: null,
            depositsCount: null,
            withdrawalsCount: null,
            rateSnapshots: [],
          },
        ],
      },
      fetching: false,
      error: null,
    };

    const { result } = renderHook(() => useVaultListSubgraph());
    const v = result.current.vaults[0];
    // APY falls back to base value
    expect(v.apy).toBe(5.0);
  });

  it("TVL defaults to 0 when subgraph TVL is null", () => {
    mockQueryResult = {
      data: {
        Vault: [
          {
            id: "0xvault1",
            apy: null,
            rate: null,
            tvl: null,
            totalSupply: null,
            totalAssetDepositedRaw: null,
            totalAssetWithdrawnRaw: null,
            depositsCount: null,
            withdrawalsCount: null,
            rateSnapshots: [],
          },
        ],
      },
      fetching: false,
      error: null,
    };

    const { result } = renderHook(() => useVaultListSubgraph());
    const v = result.current.vaults[0];
    expect(v.tvl).toBe(0);
  });

  it("rate defaults to 1n when subgraph rate is null", () => {
    mockQueryResult = {
      data: {
        Vault: [
          {
            id: "0xvault1",
            apy: null,
            rate: null,
            tvl: null,
            totalSupply: null,
            totalAssetDepositedRaw: null,
            totalAssetWithdrawnRaw: null,
            depositsCount: null,
            withdrawalsCount: null,
            rateSnapshots: [],
          },
        ],
      },
      fetching: false,
      error: null,
    };

    const { result } = renderHook(() => useVaultListSubgraph());
    const v = result.current.vaults[0];
    expect(v.rate).toBe(1n);
  });

  it("totalSupply defaults to 1n when subgraph totalSupply is null", () => {
    mockQueryResult = {
      data: {
        Vault: [
          {
            id: "0xvault1",
            apy: null,
            rate: null,
            tvl: null,
            totalSupply: null,
            totalAssetDepositedRaw: null,
            totalAssetWithdrawnRaw: null,
            depositsCount: null,
            withdrawalsCount: null,
            rateSnapshots: [],
          },
        ],
      },
      fetching: false,
      error: null,
    };

    const { result } = renderHook(() => useVaultListSubgraph());
    const v = result.current.vaults[0];
    expect(v.totalSupply).toBe(1n);
  });
});

describe("useVaultListSubgraph — empty vault list", () => {
  it("returns empty array when registry returns no vaults", () => {
    mockGetVaultsByChain.mockReturnValue([]);
    const { result } = renderHook(() => useVaultListSubgraph());
    expect(result.current.vaults).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});

describe("useVaultListSubgraph — subgraph error", () => {
  it("returns base vault data when subgraph query has error", () => {
    mockQueryResult = { data: null, fetching: false, error: new Error("Network error") };

    const { result } = renderHook(() => useVaultListSubgraph());

    // error is surfaced
    expect(result.current.error).toBeInstanceOf(Error);
    // base vaults still returned (no subgraph enrichment)
    expect(result.current.vaults).toHaveLength(1);
    expect(result.current.vaults[0].id).toBe("0xvault1");
    expect(result.current.vaults[0].apy).toBe(5.0);
    expect(result.current.vaults[0].name).toBe("BTC Vault");
  });

  it("returns base vault data when subgraph data is null (unavailable)", () => {
    mockQueryResult = { data: null, fetching: false, error: null };

    const { result } = renderHook(() => useVaultListSubgraph());

    expect(result.current.vaults).toHaveLength(1);
    // unchanged base fields
    expect(result.current.vaults[0].apy).toBe(5.0);
    expect(result.current.vaults[0].tvl).toBeUndefined();
  });
});

describe("useVaultListSubgraph — refetch", () => {
  it("exposes a refetch function", () => {
    const { result } = renderHook(() => useVaultListSubgraph());
    expect(typeof result.current.refetch).toBe("function");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useVaultDetailsSubgraph
// ─────────────────────────────────────────────────────────────────────────────

describe("useVaultDetailsSubgraph — no vaultId", () => {
  it("returns undefined vault when vaultId is undefined", () => {
    const { result } = renderHook(() => useVaultDetailsSubgraph(undefined));
    expect(result.current.vault).toBeUndefined();
  });
});

describe("useVaultDetailsSubgraph — vault not in registry", () => {
  it("returns undefined when vault id not found in registry", () => {
    mockGetVaultsByChain.mockReturnValue([]);
    const { result } = renderHook(() => useVaultDetailsSubgraph("0xunknown"));
    expect(result.current.vault).toBeUndefined();
  });
});

describe("useVaultDetailsSubgraph — subgraph data enrichment", () => {
  it("returns base vault when subgraph has no data for that id", () => {
    mockQueryResult = { data: { Vault: [] }, fetching: false, error: null };

    const { result } = renderHook(() => useVaultDetailsSubgraph("0xvault1"));
    expect(result.current.vault).toBeDefined();
    expect(result.current.vault!.id).toBe("0xvault1");
    expect(result.current.vault!.apy).toBe(5.0);
  });

  it("merges subgraph metrics into base vault for single vault query", () => {
    mockQueryResult = {
      data: {
        Vault: [
          {
            id: "0xvault1",
            apy: 18.0,
            rate: "999",
            tvl: 1000000,
            totalSupply: "50000000",
            totalAssetDepositedRaw: "7000000",
            totalAssetWithdrawnRaw: "2000000",
            depositsCount: 99,
            withdrawalsCount: 33,
            rateSnapshots: [
              { rate: "1000", timestamp: 1700001000 },
              { rate: "999", timestamp: 1700000000 },
            ],
          },
        ],
      },
      fetching: false,
      error: null,
    };

    const { result } = renderHook(() => useVaultDetailsSubgraph("0xvault1"));
    const v = result.current.vault!;

    expect(v.apy).toBe(18.0);
    expect(v.tvl).toBe(1000000);
    expect(v.rate).toBe(BigInt("999"));
    expect(v.totalSupply).toBe(BigInt("50000000"));
    expect(v.depositsCount).toBe(99);
    expect(v.withdrawalsCount).toBe(33);
    expect(v.rateSnapshots).toHaveLength(2);
  });

  it("loading state is propagated for single vault query", () => {
    mockQueryResult = { data: null, fetching: true, error: null };
    const { result } = renderHook(() => useVaultDetailsSubgraph("0xvault1"));
    expect(result.current.isLoading).toBe(true);
  });

  it("returns base vault on error for single vault query", () => {
    mockQueryResult = { data: null, fetching: false, error: new Error("Subgraph down") };

    const { result } = renderHook(() => useVaultDetailsSubgraph("0xvault1"));
    expect(result.current.error).toBeInstanceOf(Error);
    // Base vault still returned
    expect(result.current.vault).toBeDefined();
    expect(result.current.vault!.apy).toBe(5.0);
  });
});
