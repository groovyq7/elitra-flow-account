/**
 * Unit tests for hooks/useContractTransaction.ts
 *
 * Strategy: vi.mock('wagmi') stubs useWriteContract and
 * useWaitForTransactionReceipt. vi.mock('react-hot-toast') captures toast
 * calls. We then call useContractTransaction inside renderHook and assert
 * on toast behaviour, state transitions, and the toastId management that
 * ensures only our own toast is dismissed (never toast.dismissAll()).
 *
 * NOTE: vi.mock factories are hoisted to the top of the file by vitest.
 * Variables that are referenced inside a factory must be declared with
 * vi.hoisted() so they're initialised before the factory runs.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { renderHook } from "@testing-library/react";
import { useContractTransaction } from "@/hooks/useContractTransaction";

// ── Hoisted mocks (available before module-level mock factories run) ─────────
const {
  mockWriteContract,
  mockReset,
  mockToastLoading,
  mockToastSuccess,
  mockToastError,
  mockToastDismiss,
  mockToastDismissAll,
  getMockWriteReturn,
  getMockReceiptReturn,
  setMockWriteReturn,
  setMockReceiptReturn,
} = vi.hoisted(() => {
  let _writeReturn: Record<string, unknown> = {};
  let _receiptReturn: Record<string, unknown> = {};

  return {
    mockWriteContract: vi.fn(),
    mockReset: vi.fn(),
    mockToastLoading: vi.fn().mockReturnValue("toast-id-1"),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockToastDismiss: vi.fn(),
    mockToastDismissAll: vi.fn(),
    getMockWriteReturn: () => _writeReturn,
    getMockReceiptReturn: () => _receiptReturn,
    setMockWriteReturn: (v: Record<string, unknown>) => { _writeReturn = v; },
    setMockReceiptReturn: (v: Record<string, unknown>) => { _receiptReturn = v; },
  };
});

vi.mock("wagmi", () => ({
  useWriteContract: () => ({
    writeContract: mockWriteContract,
    data: undefined,
    error: null,
    isPending: false,
    reset: mockReset,
    ...getMockWriteReturn(),
  }),
  useWaitForTransactionReceipt: () => ({
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    ...getMockReceiptReturn(),
  }),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    loading: mockToastLoading,
    success: mockToastSuccess,
    error: mockToastError,
    dismiss: mockToastDismiss,
    dismissAll: mockToastDismissAll,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  setMockWriteReturn({});
  setMockReceiptReturn({});
  mockToastLoading.mockReturnValue("toast-id-1");
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("useContractTransaction — isPending state", () => {
  it("shows a loading toast with the label when wallet confirmation is pending", () => {
    setMockWriteReturn({ isPending: true });

    renderHook(() => useContractTransaction("Deposit"));

    expect(mockToastLoading).toHaveBeenCalledWith(
      expect.stringContaining("Deposit"),
      expect.anything()
    );
    expect(mockToastLoading).toHaveBeenCalledWith(
      expect.stringContaining("Waiting for wallet confirmation"),
      expect.anything()
    );
  });

  it("shows a loading toast with the label when transaction is confirming on-chain", () => {
    setMockReceiptReturn({ isLoading: true });

    renderHook(() => useContractTransaction("Withdraw"));

    expect(mockToastLoading).toHaveBeenCalledWith(
      expect.stringContaining("Withdraw"),
      expect.anything()
    );
    expect(mockToastLoading).toHaveBeenCalledWith(
      expect.stringContaining("confirmation"),
      expect.anything()
    );
  });

  it("returns isLoading=true when isPending is true", () => {
    setMockWriteReturn({ isPending: true });
    const { result } = renderHook(() => useContractTransaction("Deposit"));
    expect(result.current.isLoading).toBe(true);
  });

  it("returns isLoading=true when isConfirming is true", () => {
    setMockReceiptReturn({ isLoading: true });
    const { result } = renderHook(() => useContractTransaction("Deposit"));
    expect(result.current.isLoading).toBe(true);
  });
});

describe("useContractTransaction — isSuccess state", () => {
  it("shows a success toast with the label when the transaction succeeds", () => {
    setMockReceiptReturn({ isSuccess: true });

    renderHook(() => useContractTransaction("Deposit"));

    expect(mockToastSuccess).toHaveBeenCalledWith(
      expect.stringContaining("Deposit"),
      expect.anything()
    );
    expect(mockToastSuccess).toHaveBeenCalledWith(
      expect.stringContaining("successful"),
      expect.anything()
    );
  });

  it("does NOT call toast.dismissAll() on success — only dismisses its own toast", () => {
    setMockReceiptReturn({ isSuccess: true });
    renderHook(() => useContractTransaction("Deposit"));

    // The hook must NEVER call dismissAll — that would kill unrelated toasts.
    expect(mockToastDismissAll).not.toHaveBeenCalled();
  });

  it("returns isSuccess=true from the hook", () => {
    setMockReceiptReturn({ isSuccess: true });
    const { result } = renderHook(() => useContractTransaction("Deposit"));
    expect(result.current.isSuccess).toBe(true);
  });
});

describe("useContractTransaction — error state", () => {
  it("shows an error toast with the label on write error", () => {
    setMockWriteReturn({ error: { message: "User rejected", code: 4001 } });

    renderHook(() => useContractTransaction("Withdraw"));

    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringContaining("Withdraw"),
      expect.anything()
    );
    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringContaining("failed"),
      expect.anything()
    );
  });

  it("shows an error toast with the label on transaction receipt error", () => {
    setMockReceiptReturn({ error: { message: "Reverted: out of gas" } });

    renderHook(() => useContractTransaction("Deposit"));

    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringContaining("Deposit"),
      expect.anything()
    );
  });

  it("returns the write error via result.error", () => {
    const err = { message: "rejected", code: 4001 };
    setMockWriteReturn({ error: err });

    const { result } = renderHook(() => useContractTransaction("Deposit"));

    expect(result.current.error).toBe(err);
  });

  it("returns the tx error via result.error when write succeeded but tx failed", () => {
    const txErr = { message: "gas reverted" };
    setMockReceiptReturn({ error: txErr });

    const { result } = renderHook(() => useContractTransaction("Deposit"));

    expect(result.current.error).toBe(txErr);
  });

  it("does NOT call toast.dismissAll() on error — only manages its own toast", () => {
    setMockWriteReturn({ error: { message: "rejected", code: 4001 } });
    renderHook(() => useContractTransaction("Deposit"));

    expect(mockToastDismissAll).not.toHaveBeenCalled();
  });
});

describe("useContractTransaction — toast ID management", () => {
  it("passes the toast ID returned by the loading toast into the success toast", () => {
    // The hook's toastId management:
    //   1. isPending: toast.loading(text, { id: undefined }) → returns "toast-id-1"
    //      Hook stores "toast-id-1" in toastId.current.
    //   2. isSuccess: toast.success(text, { id: "toast-id-1" })
    //      The same ID is used to UPDATE (not create) the toast in place.
    // This ensures only our toast changes, never calling toast.dismissAll().

    // mockToastLoading is configured to return "toast-id-1" in beforeEach.

    // First render: isPending = true → loading toast fires.
    setMockWriteReturn({ isPending: true });
    const { rerender } = renderHook(() => useContractTransaction("Deposit"));

    expect(mockToastLoading).toHaveBeenCalledOnce();

    // Second render: transition to isSuccess.
    setMockWriteReturn({ isPending: false });
    setMockReceiptReturn({ isSuccess: true });
    rerender();

    // Success toast should carry the ID returned by the loading toast.
    expect(mockToastSuccess).toHaveBeenCalledOnce();
    const successCall = (mockToastSuccess as Mock).mock.calls[0];
    const idFromSuccess = successCall[1]?.id;
    expect(idFromSuccess).toBe("toast-id-1"); // matches what mockToastLoading returned
  });

  it("exposes execute = writeContract from wagmi", () => {
    const { result } = renderHook(() => useContractTransaction("Deposit"));
    expect(result.current.execute).toBe(mockWriteContract);
  });
});
