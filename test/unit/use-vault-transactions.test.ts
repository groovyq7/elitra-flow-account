/**
 * Unit tests for hooks/use-vault-transactions.ts
 *
 * Despite its name, this file exports `useBalance` and `useTotalSupply` —
 * wagmi-based hooks that read ERC20/ERC4626 balance and total supply.
 *
 * Strategy: mock wagmi hooks so we can control contract reads. Assert that:
 *  - balance/totalSupply is 0n when account is not connected
 *  - amounts are formatted correctly for 6-decimal (USDC) and 18-decimal tokens
 *  - decimals fall back to 18 when the decimals call returns undefined
 *  - refetch is surfaced from the balance hook
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBalance, useTotalSupply } from "@/hooks/use-vault-transactions";

// ── Mutable stub state ────────────────────────────────────────────────────────
let mockAddress: `0x${string}` | undefined = "0xUserAddress" as `0x${string}`;

/** Controls what useReadContract returns per call index (decimals first, balance second). */
let readContractCallCount = 0;
const readContractReturns: Array<{ data: unknown; refetch?: () => void }> = [];

const mockRefetch = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: mockAddress }),
  useReadContract: () => {
    const idx = readContractCallCount++;
    return readContractReturns[idx] ?? { data: undefined, refetch: mockRefetch };
  },
}));

vi.mock("viem", async () => {
  const actual = await vi.importActual<typeof import("viem")>("viem");
  return {
    ...actual,
    erc20Abi: [],
  };
});

vi.mock("@/lib/contracts/vault-abi", () => ({
  VAULT_ABI: [],
  ERC20_ABI: [],
}));

// ── Helpers ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockAddress = "0xUserAddress" as `0x${string}`;
  readContractCallCount = 0;
  readContractReturns.length = 0;
});

function setReadContractReturns(
  decimalsReturn: { data: unknown; refetch?: () => void },
  balanceReturn: { data: unknown; refetch?: () => void },
) {
  readContractReturns[0] = decimalsReturn;
  readContractReturns[1] = balanceReturn;
}

const TOKEN_6DEC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC (6 decimals)
const TOKEN_18DEC = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // WETH (18 decimals)

// ─────────────────────────────────────────────────────────────────────────────
// useBalance
// ─────────────────────────────────────────────────────────────────────────────

describe("useBalance — not connected", () => {
  it("returns balance of 0n when wallet is not connected", () => {
    mockAddress = undefined;
    setReadContractReturns(
      { data: 18 },
      { data: undefined, refetch: mockRefetch },
    );

    const { result } = renderHook(() => useBalance(TOKEN_18DEC));

    expect(result.current.balance).toBe(BigInt(0));
    // viem formatUnits returns "0" (not "0.0") for zero
    expect(result.current.formattedBalance).toBe("0");
  });
});

describe("useBalance — 18-decimal token", () => {
  it("formats 1 ether (1e18) correctly as '1'", () => {
    setReadContractReturns(
      { data: 18 },
      { data: BigInt("1000000000000000000"), refetch: mockRefetch },
    );

    const { result } = renderHook(() => useBalance(TOKEN_18DEC));

    expect(result.current.decimals).toBe(18);
    expect(result.current.balance).toBe(BigInt("1000000000000000000"));
    // viem formatUnits returns "1" (not "1.0") for whole numbers
    expect(result.current.formattedBalance).toBe("1");
  });

  it("formats 0.5 ether (5e17) correctly", () => {
    setReadContractReturns(
      { data: 18 },
      { data: BigInt("500000000000000000"), refetch: mockRefetch },
    );

    const { result } = renderHook(() => useBalance(TOKEN_18DEC));
    expect(result.current.formattedBalance).toBe("0.5");
  });
});

describe("useBalance — 6-decimal token (USDC)", () => {
  it("formats 1 USDC (1e6) correctly as '1'", () => {
    setReadContractReturns(
      { data: 6 },
      { data: BigInt("1000000"), refetch: mockRefetch },
    );

    const { result } = renderHook(() => useBalance(TOKEN_6DEC));

    expect(result.current.decimals).toBe(6);
    expect(result.current.balance).toBe(BigInt("1000000"));
    // viem formatUnits returns "1" (not "1.0") for whole numbers
    expect(result.current.formattedBalance).toBe("1");
  });

  it("formats 100 USDC (1e8) correctly", () => {
    setReadContractReturns(
      { data: 6 },
      { data: BigInt("100000000"), refetch: mockRefetch },
    );

    const { result } = renderHook(() => useBalance(TOKEN_6DEC));
    expect(result.current.formattedBalance).toBe("100");
  });

  it("formats 0.5 USDC (500000) correctly", () => {
    setReadContractReturns(
      { data: 6 },
      { data: BigInt("500000"), refetch: mockRefetch },
    );

    const { result } = renderHook(() => useBalance(TOKEN_6DEC));
    expect(result.current.formattedBalance).toBe("0.5");
  });
});

