import { describe, it, expect } from "vitest";
import { ErrorHandler } from "@/services/ErrorHandler";

describe("ErrorHandler.handleError", () => {
  // ── User rejection ──────────────────────────────────────────────────────────

  it("returns 'Transaction rejected by user' for numeric code 4001", () => {
    const error = { code: 4001, message: "User rejected" };
    expect(ErrorHandler.handleError(error)).toBe("Transaction rejected by user");
  });

  it("returns 'Transaction rejected by user' for nested cause.code 4001", () => {
    const error = { cause: { code: 4001, details: "", shortMessage: "", name: "" } };
    expect(ErrorHandler.handleError(error)).toBe("Transaction rejected by user");
  });

  it("returns 'Transaction rejected by user' for viem ACTION_REJECTED code", () => {
    const error = { code: "ACTION_REJECTED", message: "User rejected the request" };
    expect(ErrorHandler.handleError(error)).toBe("Transaction rejected by user");
  });

  it("returns 'Transaction rejected by user' for viem ACTION_REJECTED in cause", () => {
    const error = { cause: { code: "ACTION_REJECTED", details: "", shortMessage: "", name: "" } };
    expect(ErrorHandler.handleError(error)).toBe("Transaction rejected by user");
  });

  // ── Elitra/vault-specific patterns ──────────────────────────────────────────

  it("returns 'Insufficient token balance' for insufficient balance message", () => {
    const error = { message: "execution reverted: insufficient balance" };
    expect(ErrorHandler.handleError(error)).toBe("Insufficient token balance");
  });

  it("returns 'Insufficient token balance' for transfer amount exceeds balance", () => {
    const error = { message: "transfer amount exceeds balance" };
    expect(ErrorHandler.handleError(error)).toBe("Insufficient token balance");
  });

  it("returns 'Token approval required' for allowance error", () => {
    const error = { message: "ERC20: insufficient allowance" };
    expect(ErrorHandler.handleError(error)).toBe(
      "Token approval required — please approve first"
    );
  });

  it("returns 'Token approval required' for generic allowance message", () => {
    const error = { message: "check allowance before proceeding" };
    expect(ErrorHandler.handleError(error)).toBe(
      "Token approval required — please approve first"
    );
  });

  it("returns vault transfer failure for SafeTransferFrom in message", () => {
    const error = { message: "SafeTransferFrom failed" };
    expect(ErrorHandler.handleError(error)).toBe(
      "Token transfer failed — check your balance and approval"
    );
  });

  it("returns vault transfer failure for safeTransferFrom in message", () => {
    const error = { shortMessage: "call to safeTransferFrom reverted" };
    expect(ErrorHandler.handleError(error)).toBe(
      "Token transfer failed — check your balance and approval"
    );
  });

  it("returns 'Price moved — try again' for minimumMint revert", () => {
    // In wagmi/viem, the revert reason appears in shortMessage or details.
    const error = {
      shortMessage: "The contract function reverted: minimumMint not satisfied",
    };
    expect(ErrorHandler.handleError(error)).toBe("Price moved — try again");
  });

  it("returns 'Price moved — try again' for minimum shares revert", () => {
    const error = { message: "minimum shares not met" };
    expect(ErrorHandler.handleError(error)).toBe("Price moved — try again");
  });

  it("returns 'Slippage too high — try again' for minimumAssets revert", () => {
    const error = { message: "minimumAssets exceeded" };
    expect(ErrorHandler.handleError(error)).toBe("Slippage too high — try again");
  });

  // ── Generic contract errors ─────────────────────────────────────────────────

  it("returns 'Token transfer failed' for TRANSFER_FAILED", () => {
    const error = { message: "execution reverted: TRANSFER_FAILED" };
    expect(ErrorHandler.handleError(error)).toBe("Token transfer failed");
  });

  it("returns 'Transaction expired' for EXPIRED", () => {
    const error = { message: "EXPIRED" };
    expect(ErrorHandler.handleError(error)).toBe("Transaction expired");
  });

  // ── Network errors ──────────────────────────────────────────────────────────

  it("returns network error message for 'Network Error' in message", () => {
    const error = { message: "Network Error" };
    expect(ErrorHandler.handleError(error)).toBe(
      "Network error - please check your connection"
    );
  });

  // ── Fallback ────────────────────────────────────────────────────────────────

  it("returns the raw error message for an unknown error with a message", () => {
    const error = { message: "Something totally unexpected happened" };
    const result = ErrorHandler.handleError(error);
    expect(result).toBe("Something totally unexpected happened");
  });

  it("returns 'Please try again later' for a completely unknown error", () => {
    const error = {};
    expect(ErrorHandler.handleError(error)).toBe("Please try again later");
  });

  it("returns 'Please try again later' for null/undefined error", () => {
    expect(ErrorHandler.handleError(null)).toBe("Please try again later");
    expect(ErrorHandler.handleError(undefined)).toBe("Please try again later");
  });

  // ── Revert reason extraction ────────────────────────────────────────────────

  it("extracts a revert reason string from a verbose error message", () => {
    const error = {
      message: "Transaction reverted with reason string 'custom revert reason'",
    };
    expect(ErrorHandler.handleError(error)).toBe("custom revert reason");
  });

  // ── Gas errors ──────────────────────────────────────────────────────────────

  it("returns 'Not enough gas' for error message containing 'gas'", () => {
    const error = { message: "insufficient gas for transaction" };
    expect(ErrorHandler.handleError(error)).toBe(
      "Not enough gas, increase gas limit"
    );
  });

  // ── STF (SafeTransferFrom shorthand) ────────────────────────────────────────

  it("returns 'Token transfer failed' for 'STF' in message (Solidity shorthand)", () => {
    const error = { message: "execution reverted: STF" };
    expect(ErrorHandler.handleError(error)).toBe("Token transfer failed");
  });

  // ── Server error ─────────────────────────────────────────────────────────────

  it("returns 'Server error' for SERVER_ERROR code", () => {
    const error = { code: "SERVER_ERROR", message: "internal server error" };
    expect(ErrorHandler.handleError(error)).toBe(
      "Server error - please try again later"
    );
  });

  // ── data.message priority ────────────────────────────────────────────────────

  it("prefers error.data.message over error.message for pattern matching", () => {
    const error = {
      message: "some generic message",
      data: { message: "ERC20: insufficient allowance" },
    };
    expect(ErrorHandler.handleError(error)).toBe(
      "Token approval required — please approve first"
    );
  });

  // ── cause.shortMessage for viem errors ───────────────────────────────────────

  it("uses cause.shortMessage for pattern matching (viem nested errors)", () => {
    const error = {
      cause: {
        code: 0,
        details: "",
        shortMessage: "minimumMint not satisfied",
        name: "ContractFunctionRevertedError",
      },
    };
    expect(ErrorHandler.handleError(error)).toBe("Price moved — try again");
  });

  // ── getReadableErrorMessage ─────────────────────────────────────────────────

  it("capitalises the first letter of a message", () => {
    expect(ErrorHandler.getReadableErrorMessage("hello world")).toBe(
      "Hello world"
    );
  });

  it("returns empty string for empty input", () => {
    expect(ErrorHandler.getReadableErrorMessage("")).toBe("");
  });
});
