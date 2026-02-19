/**
 * Unit tests for hooks/useOpportunitiesModals.ts
 *
 * Tests the modal state management hook that controls the deposit/withdraw
 * modal, token selector modal, and selected token state.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOpportunitiesModals } from "@/hooks/useOpportunitiesModals";
import type { TokenType } from "@/lib/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const REAL_DEPOSIT_TOKEN: TokenType = {
  symbol: "CBTC",
  address: "0xabc123cbtcaddress",
  decimals: 18,
  name: "Citrea BTC",
};

const REAL_WITHDRAW_TOKEN: TokenType = {
  symbol: "eCBTC",
  address: "0xecbtcvaulttoken",
  decimals: 18,
  name: "Elitra CBTC",
};

const EMPTY_TOKENS: (TokenType | null | undefined)[] = [];
const DEPOSIT_TOKENS = [REAL_DEPOSIT_TOKEN];
const WITHDRAW_TOKENS = [REAL_WITHDRAW_TOKEN];

beforeEach(() => {
  // No global state to reset — hooks are isolated per renderHook call
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useOpportunitiesModals — initial state", () => {
  it("all modals start closed", () => {
    const { result } = renderHook(() =>
      useOpportunitiesModals({
        depositTokens: EMPTY_TOKENS,
        withdrawTokens: [],
      })
    );

    expect(result.current.isModalOpen).toBe(false);
    expect(result.current.isTokenSelectorOpen).toBe(false);
  });

  it("amount starts as empty string", () => {
    const { result } = renderHook(() =>
      useOpportunitiesModals({
        depositTokens: EMPTY_TOKENS,
        withdrawTokens: [],
      })
    );

    expect(result.current.amount).toBe("");
  });

  it("default modalType is 'deposit'", () => {
    const { result } = renderHook(() =>
      useOpportunitiesModals({
        depositTokens: EMPTY_TOKENS,
        withdrawTokens: [],
      })
    );

    expect(result.current.modalType).toBe("deposit");
  });

  it("selectedToken starts with placeholder address when no tokens provided", () => {
    const { result } = renderHook(() =>
      useOpportunitiesModals({
        depositTokens: EMPTY_TOKENS,
        withdrawTokens: [],
      })
    );

    // Default deposit token has placeholder "0xusdc" address
    expect(result.current.selectedToken.address).toBe("0xusdc");
    expect(result.current.selectedToken.symbol).toBe("USDC");
  });
});

describe("useOpportunitiesModals — openDepositModal (setIsModalOpen)", () => {
  it("sets isModalOpen to true", () => {
    const { result } = renderHook(() =>
      useOpportunitiesModals({
        depositTokens: DEPOSIT_TOKENS,
        withdrawTokens: WITHDRAW_TOKENS,
      })
    );

    act(() => {
      result.current.setIsModalOpen(true);
    });

    expect(result.current.isModalOpen).toBe(true);
  });

  it("does not change modalType (remains 'deposit')", () => {
    const { result } = renderHook(() =>
      useOpportunitiesModals({
        depositTokens: DEPOSIT_TOKENS,
        withdrawTokens: WITHDRAW_TOKENS,
      })
    );

    act(() => {
      result.current.setIsModalOpen(true);
    });

    expect(result.current.modalType).toBe("deposit");
  });

  it("setSelectedToken updates the selected token before opening", () => {
    const { result } = renderHook(() =>
      useOpportunitiesModals({
        depositTokens: DEPOSIT_TOKENS,
        withdrawTokens: WITHDRAW_TOKENS,
      })
    );

    act(() => {
      result.current.setSelectedToken(REAL_DEPOSIT_TOKEN);
      result.current.setIsModalOpen(true);
    });

    expect(result.current.isModalOpen).toBe(true);
    expect(result.current.selectedToken.symbol).toBe("CBTC");
  });
});

describe("useOpportunitiesModals — closeModal", () => {
  it("setIsModalOpen(false) closes the modal", () => {
    const { result } = renderHook(() =>
      useOpportunitiesModals({
        depositTokens: DEPOSIT_TOKENS,
        withdrawTokens: WITHDRAW_TOKENS,
      })
    );

    act(() => {
      result.current.setIsModalOpen(true);
    });
    act(() => {
      result.current.setIsModalOpen(false);
    });

    expect(result.current.isModalOpen).toBe(false);
  });

  it("setAmount('') resets the amount independently of modal state", () => {
    const { result } = renderHook(() =>
      useOpportunitiesModals({
        depositTokens: DEPOSIT_TOKENS,
        withdrawTokens: WITHDRAW_TOKENS,
      })
    );

    act(() => {
      result.current.setIsModalOpen(true);
      result.current.setAmount("999");
    });

    expect(result.current.amount).toBe("999");

    act(() => {
      result.current.setIsModalOpen(false);
      result.current.setAmount("");
    });

    expect(result.current.isModalOpen).toBe(false);
    expect(result.current.amount).toBe("");
  });

  it("closing modal does not reset selectedToken", () => {
    const { result } = renderHook(() =>
      useOpportunitiesModals({
        depositTokens: DEPOSIT_TOKENS,
        withdrawTokens: WITHDRAW_TOKENS,
      })
    );

    act(() => {
      result.current.setSelectedToken(REAL_DEPOSIT_TOKEN);
      result.current.setIsModalOpen(true);
    });
    act(() => {
      result.current.setIsModalOpen(false);
    });

    // Token should remain set after close
    expect(result.current.selectedToken.symbol).toBe("CBTC");
  });
});

describe("useOpportunitiesModals — default-token selection effect", () => {
  it("updates selectedToken when real deposit tokens arrive (placeholder → real)", () => {
    const { result, rerender } = renderHook(
      (props: { depositTokens: (TokenType | null | undefined)[] }) =>
        useOpportunitiesModals({
          depositTokens: props.depositTokens,
          withdrawTokens: WITHDRAW_TOKENS,
        }),
      { initialProps: { depositTokens: EMPTY_TOKENS } }
    );

    // Initially placeholder
    expect(result.current.selectedToken.address).toBe("0xusdc");

    // Provide real tokens — effect should fire and update selectedToken
    act(() => {
      rerender({ depositTokens: DEPOSIT_TOKENS });
    });

    expect(result.current.selectedToken.address).toBe(
      REAL_DEPOSIT_TOKEN.address
    );
    expect(result.current.selectedToken.symbol).toBe("CBTC");
  });

  it("does NOT override manually selected token (non-placeholder address)", () => {
    // Start immediately with tokens so selectedToken is real from the start
    const { result, rerender } = renderHook(
      (props: { depositTokens: (TokenType | null | undefined)[] }) =>
        useOpportunitiesModals({
          depositTokens: props.depositTokens,
          withdrawTokens: WITHDRAW_TOKENS,
        }),
      { initialProps: { depositTokens: DEPOSIT_TOKENS } }
    );

    const customToken: TokenType = {
      symbol: "WBTC",
      address: "0xcustomwbtc",
      decimals: 8,
      name: "Wrapped BTC",
    };

    // Manually pick a different token
    act(() => {
      result.current.setSelectedToken(customToken);
    });

    // Re-render with different tokens
    const newTokens: TokenType[] = [
      { symbol: "USDC", address: "0xnewusdc", decimals: 6, name: "USD Coin" },
    ];
    act(() => {
      rerender({ depositTokens: newTokens });
    });

    // Manual selection should NOT be overridden because address !== "0xusdc"
    expect(result.current.selectedToken.symbol).toBe("WBTC");
    expect(result.current.selectedToken.address).toBe("0xcustomwbtc");
  });
});

describe("useOpportunitiesModals — token selector modal", () => {
  it("setIsTokenSelectorOpen toggles the token selector", () => {
    const { result } = renderHook(() =>
      useOpportunitiesModals({
        depositTokens: DEPOSIT_TOKENS,
        withdrawTokens: WITHDRAW_TOKENS,
      })
    );

    act(() => {
      result.current.setIsTokenSelectorOpen(true);
    });
    expect(result.current.isTokenSelectorOpen).toBe(true);

    act(() => {
      result.current.setIsTokenSelectorOpen(false);
    });
    expect(result.current.isTokenSelectorOpen).toBe(false);
  });
});

describe("useOpportunitiesModals — amount management", () => {
  it("setAmount updates the amount state", () => {
    const { result } = renderHook(() =>
      useOpportunitiesModals({
        depositTokens: DEPOSIT_TOKENS,
        withdrawTokens: WITHDRAW_TOKENS,
      })
    );

    act(() => {
      result.current.setAmount("123.45");
    });

    expect(result.current.amount).toBe("123.45");
  });

  it("setAmount accepts decimal strings", () => {
    const { result } = renderHook(() =>
      useOpportunitiesModals({
        depositTokens: DEPOSIT_TOKENS,
        withdrawTokens: WITHDRAW_TOKENS,
      })
    );

    act(() => {
      result.current.setAmount("0.00001");
    });

    expect(result.current.amount).toBe("0.00001");
  });
});
