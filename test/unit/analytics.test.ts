import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Use vi.hoisted so mock functions are available inside the vi.mock factory,
// which is hoisted to the top of the file by Vitest's transform.
// ---------------------------------------------------------------------------
const { mockCapture, mockIdentify, mockReset } = vi.hoisted(() => ({
  mockCapture: vi.fn(),
  mockIdentify: vi.fn(),
  mockReset: vi.fn(),
}));

vi.mock("posthog-js", () => ({
  default: {
    capture: mockCapture,
    identify: mockIdentify,
    reset: mockReset,
  },
}));

// Import analytics AFTER the mock is registered
import {
  track,
  trackDepositAttempt,
  trackDepositSuccess,
  trackDepositFailed,
  trackWithdrawAttempt,
  trackWithdrawSuccess,
  trackWithdrawFailed,
  trackModalOpen,
  trackWalletConnected,
  trackApprovalAttempt,
  trackApprovalResult,
  identifyUser,
  resetUser,
} from "@/lib/analytics";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearMocks() {
  mockCapture.mockClear();
  mockIdentify.mockClear();
  mockReset.mockClear();
}

// ---------------------------------------------------------------------------
// safeCapture — common behaviour
// ---------------------------------------------------------------------------

describe("safeCapture — common event properties", () => {
  beforeEach(clearMocks);

  it("attaches path, search, and ts to every event", () => {
    // jsdom provides window.location — path defaults to '/' and search to ''
    track("test_event", { foo: "bar" });

    expect(mockCapture).toHaveBeenCalledOnce();
    const [, props] = mockCapture.mock.calls[0];
    expect(props).toMatchObject({
      foo: "bar",
      path: expect.any(String),
      search: expect.any(String),
      ts: expect.any(Number),
    });
  });

  it("ts is a recent unix timestamp (ms)", () => {
    const before = Date.now();
    track("ts_test");
    const after = Date.now();

    const [, props] = mockCapture.mock.calls[0];
    expect(props.ts).toBeGreaterThanOrEqual(before);
    expect(props.ts).toBeLessThanOrEqual(after);
  });

  it("is a no-op when window is undefined (server environment)", () => {
    // Temporarily remove window to simulate SSR
    const originalWindow = globalThis.window;
    // @ts-expect-error — intentionally deleting window to simulate server
    delete globalThis.window;

    track("server_event");

    expect(mockCapture).not.toHaveBeenCalled();

    globalThis.window = originalWindow;
  });
});

// ---------------------------------------------------------------------------
// trackDepositAttempt
// ---------------------------------------------------------------------------

describe("trackDepositAttempt", () => {
  beforeEach(clearMocks);

  it("calls safeCapture with event name 'deposit_attempt'", () => {
    trackDepositAttempt({ tokenSymbol: "USDC", amount: "100" });

    expect(mockCapture).toHaveBeenCalledOnce();
    const [event, props] = mockCapture.mock.calls[0];
    expect(event).toBe("deposit_attempt");
    expect(props).toMatchObject({ tokenSymbol: "USDC", amount: "100" });
  });
});

// ---------------------------------------------------------------------------
// trackDepositSuccess / trackDepositFailed
// ---------------------------------------------------------------------------

describe("trackDepositSuccess", () => {
  beforeEach(clearMocks);

  it("fires 'deposit_success' event with provided properties", () => {
    trackDepositSuccess({ txHash: "0xabc", tokenSymbol: "WBTC" });

    const [event, props] = mockCapture.mock.calls[0];
    expect(event).toBe("deposit_success");
    expect(props).toMatchObject({ txHash: "0xabc", tokenSymbol: "WBTC" });
  });
});

describe("trackDepositFailed", () => {
  beforeEach(clearMocks);

  it("fires 'deposit_failed' event with provided properties", () => {
    trackDepositFailed({ reason: "user rejected", tokenSymbol: "USDC" });

    const [event, props] = mockCapture.mock.calls[0];
    expect(event).toBe("deposit_failed");
    expect(props).toMatchObject({ reason: "user rejected", tokenSymbol: "USDC" });
  });
});

// ---------------------------------------------------------------------------
// trackWithdrawAttempt / Success / Failed
// ---------------------------------------------------------------------------

describe("trackWithdrawAttempt", () => {
  beforeEach(clearMocks);

  it("fires 'withdraw_attempt'", () => {
    trackWithdrawAttempt({ tokenSymbol: "eCBTC", amount: "0.5" });
    const [event] = mockCapture.mock.calls[0];
    expect(event).toBe("withdraw_attempt");
  });
});

