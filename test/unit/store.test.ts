import { describe, it, expect, beforeEach } from "vitest";
import { useSpiceStore } from "@/store/useSpiceStore";
import type { DepositRecord, SupplyRecord, WithdrawRecord } from "@/store/useSpiceStore";

// Reset store state before each test to avoid cross-test contamination.
// Zustand persist middleware uses localStorage in jsdom, but we overwrite state
// directly via setState which bypasses persistence reads.
beforeEach(() => {
  useSpiceStore.setState({
    isDepositOpen: false,
    isWithdrawOpen: false,
    isSupplyOpen: false,
    supplyAsset: null,
    crossChainBalance: 0,
    depositHistory: [],
    isAccountPopupOpen: false,
    supplyHistory: [],
    withdrawHistory: [],
  });
});

// ---------------------------------------------------------------------------
// Modal open / close
// ---------------------------------------------------------------------------
describe("Modal state management", () => {
  it("openDeposit sets isDepositOpen to true", () => {
    useSpiceStore.getState().openDeposit();
    expect(useSpiceStore.getState().isDepositOpen).toBe(true);
  });

  it("closeDeposit sets isDepositOpen to false", () => {
    useSpiceStore.getState().openDeposit();
    useSpiceStore.getState().closeDeposit();
    expect(useSpiceStore.getState().isDepositOpen).toBe(false);
  });

  it("openWithdraw sets isWithdrawOpen to true", () => {
    useSpiceStore.getState().openWithdraw();
    expect(useSpiceStore.getState().isWithdrawOpen).toBe(true);
  });

  it("closeWithdraw sets isWithdrawOpen to false", () => {
    useSpiceStore.getState().openWithdraw();
    useSpiceStore.getState().closeWithdraw();
    expect(useSpiceStore.getState().isWithdrawOpen).toBe(false);
  });

  it("openSupply sets isSupplyOpen to true", () => {
    useSpiceStore.getState().openSupply();
    expect(useSpiceStore.getState().isSupplyOpen).toBe(true);
  });

  it("openSupply accepts optional asset", () => {
    const asset = { address: "0xabc", symbol: "WCBTC", decimals: 8 };
    useSpiceStore.getState().openSupply(asset);
    expect(useSpiceStore.getState().isSupplyOpen).toBe(true);
    expect(useSpiceStore.getState().supplyAsset).toEqual(asset);
  });

  it("closeSupply resets isSupplyOpen and supplyAsset", () => {
    useSpiceStore.getState().openSupply({ address: "0x1", symbol: "X", decimals: 18 });
    useSpiceStore.getState().closeSupply();
    expect(useSpiceStore.getState().isSupplyOpen).toBe(false);
    expect(useSpiceStore.getState().supplyAsset).toBeNull();
  });

  it("multiple modals can be opened independently", () => {
    // The store doesn't enforce exclusivity — each modal is a separate boolean.
    // This is by design: the UI layer handles which modal to show.
    useSpiceStore.getState().openDeposit();
    useSpiceStore.getState().openWithdraw();
    expect(useSpiceStore.getState().isDepositOpen).toBe(true);
    expect(useSpiceStore.getState().isWithdrawOpen).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Account popup
// ---------------------------------------------------------------------------
describe("Account popup", () => {
  it("toggleAccountPopup toggles the popup", () => {
    expect(useSpiceStore.getState().isAccountPopupOpen).toBe(false);
    useSpiceStore.getState().toggleAccountPopup();
    expect(useSpiceStore.getState().isAccountPopupOpen).toBe(true);
    useSpiceStore.getState().toggleAccountPopup();
    expect(useSpiceStore.getState().isAccountPopupOpen).toBe(false);
  });

  it("closeAccountPopup closes the popup", () => {
    useSpiceStore.getState().toggleAccountPopup();
    useSpiceStore.getState().closeAccountPopup();
    expect(useSpiceStore.getState().isAccountPopupOpen).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// addDeposit / crossChainBalance
// ---------------------------------------------------------------------------
describe("addDeposit and crossChainBalance", () => {
  const makeDeposit = (overrides: Partial<DepositRecord> = {}): DepositRecord => ({
    id: `dep-${Date.now()}-${Math.random()}`,
    asset: "USDC",
    amount: "100",
    usdValue: "100",
    sourceChain: "Sepolia",
    timestamp: Date.now(),
    ...overrides,
  });

  it("adds a deposit and increases balance", () => {
    useSpiceStore.getState().addDeposit(makeDeposit({ usdValue: "50" }));
    expect(useSpiceStore.getState().crossChainBalance).toBe(50);
    expect(useSpiceStore.getState().depositHistory).toHaveLength(1);
  });

  it("accumulates balance across multiple deposits", () => {
    useSpiceStore.getState().addDeposit(makeDeposit({ usdValue: "100" }));
    useSpiceStore.getState().addDeposit(makeDeposit({ usdValue: "50.5" }));
    expect(useSpiceStore.getState().crossChainBalance).toBe(150.5);
    expect(useSpiceStore.getState().depositHistory).toHaveLength(2);
  });

  it("uses amount as fallback when usdValue is missing", () => {
    useSpiceStore.getState().addDeposit(
      makeDeposit({ usdValue: undefined, amount: "25" })
    );
    expect(useSpiceStore.getState().crossChainBalance).toBe(25);
  });

  it("guards against NaN usdValue", () => {
    useSpiceStore.getState().addDeposit(makeDeposit({ usdValue: "not-a-number", amount: "also-nan" }));
    // NaN is treated as 0 — balance should stay at 0
    expect(useSpiceStore.getState().crossChainBalance).toBe(0);
  });

  it("rounds balance to 6 decimal places", () => {
    useSpiceStore.getState().addDeposit(makeDeposit({ usdValue: "0.1" }));
    useSpiceStore.getState().addDeposit(makeDeposit({ usdValue: "0.2" }));
    // 0.1 + 0.2 famously = 0.30000000000000004 in IEEE 754
    // The store rounds to 6 decimals to avoid this
    expect(useSpiceStore.getState().crossChainBalance).toBe(0.3);
  });

  it("prepends new deposits (newest first)", () => {
    const first = makeDeposit({ id: "first", timestamp: 1000 });
    const second = makeDeposit({ id: "second", timestamp: 2000 });
    useSpiceStore.getState().addDeposit(first);
    useSpiceStore.getState().addDeposit(second);
    expect(useSpiceStore.getState().depositHistory[0].id).toBe("second");
    expect(useSpiceStore.getState().depositHistory[1].id).toBe("first");
  });

  it("caps history at 100 entries", () => {
    for (let i = 0; i < 105; i++) {
      useSpiceStore.getState().addDeposit(makeDeposit({ id: `dep-${i}` }));
    }
    expect(useSpiceStore.getState().depositHistory).toHaveLength(100);
  });
});

// ---------------------------------------------------------------------------
// deductBalance
// ---------------------------------------------------------------------------
describe("deductBalance", () => {
  it("decreases the balance", () => {
    useSpiceStore.setState({ crossChainBalance: 100 });
    useSpiceStore.getState().deductBalance(30);
    expect(useSpiceStore.getState().crossChainBalance).toBe(70);
  });

  it("clamps to zero (never goes negative)", () => {
    useSpiceStore.setState({ crossChainBalance: 10 });
    useSpiceStore.getState().deductBalance(999);
    expect(useSpiceStore.getState().crossChainBalance).toBe(0);
  });

  it("guards against NaN amount (no-op)", () => {
    useSpiceStore.setState({ crossChainBalance: 50 });
    useSpiceStore.getState().deductBalance(NaN);
    expect(useSpiceStore.getState().crossChainBalance).toBe(50);
  });

  it("handles zero deduction", () => {
    useSpiceStore.setState({ crossChainBalance: 50 });
    useSpiceStore.getState().deductBalance(0);
    expect(useSpiceStore.getState().crossChainBalance).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Supply tracking
// ---------------------------------------------------------------------------
describe("addSupply", () => {
  const makeSupply = (overrides: Partial<SupplyRecord> = {}): SupplyRecord => ({
    id: `sup-${Date.now()}-${Math.random()}`,
    assetAddress: "0x8d0c9d1c17aE5e40ffF9bE350f57840E9E66Cd93",
    assetSymbol: "WCBTC",
    amount: "0.001",
    timestamp: Date.now(),
    ...overrides,
  });

  it("adds a supply record", () => {
    useSpiceStore.getState().addSupply(makeSupply());
    expect(useSpiceStore.getState().supplyHistory).toHaveLength(1);
  });

  it("caps supply history at 100", () => {
    for (let i = 0; i < 105; i++) {
      useSpiceStore.getState().addSupply(makeSupply({ id: `sup-${i}` }));
    }
    expect(useSpiceStore.getState().supplyHistory).toHaveLength(100);
  });
});

// ---------------------------------------------------------------------------
// getSuppliedAmount
// ---------------------------------------------------------------------------
describe("getSuppliedAmount", () => {
  it("sums supply amounts for a given asset address", () => {
    const addr = "0xABC";
    useSpiceStore.getState().addSupply({
      id: "1", assetAddress: addr, assetSymbol: "WCBTC", amount: "0.5", timestamp: 1,
    });
    useSpiceStore.getState().addSupply({
      id: "2", assetAddress: addr, assetSymbol: "WCBTC", amount: "0.3", timestamp: 2,
    });
    // Different address — should not be counted
    useSpiceStore.getState().addSupply({
      id: "3", assetAddress: "0xDEF", assetSymbol: "ETH", amount: "1", timestamp: 3,
    });
    const total = useSpiceStore.getState().getSuppliedAmount(addr);
    expect(parseFloat(total)).toBeCloseTo(0.8, 5);
  });

  it("is case-insensitive on address comparison", () => {
    useSpiceStore.getState().addSupply({
      id: "1", assetAddress: "0xAbC", assetSymbol: "T", amount: "1", timestamp: 1,
    });
    const total = useSpiceStore.getState().getSuppliedAmount("0xABC");
    expect(parseFloat(total)).toBe(1);
  });

  it("returns '0' for unknown address", () => {
    expect(useSpiceStore.getState().getSuppliedAmount("0xNONE")).toBe("0");
  });
});

// ---------------------------------------------------------------------------
// Withdraw tracking
// ---------------------------------------------------------------------------
describe("addWithdraw", () => {
  const makeWithdraw = (overrides: Partial<WithdrawRecord> = {}): WithdrawRecord => ({
    id: `wd-${Date.now()}`,
    amount: "10",
    destinationChain: "Sepolia",
    destinationChainId: 11155111,
    timestamp: Date.now(),
    ...overrides,
  });

  it("adds a withdraw record", () => {
    useSpiceStore.getState().addWithdraw(makeWithdraw());
    expect(useSpiceStore.getState().withdrawHistory).toHaveLength(1);
  });

  it("caps withdraw history at 100", () => {
    for (let i = 0; i < 105; i++) {
      useSpiceStore.getState().addWithdraw(makeWithdraw({ id: `wd-${i}` }));
    }
    expect(useSpiceStore.getState().withdrawHistory).toHaveLength(100);
  });
});
