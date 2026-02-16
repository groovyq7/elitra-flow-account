# SpiceFlow Full Account Structure — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Also use the `spiceflow-integration-playbook` skill for verification protocol at every step.

**Goal:** Upgrade Elitra's basic SpiceFlow SDK wrapper into a full Zentra-style account system with persistent state, gasless EIP-7702 Teller deposits, and cross-chain account UI.

**Architecture:** Incremental upgrade — add Zustand store, intent crypto, gasless supply component, and account badge/popup on top of Elitra's existing SpiceFlow provider and SDK widget integration. All contract calls target BoringVault Teller (not Aave Pool). Testnet chains (Sepolia 11155111, Base Sepolia 84532, Citrea Testnet 5115).

**Tech Stack:** Next.js 14 App Router, Privy 3.6.1, wagmi v2, viem, Zustand 5, @spicenet-io/spiceflow-ui 1.11.10, TypeScript

**Reference Skills:** `elitraos-fork` (current codebase), `zentra-codebase` (target patterns), `spiceflow-integration-playbook` (verification protocol), `tx-submission-api` (intent API), `spiceflow-docs` (SDK reference)

---

## Phase 0: Baseline Snapshot

### Task 0.1: Record baseline state

**Files:** None modified

**Step 1: Run the app and record what works**

```bash
cd /Users/jack/Downloads/Claude_files/elitraOS-fork-main
npm run dev
```

Open in browser. Click through every page:
- `/` (home → opportunities)
- `/opportunities` (portfolio, deposit/withdraw buttons, vault list)
- `/vault/[id]` (vault detail, charts, deposit/withdraw)
- `/campaign` (registration form)

Document every feature: buttons, modals, flows, wallet connect.

**Step 2: Build the app**

```bash
npm run build
```

Expected: Succeeds with zero errors. Record any warnings.

**Step 3: Commit baseline snapshot**

```bash
git add -A
git commit -m "chore: baseline snapshot before SpiceFlow account structure upgrade"
```

---

## Phase 1: Foundation

### Task 1.1: Install Zustand

**Files:**
- Modify: `package.json`

**Step 1: Install**

```bash
npm install zustand
```

**Step 2: Verify**

```bash
npm ls zustand
npm run build
```

Expected: zustand installed, build succeeds.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add zustand dependency"
```

---

### Task 1.2: Create spiceflowConfig.ts

**Files:**
- Create: `src/lib/spiceflowConfig.ts` (or `lib/spiceflowConfig.ts` — match Elitra's lib convention)

Currently Elitra scatters chain IDs, delegate contracts, and solver address across multiple files. Centralize them.

**Step 1: Create the config file**

```typescript
// lib/spiceflowConfig.ts
export const SUPPORTED_CHAIN_IDS = [11155111, 84532, 5115] as const;
export const SPICEFLOW_MODE = '7702' as const;
export const NATIVE_CHAIN_ID = 5115; // Citrea Testnet
export const SPICENET_API_URL = process.env.NEXT_PUBLIC_RELAYER_API_URL || '/api/relayer';

export const SOLVER_ADDRESS = "0x111115763723B53395308eC4c9AB9d5FB0844cae" as `0x${string}`;

export const DELEGATE_CONTRACTS: Record<number, `0x${string}`> = {
  11155111: "0x...", // Sepolia — get from existing chains.ts
  84532: "0x...",    // Base Sepolia — get from existing chains.ts
  5115: "0x...",     // Citrea Testnet — get from existing chains.ts
};

// Warn if API URL not set in production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_RELAYER_API_URL) {
  console.warn(
    '[SpiceFlowConfig] NEXT_PUBLIC_RELAYER_API_URL is not set in production. ' +
    'Set it to the absolute TX Submission API URL in your deployment env.'
  );
}
```

**Important:** Read `lib/utils/chains.ts` (reference: `elitraos-fork` → `references/lib-utils.md`) to get the exact delegate contract addresses for each testnet chain. Copy them verbatim.

**Step 2: Verify**

```bash
npm run build
```

Expected: Compiles with zero errors.

**Step 3: Commit**

```bash
git add lib/spiceflowConfig.ts
git commit -m "feat: centralize SpiceFlow config constants"
```

---

### Task 1.3: Pin SpiceFlow SDK version

**Files:**
- Modify: `package.json`

**Step 1: Pin exact version**

In package.json, change `"@spicenet-io/spiceflow-ui": "^1.11.10"` to `"@spicenet-io/spiceflow-ui": "1.11.10"` (remove caret). This prevents the postinstall patch script (Phase 4) from breaking on version bumps.

**Step 2: Verify**

```bash
npm install
npm run build
```

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: pin spiceflow-ui to exact version for patch compatibility"
```

