# Elitra — SpiceFlow DeFi App

Elitra is a production DeFi application built on Next.js 14 (App Router) that integrates with the **SpiceFlow SDK** for cross-chain vault deposits, withdrawals, and portfolio management. It runs on **Citrea Testnet** (chain 5115) with multi-chain support (Sepolia, Arbitrum Sepolia, Base Sepolia for cross-chain bridging).

---

## What It Does

- **Vault deposits & withdrawals** — Supply assets (USDC, SEI, WBTC) into yield-bearing vaults via ERC-4626 Boring Vault contracts
- **Cross-chain deposits** — Use the SpiceFlow SDK to bridge from any supported chain and deposit in one flow
- **APY display** — Aggregates real-time APY data from Takara and YEI lending protocols on-chain
- **Campaign registration** — Wallet-based waitlist/campaign registration with MongoDB persistence
- **Portfolio analytics** — TVL display, P&L tracking, and yield scores
- **Embedded wallets** — Privy integration for social login with embedded EVM wallets

---

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url>
cd elitra-flow-account
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Yes | Privy app ID — use `cmlsy3eup004z0cjskfxwce8n` (Elitra Fork) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Yes | WalletConnect v2 project ID (get from cloud.walletconnect.com) |
| `MONGODB_URI` | Yes | MongoDB connection string for campaign registrations |
| `SPICENET_RELAYER_DESTINATION` | Yes (prod) | Full URL of the Spicenet TX Submission API (proxied through `/api/relayer`) |
| `NEXT_PUBLIC_POSTHOG_KEY` | No | PostHog analytics key |
| `NEXT_PUBLIC_GA_ID` | No | Google Analytics measurement ID (e.g. `G-XXXXXXXXXX`) |
| `GRAPHQL_ENDPOINT` | No | HyperIndex GraphQL endpoint for historical vault data |
| `NEXT_PUBLIC_RELAYER_API_URL` | No | Override relayer URL for direct browser → relayer calls (not recommended in prod) |

See `.env.example` for the full list with documentation.

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Running Tests

### Unit tests (Vitest)

```bash
npm run test
# or watch mode:
npm run test:watch
```

Unit tests live in `test/unit/` and cover: APY calculation, PnL computation, token balance utilities.

### E2E tests (Playwright)

```bash
npx playwright install  # first time only
npx playwright test
```

E2E tests live in `test/e2e/` and test UI flows: page load, modal open/close, form validation, wallet connection state.

> Note: E2E tests run against `http://localhost:3000`. Ensure the dev server is running (or Playwright's webServer config will start it).

---

## Deployment

### Vercel (recommended)

1. Connect the repo to Vercel
2. Add all required environment variables (see `.env.example`) in the Vercel dashboard
3. **Important:** Add your Vercel domain to the Privy app's allowed origins at [dashboard.privy.io](https://dashboard.privy.io) → Elitra Fork app → Settings → Allowed Origins
4. Deploy

### Required env vars for production

All `NEXT_PUBLIC_*` vars are bundled into the browser bundle — do not put secrets in them.

Server-only secrets (`MONGODB_URI`, `TEST_WALLET_PRIVATE_KEY`) stay server-side.

---

## Architecture

### Tech Stack

- **Next.js 14** (App Router) — SSR + API routes
- **wagmi + viem** — Ethereum/EVM interactions
- **RainbowKit** — Wallet connection UI
- **Privy** — Social login + embedded wallets
- **SpiceFlow SDK** (`@spiceflow/account`) — Cross-chain deposit orchestration
- **Tailwind CSS + shadcn/ui** — Styling
- **Vitest** — Unit testing
- **Playwright** — E2E testing

### Key Flows

#### Deposit flow

1. User connects wallet (RainbowKit) or uses Privy embedded wallet
2. `useAllowance` hook checks ERC-20 allowance for the **vault address** (not teller)
3. On insufficient allowance: `writeAllowance()` sends `approve(vaultAddress, MAX_UINT256)`
4. `useDeposit` hook calls the Boring Vault teller contract's `deposit()` function
5. Amount is converted with correct decimals (USDC = 6, ETH/SEI = 18) before the contract call

#### SpiceFlow cross-chain deposit

- Rendered inside `SpiceFlowProvider` (wraps its own Privy instance)
- Shell/inner pattern: outer shell components cannot use Privy hooks — inner components must be rendered as children of `SpiceFlowProvider`
- The `useSpiceFlowReady` hook signals when SpiceFlow's Privy context is mounted

#### APY data

- `/api/apy` aggregates data from Takara and YEI protocols
- Protocol routes (`/api/protocols/takara`, `/api/protocols/yei`) read on-chain data via viem `publicClient`
- The APY route calls `fetchTakaraData()` and `fetchYeiData()` as direct function imports (not HTTP self-calls)
- Results are cached in-memory with TTL via `lib/utils/simple-api-cache.ts`

### Directory Structure

```
app/             — Next.js pages and API routes
  api/           — Server-side API routes (APY, protocols, campaign, relayer)
components/
  ui/            — Generic UI primitives (shadcn-based)
  wallet/        — Wallet connection components
  SpiceFlow/     — Cross-chain deposit UI
  providers/     — React context providers (wagmi, PostHog, error boundaries)
hooks/           — Custom React hooks (useDeposit, useWithdraw, useAllowance, etc.)
lib/
  contracts/     — Contract addresses, ABIs, vault registry
  utils/         — Formatting, balance fetching, APY math, caching
  abis/          — ABI JSON files (Takara, YEI markets)
  wagmi.ts       — Chain and wallet config
services/        — ErrorHandler
test/
  unit/          — Vitest unit tests
  e2e/           — Playwright E2E tests
```

### Chain IDs

| Network | Chain ID |
|---|---|
| SEI Mainnet | 1329 |
| SEI Testnet (Atlantic-2) | 713715 |
| Citrea Testnet | 5115 |
| Sepolia | 11155111 |
| Arbitrum Sepolia | 421614 |
| Base Sepolia | 84532 |

---

## Analytics (PostHog)

PostHog is initialized in `components/providers/PostHogProvider.tsx`. Key events tracked:

- `deposit_attempt` / `deposit_success` / `deposit_failed`
- `withdraw_attempt` / `withdraw_success` / `withdraw_failed`
- `approval_attempt` / `approval_success` / `approval_error`
- `modal_open` (deposit | withdraw | token-selector)
- `wallet_connected` / `wallet_disconnected`

See `lib/analytics.ts` for typed event helpers.

---

## Notes for Contributors

- **Never** reuse the Zentra Privy app ID (`cmli6tyqk0599js0c62h22u4e`) — always use the Elitra Fork ID
- Use `BigInt(0)` / `0n` for uint256 arguments — never `0` or `1` (causes type errors with viem)
- USDC has 6 decimals; ETH/SEI have 18 — always pass correct decimals to `parseUnits`
- ERC-20 `approve` target is the **vault address**, not the teller address
- See `CLAUDE.md` for the full list of patterns and anti-patterns established during development