describe("useBalance — decimals fallback", () => {
  it("falls back to 18 decimals when decimals read returns undefined", () => {
    setReadContractReturns(
      { data: undefined },
      { data: BigInt("1000000000000000000"), refetch: mockRefetch },
    );

    const { result } = renderHook(() => useBalance(TOKEN_18DEC));

    expect(result.current.decimals).toBe(18);
    expect(result.current.formattedBalance).toBe("1");
  });

  it("handles decimals returned as BigInt (converts to number)", () => {
    setReadContractReturns(
      { data: BigInt(8) }, // Some contracts return decimals as BigInt
      { data: BigInt("100000000"), refetch: mockRefetch },
    );

    const { result } = renderHook(() => useBalance("0xCBTC" as `0x${string}`));

    expect(result.current.decimals).toBe(8);
    expect(result.current.formattedBalance).toBe("1");
  });
});

describe("useBalance — refetch", () => {
  it("exposes the refetch function from balance read", () => {
    setReadContractReturns(
      { data: 18 },
      { data: BigInt(0), refetch: mockRefetch },
    );

    const { result } = renderHook(() => useBalance(TOKEN_18DEC));
    expect(typeof result.current.refetch).toBe("function");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useTotalSupply
// ─────────────────────────────────────────────────────────────────────────────

describe("useTotalSupply — 18-decimal token", () => {
  it("formats total supply of 1e18 as '1'", () => {
    setReadContractReturns(
      { data: 18 },
      { data: BigInt("1000000000000000000") },
    );

    const { result } = renderHook(() => useTotalSupply(TOKEN_18DEC));

    expect(result.current.decimals).toBe(18);
    expect(result.current.totalSupply).toBe(BigInt("1000000000000000000"));
    // viem formatUnits returns "1" (not "1.0") for whole numbers
    expect(result.current.formattedTotalSupply).toBe("1");
  });

  it("formats large total supply correctly", () => {
    setReadContractReturns(
      { data: 18 },
      { data: BigInt("1000000000000000000000000") }, // 1 million tokens
    );

    const { result } = renderHook(() => useTotalSupply(TOKEN_18DEC));
    expect(result.current.formattedTotalSupply).toBe("1000000");
  });
});

describe("useTotalSupply — 6-decimal token (USDC vault)", () => {
  it("formats 1 USDC supply (1e6) correctly", () => {
    setReadContractReturns(
      { data: 6 },
      { data: BigInt("1000000") },
    );

    const { result } = renderHook(() => useTotalSupply(TOKEN_6DEC));

    expect(result.current.decimals).toBe(6);
    expect(result.current.formattedTotalSupply).toBe("1");
  });

  it("formats large USDC supply correctly", () => {
    setReadContractReturns(
      { data: 6 },
      { data: BigInt("50000000000000") }, // 50_000_000 USDC
    );

    const { result } = renderHook(() => useTotalSupply(TOKEN_6DEC));
    expect(result.current.formattedTotalSupply).toBe("50000000");
  });
});

describe("useTotalSupply — decimals fallback", () => {
  it("falls back to 18 decimals when decimals read returns undefined", () => {
    setReadContractReturns(
      { data: undefined },
      { data: BigInt("1000000000000000000") },
    );

    const { result } = renderHook(() => useTotalSupply(TOKEN_18DEC));
    expect(result.current.decimals).toBe(18);
    expect(result.current.formattedTotalSupply).toBe("1");
  });
});

describe("useTotalSupply — zero supply", () => {
  it("returns 0n totalSupply and '0' when data is undefined", () => {
    setReadContractReturns(
      { data: 18 },
      { data: undefined },
    );

    const { result } = renderHook(() => useTotalSupply(TOKEN_18DEC));
    expect(result.current.totalSupply).toBe(BigInt(0));
    // viem formatUnits(0n, 18) returns "0.0" ... actually it returns "0"
    expect(result.current.formattedTotalSupply).toBe("0");
  });
});
