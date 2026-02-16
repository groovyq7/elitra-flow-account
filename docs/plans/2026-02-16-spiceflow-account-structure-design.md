# SpiceFlow Full Account Structure — Elitra Integration Design

**Date:** 2026-02-16
**Approach:** Incremental upgrade (Approach A)
**Network:** Testnet (Sepolia 11155111, Base Sepolia 84532, Citrea Testnet 5115)
**State Management:** Zustand with persist middleware
**Wallet Provider:** Privy (already integrated)
**Framework:** Next.js 14 App Router

## Context

Elitra currently has a basic SpiceFlow SDK wrapper — deposit/withdraw modals that use SDK widgets but lack:
- Persistent state (no Zustand store, no balance tracking, no history)
- Gasless EIP-7702 intent signing (relies entirely on SDK internals)
- Account badge / popup (no visible cross-chain account UI)
- Intent crypto utilities (no hashChainBatches, no getIntentHash)
- TX Submission API integration (no custom transaction flows)
- Module-level concurrency protection (no gasless transaction mutex)

Zentra has all of these. We port Zentra's proven patterns, adapting contract calls from Aave Pool to BoringVault Teller.

## Architecture

### Provider Hierarchy (unchanged)

```
PrivyProvider (auth + embedded wallets)
  └─ WagmiProvider (wagmi config)
      └─ QueryClientProvider
          └─ SpiceFlowProvider (provider="privy", mode="7702", nativeChainId=5115)
              └─ AppContent (routes + global SpiceFlow modals)
```

### New/Modified Files

```
src/lib/spiceflowConfig.ts          — NEW: centralized SpiceFlow constants
src/store/useSpiceStore.ts           — NEW: Zustand persist store
src/utils/intentCrypto.ts            — NEW: EIP-7702 intent hashing (port from Zentra)
src/components/SpiceFlow/
  ├── DepositFlow.tsx                — NEW: upgraded deposit (replaces CrossChainDepositFlow usage)
  ├── WithdrawFlow.tsx               — NEW: 4-step withdraw (replaces SpiceWithdrawModal)
  ├── SupplyViaSpiceFlow.tsx         — NEW: gasless Teller.deposit via EIP-7702
  ├── CrossChainAccountBadge.tsx     — NEW: header balance badge
  └── CrossChainAccountPopup.tsx     — NEW: balance + history popup
```

### Files Modified (existing)

```
app/layout.tsx or app/providers.tsx  — Mount global SpiceFlow modals
components/Navbar.tsx (or equivalent) — Add CrossChainAccountBadge
package.json                          — Add zustand dependency
```

### Files Retired (replaced by new components)

```
app/opportunities/components/SpiceDepositModal.tsx    — replaced by DepositFlow
app/opportunities/components/SpiceWithdrawModal.tsx   — replaced by WithdrawFlow
components/cross-chain-deposit/CrossChainDepositFlow.tsx — replaced by DepositFlow
```

## Data Flow

### Deposit Flow
1. User clicks Deposit → opens DepositFlow modal
2. SDK's SpiceDeposit widget handles chain select + cross-chain transfer
3. Multi-signal success detection (CustomEvents + MutationObserver)
4. On success → record in useSpiceStore (asset, amount, chain, timestamp)
5. CrossChainAccountBadge updates balance