---

### Phase 1 Checkpoint

Run ALL:
- [ ] `npm run build` — zero errors
- [ ] `npm run dev` — app loads
- [ ] Browser console — zero new errors
- [ ] Privy login still works
- [ ] All original features from Phase 0 baseline still work identically

**STOP — Show user Phase 1 results. Get approval before Phase 2.**

---

## Phase 2: Zustand Store + Account UI

### Task 2.1: Create useSpiceStore

**Files:**
- Create: `store/useSpiceStore.ts`

**Step 1: Create the store**

Port from Zentra's pattern (reference: `zentra-codebase` → store section). Adapt for Elitra:

```typescript
// store/useSpiceStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface HistoryRecord {
  id: string;
  type: 'deposit' | 'withdraw' | 'supply';
  asset: string;
  amount: number;
  chain: string;
  chainId: number;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
  intentId?: string;
}

const MAX_HISTORY_RECORDS = 100;

interface SpiceState {
  // Persisted data
  crossChainBalance: number;
  depositHistory: HistoryRecord[];
  supplyHistory: HistoryRecord[];
  withdrawHistory: HistoryRecord[];

  // UI state (NOT persisted)
  isDepositOpen: boolean;
  isWithdrawOpen: boolean;
  isSupplyOpen: boolean;
  supplyAsset: string | null;

  // Actions
  addDeposit: (record: Omit<HistoryRecord, 'id' | 'type' | 'timestamp'>) => void;
  addSupply: (record: Omit<HistoryRecord, 'id' | 'type' | 'timestamp'>) => void;
  addWithdraw: (record: Omit<HistoryRecord, 'id' | 'type' | 'timestamp'>) => void;
  updateBalance: (delta: number) => void;
  openDeposit: () => void;
  closeDeposit: () => void;
  openWithdraw: () => void;
  closeWithdraw: () => void;
  openSupply: (asset?: string) => void;
  closeSupply: () => void;
}

export const useSpiceStore = create<SpiceState>()(
  persist(
    (set) => ({
      crossChainBalance: 0,
      depositHistory: [],
      supplyHistory: [],
      withdrawHistory: [],

      isDepositOpen: false,
      isWithdrawOpen: false,
      isSupplyOpen: false,
      supplyAsset: null,

      addDeposit: (record) =>
        set((state) => {
          const newRecord: HistoryRecord = {
            ...record,
            id: `dep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'deposit',
            timestamp: Date.now(),
          };
          const history = [newRecord, ...state.depositHistory].slice(0, MAX_HISTORY_RECORDS);
          const balance = Math.round((state.crossChainBalance + record.amount) * 1e6) / 1e6;
          return { depositHistory: history, crossChainBalance: balance };
        }),

      addSupply: (record) =>
        set((state) => {
          const newRecord: HistoryRecord = {
            ...record,
            id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'supply',
            timestamp: Date.now(),
          };
          const history = [newRecord, ...state.supplyHistory].slice(0, MAX_HISTORY_RECORDS);
          const balance = Math.round((state.crossChainBalance - record.amount) * 1e6) / 1e6;
          return { supplyHistory: history, crossChainBalance: Math.max(0, balance) };
        }),

      addWithdraw: (record) =>
        set((state) => {
          const newRecord: HistoryRecord = {
            ...record,
            id: `wth-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'withdraw',
            timestamp: Date.now(),
          };
          const history = [newRecord, ...state.withdrawHistory].slice(0, MAX_HISTORY_RECORDS);
          const balance = Math.round((state.crossChainBalance - record.amount) * 1e6) / 1e6;
          return { withdrawHistory: history, crossChainBalance: Math.max(0, balance) };
        }),

      updateBalance: (delta) =>
        set((state) => ({
          crossChainBalance: Math.round(Math.max(0, state.crossChainBalance + delta) * 1e6) / 1e6,
        })),

      openDeposit: () => set({ isDepositOpen: true }),
      closeDeposit: () => set({ isDepositOpen: false }),
      openWithdraw: () => set({ isWithdrawOpen: true }),
      closeWithdraw: () => set({ isWithdrawOpen: false }),
      openSupply: (asset) => set({ isSupplyOpen: true, supplyAsset: asset || null }),
      closeSupply: () => set({ isSupplyOpen: false, supplyAsset: null }),
    }),
    {
      name: 'elitra-spice-store',
      version: 1,
      migrate: (persisted: any, version: number) => {
        return persisted as any;
      },
      partialize: (state) => ({
        crossChainBalance: state.crossChainBalance,
        depositHistory: state.depositHistory,
        supplyHistory: state.supplyHistory,
        withdrawHistory: state.withdrawHistory,
      }),
    }
  )
);
```

**Step 2: Verify**

```bash
npm run build
```

Expected: Compiles. No errors.

**Step 3: Quick smoke test**

Import and use in a test component or check via browser console that `useSpiceStore.getState()` returns the initial state.

**Step 4: Commit**

```bash
git add store/useSpiceStore.ts
git commit -m "feat: add Zustand SpiceFlow store with persist"
```

---

### Task 2.2: Create CrossChainAccountBadge

**Files:**
- Create: `components/SpiceFlow/CrossChainAccountBadge.tsx`

**Step 1: Create the badge component**

Port from Zentra's pattern (reference: `zentra-codebase` → CrossChainAccountBadge). Adapt styling to match Elitra's design system (white backgrounds, blue accents `#336AFD`).

Key behavior:
- Shows "Elitra Account" with USD balance from `useSpiceStore`
- Click toggles popup open/closed
- Only visible when user is authenticated

**Step 2: Verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add components/SpiceFlow/CrossChainAccountBadge.tsx
git commit -m "feat: add CrossChainAccountBadge component"
```

---

### Task 2.3: Create CrossChainAccountPopup

**Files:**
- Create: `components/SpiceFlow/CrossChainAccountPopup.tsx`

**Step 1: Create the popup component**

Port from Zentra's pattern. Shows:
- USD balance
- Recent deposits (last 10 from `useSpiceStore.depositHistory`)
- "How it works" explainer
- Deposit / Withdraw / Supply action buttons (wire to `useSpiceStore.openDeposit()` etc.)
- Portal-rendered for z-index management

**Step 2: Verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add components/SpiceFlow/CrossChainAccountPopup.tsx
git commit -m "feat: add CrossChainAccountPopup component"
```

---

### Task 2.4: Mount badge in MainNav

**Files:**
- Modify: `components/ui/mainnav.tsx`

**Step 1: Add the badge**

Import `CrossChainAccountBadge` and render it in the navbar, between the TVL display and the "Copy Embedded Wallet Address" button (around line 1212 in the reference).

```tsx
import dynamic from 'next/dynamic';
const CrossChainAccountBadge = dynamic(
  () => import('../SpiceFlow/CrossChainAccountBadge').then(m => m.CrossChainAccountBadge),
  { ssr: false }
);
```

Place it in the `<div className="flex gap-4 items-center">` section.

**Step 2: Verify**

```bash
npm run build
npm run dev
```

Open browser → check navbar → badge should appear when logged in with Privy. Click it → popup should open/close.

**Step 3: Regression check**

All other navbar elements (logo, TVL, wallet button, embedded address copy) still work.

**Step 4: Commit**

```bash
git add components/ui/mainnav.tsx
git commit -m "feat: mount CrossChainAccountBadge in navbar"
```

---

### Phase 2 Checkpoint

- [ ] `npm run build` — zero errors
- [ ] Badge appears in navbar when authenticated
- [ ] Click badge → popup opens with $0.00 balance (no deposits yet)
- [ ] Click badge again → popup closes
- [ ] Click outside popup → closes
- [ ] Popup shows "Deposit" / "Withdraw" buttons
- [ ] `useSpiceStore.getState()` in console → correct initial state
- [ ] Refresh page → store persists in localStorage (`elitra-spice-store` key)
- [ ] **BASELINE REGRESSION:** All original features still work identically

**STOP — Show user Phase 2 results. Get approval before Phase 3.**

---

## Phase 3: Upgraded Deposit Flow

### Task 3.1: Create DepositFlow component

**Files:**
- Create: `components/SpiceFlow/DepositFlow.tsx`

**Step 1: Create the component**

Port Zentra's DepositFlow pattern (reference: `zentra-codebase` → DepositFlow). Key changes for Elitra:
- Use `dynamic(() => import("@spicenet-io/spiceflow-ui"), { ssr: false })` instead of `React.lazy`
- Wrap SDK's `SpiceDeposit` component
- Multi-signal success detection:
  1. CustomEvents: `tx-complete`, `deposit-completed`, `cross-chain-deposit-completed`
  2. MutationObserver watching for "DEPOSIT TO [CHAIN] SUCCESSFUL" banner
- On success → call `useSpiceStore.addDeposit()` with asset/amount/chain info
- Auto-close after 3s delay on success
- Modal controlled by `useSpiceStore.isDepositOpen` / `closeDeposit()`

**Step 2: Verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add components/SpiceFlow/DepositFlow.tsx
git commit -m "feat: add DepositFlow with success detection and store tracking"
```

---

### Task 3.2: Mount DepositFlow globally in layout

**Files:**
- Modify: `app/layout.tsx`

**Step 1: Add global modal**

Import DepositFlow dynamically and render it inside `<SpiceFlowProvider>`, after `{children}`:

```tsx
const DepositFlow = dynamic(
  () => import('@/components/SpiceFlow/DepositFlow').then(m => m.DepositFlow),
  { ssr: false }
);

// Inside the layout JSX, after {children}:
<DepositFlow />
```

**Step 2: Wire the popup's Deposit button**

The CrossChainAccountPopup's "Deposit" button should call `useSpiceStore.openDeposit()`. DepositFlow reads `isDepositOpen` from the store to show/hide.

**Step 3: Verify**

```bash
npm run build
npm run dev
```

Open browser → click badge → click "Deposit" → DepositFlow modal opens with SDK widget. Close it → clean state. Navigate to different page → open again → works from any page.

**Step 4: Regression check**

The OLD SpiceDepositModal in `app/opportunities/components/SpiceDepositModal.tsx` should still work independently (don't remove it yet — we'll deprecate after full flow is verified).

**Step 5: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: mount DepositFlow globally in layout"
```

---

### Task 3.3: Upgraded WithdrawFlow

**Files:**
- Create: `components/SpiceFlow/WithdrawFlow.tsx`

**Step 1: Create 4-step withdraw**

Port Zentra's WithdrawFlow pattern (reference: `zentra-codebase` → WithdrawFlow). 4 steps:
1. Source asset select (custom UI — show vault share tokens: eCBTC, eNUSD)
2. Chain select (SDK's `SelectChainModal`)
3. Destination asset select (custom UI — show tokens available on destination chain)
4. Execute (SDK's `WithdrawWidgetModal` with computed `withdrawBatches`)

Key Elitra adaptations:
- Withdraw calls `Teller.bulkWithdrawNow(tokenAddress, amount, 0, recipient)` (not Aave)
- Recipient logic: embedded wallet (collateral), external wallet (direct on Citrea), Solver address (cross-chain external)
- On success → call `useSpiceStore.addWithdraw()`
- Use existing Elitra TELLER_ABI from `lib/abis/EliteraTeller.json`

**Step 2: Mount globally in layout**

Same pattern as DepositFlow — add `<WithdrawFlow />` in `app/layout.tsx`.

**Step 3: Verify**

```bash
npm run build
npm run dev
```

Badge → popup → "Withdraw" → modal opens → step through all 4 steps → close cleanly.

**Step 4: Commit**

```bash
git add components/SpiceFlow/WithdrawFlow.tsx app/layout.tsx
git commit -m "feat: add 4-step WithdrawFlow with store tracking"
```

---

### Phase 3 Checkpoint

- [ ] `npm run build` — zero errors
- [ ] DepositFlow: opens from badge popup → shows SDK deposit widget → close cleanly
- [ ] DepositFlow: open/close 5 times rapidly → no errors, no zombie listeners
- [ ] DepositFlow: open from different pages → works everywhere (global mount)
- [ ] WithdrawFlow: opens from badge popup → 4 steps render → close cleanly
- [ ] WithdrawFlow: step 1 shows vault share tokens (eCBTC, eNUSD)
- [ ] WithdrawFlow: step 2 shows chain selector
- [ ] WithdrawFlow: close at any step → re-open → starts fresh
- [ ] Badge popup "Deposit" / "Withdraw" buttons work
- [ ] Browser console — zero errors during all interactions
- [ ] **BASELINE REGRESSION:** All original features still work. Old SpiceDepositModal/SpiceWithdrawModal on opportunities page still functional.

**STOP — Show user Phase 3 results. Get approval before Phase 4.**

---

## Phase 4: Gasless EIP-7702 Supply Flow

### Task 4.1: Create intentCrypto.ts

**Files:**
- Create: `utils/intentCrypto.ts`

**Step 1: Port from Zentra**

Copy Zentra's `src/utils/intentCrypto.ts` verbatim (reference: `zentra-codebase` → intent crypto section). This is chain-agnostic code — no modifications needed:

```typescript
// Types: Call, ChainBatchInput, ChainBatch (with chainBatchHash)
// Functions: hashChainBatches(), getIntentHash()
```

Uses viem's `encodePacked`, `keccak256`, `hashMessage`.

**Step 2: Verify**

```bash
npm run build
```

Expected: Compiles. Types resolve correctly.

**Step 3: Commit**

```bash
git add utils/intentCrypto.ts
git commit -m "feat: add intent crypto utilities for EIP-7702 signing"
```

---

### Task 4.2: Create SupplyViaSpiceFlow

**Files:**
- Create: `components/SpiceFlow/SupplyViaSpiceFlow.tsx`

This is the biggest single component. Port Zentra's SupplyViaSpiceFlow (reference: `zentra-codebase` → SupplyViaSpiceFlow) with these Elitra-specific changes:

**Key differences from Zentra:**
1. **Contract calls:** `approve(WCBTC, amount) + Teller.deposit(WCBTC, amount, 1n)` instead of `Pool.supply()`
2. **No swap logic needed initially** — Elitra vaults take WCBTC directly. Can add swap support later.
3. **ABI:** Use `lib/abis/EliteraTeller.json` for Teller, standard ERC20 ABI for approve
4. **Chain ID:** 5115 (Citrea Testnet) not 4114 (Citrea Mainnet)
5. **Next.js:** `'use client'` directive, `dynamic()` instead of `React.lazy()`

**Step 1: Create the component**

Flow:
1. Amount input with WCBTC balance check
2. Build ChainBatch: `[approve(WCBTC, vault, amount), Teller.deposit(WCBTC, amount, 1n)]`
3. Sign EIP-7702 authorization via Privy embedded wallet (`useSign7702Authorization` hook from SDK — verify this exists in Privy 3.6.1, may be `signAuthorization` from `@privy-io/react-auth`)
4. Hash chain batches → compute intent hash → `personal_sign` via embedded wallet's EIP-1193 provider
5. POST to TX Submission API `/actions` endpoint
6. Poll `/intent/{id}/step/0/status` with AbortController
7. On success → `useSpiceStore.addSupply()`, dispatch `vault-deposit-complete` event, show confetti
8. Module-level `let globalExecutionLock = false;` for double-submit protection

**Step 2: Verify**

```bash
npm run build
```

**Step 3: Mount globally**

Add `<SupplyViaSpiceFlow />` in `app/layout.tsx`. Controlled by `useSpiceStore.isSupplyOpen`.

**Step 4: Wire badge popup "Supply" button**

Badge popup's supply button calls `useSpiceStore.openSupply()`.

**Step 5: Verify end-to-end**

```bash
npm run dev
```

Badge → popup → "Supply" → amount input → sign → submit → poll → success (or clear error).

**Step 6: Commit**

```bash
git add components/SpiceFlow/SupplyViaSpiceFlow.tsx app/layout.tsx
git commit -m "feat: add gasless SupplyViaSpiceFlow with EIP-7702 Teller.deposit"
```

---

### Phase 4 Checkpoint

- [ ] `npm run build` — zero errors
- [ ] SupplyViaSpiceFlow modal opens from badge popup
- [ ] Amount input validates against WCBTC balance
- [ ] Empty amount → button disabled
- [ ] Exceeds balance → clear error message
- [ ] EIP-7702 signing step renders (may not complete on testnet without delegate contract — document if so)
- [ ] Intent signing step renders
- [ ] API submission works (or clear error if API is not configured)
- [ ] Close modal during any step → clean state, no orphan polling
- [ ] Open/close 5 times → no zombie listeners
- [ ] `globalExecutionLock` prevents double-submit (rapid double-click → only 1 TX)
- [ ] Browser console — zero errors
- [ ] **BASELINE REGRESSION:** All original features work. Old modals still functional.

**STOP — Show user Phase 4 results. Get approval before Phase 5.**

---

## Phase 5: Integration Wiring + Polish

### Task 5.1: Wire store into DepositFlow success

**Files:**
- Modify: `components/SpiceFlow/DepositFlow.tsx`

Ensure that when the SDK deposit succeeds (detected via CustomEvent or MutationObserver), the store is updated:

```typescript
const { addDeposit, closeDeposit } = useSpiceStore();

// On success detection:
addDeposit({
  asset: detectedAsset || 'WBTC',
  amount: detectedAmount || 0,
  chain: detectedChainName || 'Unknown',
  chainId: detectedChainId || 0,
  status: 'completed',
});
```

**Verify:** Complete a deposit → check `useSpiceStore.getState().depositHistory` in console → record exists. Badge balance updated.

**Commit:**

```bash
git commit -m "feat: wire deposit success into Zustand store"
```

---

### Task 5.2: Wire store into WithdrawFlow success

**Files:**
- Modify: `components/SpiceFlow/WithdrawFlow.tsx`

Same pattern — on withdraw success, call `addWithdraw()` and deduct from `crossChainBalance`.

**Verify:** Complete a withdraw → store updated → badge balance decreased.

**Commit:**

```bash
git commit -m "feat: wire withdraw success into Zustand store"
```

---

### Task 5.3: Update opportunities page to use global modals

**Files:**
- Modify: `app/opportunities/page.tsx`

Currently the opportunities page imports `SpiceDepositModal` and `SpiceWithdrawModal` locally. Update the deposit/withdraw buttons to use `useSpiceStore.openDeposit()` / `useSpiceStore.openWithdraw()` instead, so they trigger the global modals.

Keep the old imports as fallbacks during transition — remove them in a later cleanup task.

**Verify:** Click "Deposit" on opportunities page → global DepositFlow opens (not old SpiceDepositModal).

**Commit:**

```bash
git commit -m "feat: wire opportunities page to global SpiceFlow modals"
```

---

### Task 5.4: Style consistency pass

**Files:**
- Modify: Various SpiceFlow components

Ensure all new components match Elitra's design system:
- White card backgrounds with `border-gray-200` borders
- Blue accent: `#336AFD`
- Font: Poppins (inherited from layout)
- Rounded corners: `rounded-xl` for modals
- Shadows: `shadow-sm` or `shadow-lg`

**Verify:** Visual inspection — no jarring style mismatches between custom UI and SDK widgets.

**Commit:**

```bash
git commit -m "style: align SpiceFlow components with Elitra design system"
```

---

### Phase 5 Checkpoint (Final)

- [ ] `npm run build` — zero errors
- [ ] Full end-to-end: Login → badge shows → deposit → balance increases → supply → balance decreases → withdraw
- [ ] Store persists across page refresh
- [ ] Badge updates in real-time after deposit/withdraw/supply
- [ ] Popup shows deposit history with correct data
- [ ] Opportunities page deposit/withdraw buttons trigger global modals
- [ ] All modals work from every page
- [ ] Open/close all modals rapidly → no errors
- [ ] Browser console — zero errors through entire flow
- [ ] **FULL BASELINE REGRESSION:** Every original feature works identically to Phase 0 snapshot
- [ ] `npm run build` final check — clean

**Commit final phase:**

```bash
git add -A
git commit -m "feat: SpiceFlow full account structure — complete integration"
```

---

## Phase 6: QA Sweep

Follow the `spiceflow-integration-playbook` Phase 5 QA checklist in full:
- Section 5.1: Clean environment test
- Section 5.2: Fund safety & transaction integrity
- Section 5.3: Wallet state matrix
- Section 5.4: Deposit stress testing
- Section 5.5: Withdraw stress testing
- Section 5.7: Error recovery & resilience
- Section 5.8: Race conditions & concurrency
- Section 5.9: Security review
- Section 5.10: Production build verification
- Section 5.12: Performance & bundle impact
- Section 5.13: Final baseline regression

**This is the full 150+ test case sweep. Every test is mandatory.**

---

## File Summary

| File | Action | Phase |
|------|--------|-------|
| `package.json` | Modify (add zustand, pin spiceflow-ui) | 1 |
| `lib/spiceflowConfig.ts` | Create | 1 |
| `store/useSpiceStore.ts` | Create | 2 |
| `components/SpiceFlow/CrossChainAccountBadge.tsx` | Create | 2 |
| `components/SpiceFlow/CrossChainAccountPopup.tsx` | Create | 2 |
| `components/ui/mainnav.tsx` | Modify (add badge) | 2 |
| `components/SpiceFlow/DepositFlow.tsx` | Create | 3 |
| `components/SpiceFlow/WithdrawFlow.tsx` | Create | 3 |
| `app/layout.tsx` | Modify (mount global modals) | 3 |
| `utils/intentCrypto.ts` | Create | 4 |
| `components/SpiceFlow/SupplyViaSpiceFlow.tsx` | Create | 4 |
| `app/opportunities/page.tsx` | Modify (wire to global modals) | 5 |

**Total: 8 new files, 4 modified files**
