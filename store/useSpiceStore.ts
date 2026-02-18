import { create } from "zustand";
import { persist } from "zustand/middleware";

// Maximum number of records to keep per history array to prevent unbounded
// localStorage growth. Oldest entries beyond this limit are pruned on each add.
const MAX_HISTORY_RECORDS = 100;

interface SupplyAsset {
  address: string;
  symbol: string;
  decimals: number;
}

export interface DepositRecord {
  id: string;
  asset: string;        // "USDC", "ETH", etc.
  amount: string;        // formatted amount e.g. "0.5" (in source token units)
  usdValue?: string;     // USD-equivalent value at deposit time
  sourceChain: string;   // "Sepolia", "Base Sepolia", "Citrea Testnet"
  timestamp: number;
  txHash?: string;
}

export interface SupplyRecord {
  id: string;
  assetAddress: string;  // Token contract address
  assetSymbol: string;   // e.g. "WCBTC"
  amount: string;        // formatted amount e.g. "0.001"
  timestamp: number;
}

export interface WithdrawRecord {
  id: string;
  amount: string;
  destinationChain: string;
  destinationChainId: number;
  timestamp: number;
}

interface SpiceState {
  // Deposit modal
  isDepositOpen: boolean;

  // Withdraw modal
  isWithdrawOpen: boolean;

  // Supply via SpiceFlow (gasless EIP-7702 Teller.deposit)
  isSupplyOpen: boolean;
  supplyAsset: SupplyAsset | null;

  // Cross-chain account
  crossChainBalance: number;
  depositHistory: DepositRecord[];
  isAccountPopupOpen: boolean;

  // Supply history
  supplyHistory: SupplyRecord[];

  // Withdraw history
  withdrawHistory: WithdrawRecord[];

  // Actions
  openDeposit: () => void;
  closeDeposit: () => void;
  openWithdraw: () => void;
  closeWithdraw: () => void;
  openSupply: (asset?: SupplyAsset) => void;
  closeSupply: () => void;

  // Cross-chain account actions
  toggleAccountPopup: () => void;
  closeAccountPopup: () => void;
  addDeposit: (record: DepositRecord) => void;
  deductBalance: (amount: number) => void;

  // Supply tracking
  addSupply: (record: SupplyRecord) => void;
  getSuppliedAmount: (assetAddress: string) => string;

  // Withdraw tracking
  addWithdraw: (record: WithdrawRecord) => void;
}

export const useSpiceStore = create<SpiceState>()(
  persist(
    (set, get) => ({
      isDepositOpen: false,
      isWithdrawOpen: false,
      isSupplyOpen: false,
      supplyAsset: null,

      crossChainBalance: 0,
      depositHistory: [],
      isAccountPopupOpen: false,

      supplyHistory: [],
      withdrawHistory: [],

      openDeposit: () => set({ isDepositOpen: true }),
      closeDeposit: () => set({ isDepositOpen: false }),

      openWithdraw: () => set({ isWithdrawOpen: true }),
      closeWithdraw: () => set({ isWithdrawOpen: false }),

      openSupply: (asset) =>
        set({ isSupplyOpen: true, supplyAsset: asset ?? null }),
      closeSupply: () => set({ isSupplyOpen: false, supplyAsset: null }),

      toggleAccountPopup: () =>
        set((state) => ({ isAccountPopupOpen: !state.isAccountPopupOpen })),
      closeAccountPopup: () => set({ isAccountPopupOpen: false }),

      addDeposit: (record) =>
        set((state) => {
          const addedValue = parseFloat(record.usdValue || record.amount || "0");
          return {
            depositHistory: [record, ...state.depositHistory].slice(
              0,
              MAX_HISTORY_RECORDS
            ),
            // Round to 6 decimal places to avoid floating-point accumulation errors.
            // Guard against NaN from malformed input — treat as 0.
            crossChainBalance:
              Math.round(
                (state.crossChainBalance + (isNaN(addedValue) ? 0 : addedValue)) *
                  1e6
              ) / 1e6,
          };
        }),

      deductBalance: (amount) =>
        set((state) => ({
          // Guard against NaN — treat as no-op rather than corrupting balance
          crossChainBalance: isNaN(amount) ? state.crossChainBalance : Math.max(
            0,
            Math.round((state.crossChainBalance - amount) * 1e6) / 1e6
          ),
        })),

      addSupply: (record) => {
        set((state) => ({
          supplyHistory: [record, ...state.supplyHistory].slice(
            0,
            MAX_HISTORY_RECORDS
          ),
        }));
      },

      addWithdraw: (record) => {
        set((state) => ({
          withdrawHistory: [record, ...state.withdrawHistory].slice(
            0,
            MAX_HISTORY_RECORDS
          ),
        }));
      },

      getSuppliedAmount: (assetAddress: string) => {
        const { supplyHistory } = get();
        const total = supplyHistory
          .filter(
            (s) => s.assetAddress.toLowerCase() === assetAddress.toLowerCase()
          )
          .reduce((sum, s) => sum + parseFloat(s.amount || "0"), 0);
        return total.toString();
      },
    }),
    {
      name: "elitra-spice-store",
      version: 1,
      migrate: (persisted: unknown, version: number) => {
        // v0 → v1: no-op migration (establishes versioned baseline)
        return persisted as Record<string, unknown>;
      },
      // Only persist data — not UI state like open modals
      partialize: (state) => ({
        crossChainBalance: state.crossChainBalance,
        depositHistory: state.depositHistory,
        supplyHistory: state.supplyHistory,
        withdrawHistory: state.withdrawHistory,
      }),
    }
  )
);
