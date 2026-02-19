/**
 * Unit tests for hooks/useAllowance.ts
 *
 * Strategy: vi.mock('wagmi') replaces all wagmi hooks with configurable
 * stubs. We then call useAllowance inside renderHook (jsdom environment)
 * and assert on the stubs' call arguments / return values.
 *
 * react-hot-toast is also mocked so we can assert on toasts without
 * needing a real DOM toast container.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAllowance } from "@/hooks/useAllowance";

// ── Stable mock refs ─────────────────────────────────────────────────────────
const mockRefetch = vi.fn();
const mockWriteContract = vi.fn();
const mockReset = vi.fn();

// Keep mutable state that each test can override before calling the hook.
let mockReadContractReturn: Record<string, unknown> = {};
let mockWriteContractReturn: Record<string, unknown> = {};
let mockWaitForReceiptReturn: Record<string, unknown> = {};
let mockAccountReturn: Record<string, unknown> = {};

vi.mock("wagmi", () => ({
  useAccount: () => mockAccountReturn,
  useReadContract: (args: unknown) => {
    // Record the args so tests can inspect them via a spy.
    useReadContractSpy(args);
    return { data: BigInt(0), refetch: mockRefetch, ...mockReadContractReturn };
  },
  useWriteContract: () => ({
    writeContract: mockWriteContract,
    data: undefined,
    error: null,
    isPending: false,
    reset: mockReset,
    ...mockWriteContractReturn,
  }),
  useWaitForTransactionReceipt: () => ({
    isLoading: false,
    isSuccess: false,
    error: null,
    data: undefined,
    ...mockWaitForReceiptReturn,
  }),
}));

// Spy that captures useReadContract call args (defined after the mock block).
const useReadContractSpy = vi.fn();

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
    loading: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────
const VALID_TOKEN = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC on Eth (valid checksum)
const VALID_SPENDER = "0x1234567890123456789012345678901234567890";
const VALID_OWNER = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";

beforeEach(() => {
  vi.clearAllMocks();
  mockReadContractReturn = {};
  mockWriteContractReturn = {};
  mockWaitForReceiptReturn = {};
  mockAccountReturn = { address: VALID_OWNER };
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("useAllowance — valid addresses", () => {
  it("calls useReadContract with correct contract/function/args", () => {
    renderHook(() => useAllowance(VALID_TOKEN, VALID_SPENDER));

    expect(useReadContractSpy).toHaveBeenCalled();
    const callArgs = useReadContractSpy.mock.calls[0][0] as Record<string, unknown>;

    expect(callArgs.address).toBe(VALID_TOKEN);
    expect(callArgs.functionName).toBe("allowance");
    expect(Array.isArray(callArgs.args)).toBe(true);
    const args = callArgs.args as [string, string];
    expect(args[0]).toBe(VALID_OWNER);   // owner
    expect(args[1]).toBe(VALID_SPENDER); // spender
  });

  it("enables the query when both addresses and account are valid", () => {
    renderHook(() => useAllowance(VALID_TOKEN, VALID_SPENDER));

    const callArgs = useReadContractSpy.mock.calls[0][0] as Record<string, unknown>;
    const query = callArgs.query as Record<string, unknown>;
    expect(query.enabled).toBe(true);
  });

  it("returns allowanceAmount from the contract read result", () => {
    mockReadContractReturn = { data: BigInt(1000) };
    const { result } = renderHook(() => useAllowance(VALID_TOKEN, VALID_SPENDER));
    expect(result.current.allowanceAmount).toBe(BigInt(1000));
  });
});

describe("useAllowance — invalid addresses", () => {
  it("disables the query when token address is not a valid hex address", () => {
    renderHook(() => useAllowance("not-an-address", VALID_SPENDER));

    const callArgs = useReadContractSpy.mock.calls[0][0] as Record<string, unknown>;
    const query = callArgs.query as Record<string, unknown>;
    expect(query.enabled).toBe(false);
  });

  it("disables the query when spender address is invalid", () => {
    renderHook(() => useAllowance(VALID_TOKEN, "bad-spender"));

    const callArgs = useReadContractSpy.mock.calls[0][0] as Record<string, unknown>;
    const query = callArgs.query as Record<string, unknown>;
    expect(query.enabled).toBe(false);
  });

  it("passes undefined as contract address when token is invalid", () => {
    renderHook(() => useAllowance("0xINVALID", VALID_SPENDER));

    const callArgs = useReadContractSpy.mock.calls[0][0] as Record<string, unknown>;
    // Wagmi skips the query when address is undefined — confirm we pass undefined.
    expect(callArgs.address).toBeUndefined();
  });
});

describe("useAllowance — writeAllowance()", () => {
  it("calls writeContract with correct ERC20 approve args (MAX_UINT256 by default)", () => {
    const MAX_UINT256 = BigInt(
      "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    );

    const { result } = renderHook(() => useAllowance(VALID_TOKEN, VALID_SPENDER));

    act(() => {
      result.current.writeAllowance();
    });

    expect(mockWriteContract).toHaveBeenCalledOnce();
    const callArgs = mockWriteContract.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.address).toBe(VALID_TOKEN);
    expect(callArgs.functionName).toBe("approve");
    const args = callArgs.args as [string, bigint];
    expect(args[0]).toBe(VALID_SPENDER);
    expect(args[1]).toBe(MAX_UINT256);
  });

  it("calls writeContract with custom value when provided", () => {
    const { result } = renderHook(() => useAllowance(VALID_TOKEN, VALID_SPENDER));

    act(() => {
      result.current.writeAllowance(BigInt(500));
    });

    const callArgs = mockWriteContract.mock.calls[0][0] as Record<string, unknown>;
    const args = callArgs.args as [string, bigint];
    expect(args[1]).toBe(BigInt(500));
  });

  it("does NOT call writeContract when token address is invalid", async () => {
    const toast = await import("react-hot-toast");
    const { result } = renderHook(() =>
      useAllowance("not-a-valid-address", VALID_SPENDER)
    );

    act(() => {
      result.current.writeAllowance();
    });

    expect(mockWriteContract).not.toHaveBeenCalled();
    // Should show an error toast instead.
    expect((toast.default.error as Mock)).toHaveBeenCalledWith(
      expect.stringContaining("Invalid token address")
    );
  });

  it("does NOT call writeContract when spender address is invalid", async () => {
    const toast = await import("react-hot-toast");
    const { result } = renderHook(() =>
      useAllowance(VALID_TOKEN, "bad-spender")
    );

    act(() => {
      result.current.writeAllowance();
    });

    expect(mockWriteContract).not.toHaveBeenCalled();
    expect((toast.default.error as Mock)).toHaveBeenCalledWith(
      expect.stringContaining("Invalid spender address")
    );
  });
});

describe("useAllowance — success state", () => {
  it("calls refetch after approval is confirmed", () => {
    mockWaitForReceiptReturn = { isSuccess: true, isLoading: false };
    renderHook(() => useAllowance(VALID_TOKEN, VALID_SPENDER));

    // refetch is called synchronously in the useEffect when isSuccess=true.
    expect(mockRefetch).toHaveBeenCalled();
  });
});

describe("useAllowance — error state", () => {
  it("returns the write error from the hook", () => {
    // Use a plain error-like object to avoid vitest treating it as an
    // unhandled global error. The hook only inspects `.message` and `.code`.
    const writeError = { message: "User denied signature", code: 4001 };
    mockWriteContractReturn = { error: writeError };

    const { result } = renderHook(() => useAllowance(VALID_TOKEN, VALID_SPENDER));

    expect(result.current.error).toBe(writeError);
  });

  it("returns the transaction error from the hook", () => {
    const txErr = { message: "Reverted: out of gas" };
    mockWaitForReceiptReturn = { error: txErr };

    const { result } = renderHook(() => useAllowance(VALID_TOKEN, VALID_SPENDER));

    expect(result.current.txError).toBe(txErr);
  });
});