describe("trackWithdrawSuccess", () => {
  beforeEach(clearMocks);

  it("fires 'withdraw_success' with correct properties", () => {
    trackWithdrawSuccess({ type: "spice_withdraw", tokenSymbol: "eCBTC" });

    const [event, props] = mockCapture.mock.calls[0];
    expect(event).toBe("withdraw_success");
    expect(props).toMatchObject({ type: "spice_withdraw", tokenSymbol: "eCBTC" });
  });
});

describe("trackWithdrawFailed", () => {
  beforeEach(clearMocks);

  it("fires 'withdraw_failed' with correct properties", () => {
    trackWithdrawFailed({ reason: "reverted", tokenSymbol: "eCBTC" });

    const [event, props] = mockCapture.mock.calls[0];
    expect(event).toBe("withdraw_failed");
    expect(props).toMatchObject({ reason: "reverted" });
  });
});

// ---------------------------------------------------------------------------
// trackModalOpen
// ---------------------------------------------------------------------------

describe("trackModalOpen", () => {
  beforeEach(clearMocks);

  it("fires 'modal_open' with modal name property", () => {
    trackModalOpen("deposit");

    const [event, props] = mockCapture.mock.calls[0];
    expect(event).toBe("modal_open");
    expect(props).toMatchObject({ modal: "deposit" });
  });
});

// ---------------------------------------------------------------------------
// trackWalletConnected
// ---------------------------------------------------------------------------

describe("trackWalletConnected", () => {
  beforeEach(clearMocks);

  it("fires 'wallet_connected' with lowercase address", () => {
    trackWalletConnected("0xABCDEF");

    const [event, props] = mockCapture.mock.calls[0];
    expect(event).toBe("wallet_connected");
    // address is lowercased inside the function
    expect(props.address).toBe("0xabcdef");
  });
});

// ---------------------------------------------------------------------------
// trackApprovalAttempt / trackApprovalResult
// ---------------------------------------------------------------------------

describe("trackApprovalAttempt", () => {
  beforeEach(clearMocks);

  it("fires 'approval_attempt' with token info and stringified amount", () => {
    trackApprovalAttempt("USDC", "0xtoken", 1000n);

    const [event, props] = mockCapture.mock.calls[0];
    expect(event).toBe("approval_attempt");
    expect(props).toMatchObject({
      tokenSymbol: "USDC",
      tokenAddress: "0xtoken",
      amount: "1000",
    });
  });
});

describe("trackApprovalResult", () => {
  beforeEach(clearMocks);

  it("fires 'approval_success' when status is 'success'", () => {
    trackApprovalResult("success", { context: "deposit" });

    const [event, props] = mockCapture.mock.calls[0];
    expect(event).toBe("approval_success");
    expect(props).toMatchObject({ context: "deposit" });
  });

  it("fires 'approval_error' when status is 'error'", () => {
    trackApprovalResult("error", { message: "denied" });

    const [event] = mockCapture.mock.calls[0];
    expect(event).toBe("approval_error");
  });
});

// ---------------------------------------------------------------------------
// identifyUser
// ---------------------------------------------------------------------------

describe("identifyUser", () => {
  beforeEach(clearMocks);

  it("calls posthog.identify with lowercase address as distinctId", () => {
    identifyUser("0xDeAdBeEf");

    expect(mockIdentify).toHaveBeenCalledOnce();
    const [distinctId, props] = mockIdentify.mock.calls[0];
    expect(distinctId).toBe("0xdeadbeef");
    expect(props).toMatchObject({ wallet: "0xdeadbeef" });
  });

  it("is a no-op for empty address", () => {
    identifyUser("");
    expect(mockIdentify).not.toHaveBeenCalled();
  });

  it("is a no-op when window is undefined (server environment)", () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error — intentionally deleting window to simulate server
    delete globalThis.window;

    identifyUser("0xABC");
    expect(mockIdentify).not.toHaveBeenCalled();

    globalThis.window = originalWindow;
  });
});

// ---------------------------------------------------------------------------
// resetUser
// ---------------------------------------------------------------------------

describe("resetUser", () => {
  beforeEach(clearMocks);

  it("calls posthog.reset()", () => {
    resetUser();
    expect(mockReset).toHaveBeenCalledOnce();
  });

  it("is a no-op when window is undefined (server environment)", () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error — intentionally deleting window to simulate server
    delete globalThis.window;

    resetUser();
    expect(mockReset).not.toHaveBeenCalled();

    globalThis.window = originalWindow;
  });
});