### Withdraw Flow (4 steps)
1. Select source asset (custom UI matching SDK style)
2. Select destination chain (SDK's SelectChainModal)
3. Select destination asset (custom UI)
4. Execute withdraw (SDK's WithdrawWidgetModal with computed batches)
5. On success → deduct from useSpiceStore balance

### Supply Flow (gasless EIP-7702)
1. User enters amount in SupplyViaSpiceFlow modal
2. Build ChainBatch: `approve(WCBTC, amount)` + `Teller.deposit(WCBTC, amount, minSharesOut)`
3. Sign EIP-7702 authorization via Privy embedded wallet
4. Hash + sign intent via personal_sign
5. POST to TX Submission API `/actions`
6. Poll status with AbortController
7. On success → deduct balance from useSpiceStore, dispatch vault refresh event

### Contract Calls (Elitra-specific)

**Supply (Teller.deposit):**
```
Call 1: WCBTC.approve(vaultAddress, amount)
Call 2: Teller.deposit(WCBTC_ADDRESS, amount, minSharesOut=1n)
```

**Withdraw (Teller.bulkWithdrawNow):**
```
Call 1: Teller.bulkWithdrawNow(tokenAddress, amount, 0, recipient)
```

Where recipient = embedded wallet (collateral), external wallet (direct), or Solver address (cross-chain external).

## Zustand Store Schema

```typescript
interface SpiceState {
  // Persisted data
  crossChainBalance: number;
  depositHistory: HistoryRecord[];
  supplyHistory: HistoryRecord[];
  withdrawHistory: HistoryRecord[];

  // UI state (NOT persisted via partialize)
  isDepositOpen: boolean;
  isWithdrawOpen: boolean;
  isSupplyOpen: boolean;
  supplyAsset: string | null;

  // Actions
  addDeposit: (record: HistoryRecord) => void;
  addSupply: (record: HistoryRecord) => void;
  addWithdraw: (record: HistoryRecord) => void;
  openDeposit: () => void;
  closeDeposit: () => void;
  openWithdraw: () => void;
  closeWithdraw: () => void;
  openSupply: (asset?: string) => void;
  closeSupply: () => void;
}
```

Versioned with `version: 1` and `migrate` function. MAX_HISTORY_RECORDS = 100.

## Phased Implementation (Integration Playbook)

### Phase 0: Baseline snapshot
- Run app as-is, record every page/feature
- npm run build, npm run dev — confirm clean
- This becomes the regression contract

### Phase 1: Foundation hardening
- Install zustand
- Create spiceflowConfig.ts (centralize constants)
- Verify bundler deduplication
- Checkpoint: build + dev + console clean + baseline regression

### Phase 2: SDK widget upgrades
- Step 2.1: DepositFlow (replace CrossChainDepositFlow usage)
- Step 2.2: WithdrawFlow (4-step upgrade)
- Step 2.3: Global modal mounting
- Checkpoint: all widgets render, open/close cleanly, baseline regression

### Phase 3: Custom TX flows
- Step 3.1: intentCrypto.ts (port from Zentra)
- Step 3.2: EIP-7702 authorization signing
- Step 3.3: Intent signing
- Step 3.4: SupplyViaSpiceFlow with Teller.deposit
- Step 3.5: Status polling
- Checkpoint: gasless supply works end-to-end, baseline regression

### Phase 4: State & polish
- Step 4.1: useSpiceStore (Zustand persist)
- Step 4.2: CrossChainAccountBadge + Popup
- Step 4.3: Wire stores into deposit/withdraw/supply flows
- Checkpoint: full end-to-end with balance tracking, baseline regression

### Phase 5: Final QA sweep
- 150+ test cases from the integration playbook
- Fund safety, wallet state matrix, stress testing, security review
- Production build verification

## Verification Protocol (Every Step)

1. `npm run build` → zero errors
2. `npm run dev` → app loads
3. Browser console → zero errors related to changes
4. Test the specific thing built
5. Baseline regression → nothing broken

## Key Risks

1. **Next.js SSR vs client components** — All SpiceFlow components must be `'use client'` with `dynamic(() => ..., { ssr: false })` imports
2. **Privy version mismatch** — Elitra has Privy 3.6.1, Zentra has 2.24.0. The `useSign7702Authorization` hook API may differ. Verify during Phase 3.
3. **Teller ABI compatibility** — Teller.deposit args (tokenAddress, amount, minSharesOut) must match deployed contract exactly
4. **SDK patching** — Elitra is on spiceflow-ui ^1.11.10 (not pinned). Pin to exact version before patching.
