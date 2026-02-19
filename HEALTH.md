# Project Health Report — Elitra SpiceFlow Integration

**Date:** February 19, 2026  
**Review:** 25-pass overnight automated review

---

## Metrics

- **Unit tests:** 422 passing / 0 failing (24 test files)
- **TypeScript:** 0 errors (`tsc --noEmit`)
- **ESLint:** 0 errors (warnings only for intentional `react-hooks/exhaustive-deps` suppressions)
- **Test coverage:** Run `npm run test:coverage` for a detailed text + JSON report (thresholds: 30% line, 25% function)

---

## Architecture

- **SpiceFlow SDK:** `@spicenet-io/spiceflow-ui` 1.11.13 (exact pin — see `scripts/patch-spiceflow.js`)
- **Wallet:** RainbowKit + wagmi + Privy (embedded wallet for gasless 7702 flow)
- **Chains:** Citrea Testnet (5115 — primary), Sepolia (11155111), Arbitrum Sepolia (421614), Base Sepolia (84532)
- **Data:** On-chain reads via viem + subgraph (HyperIndex) for historical vault data

---

## Known Infrastructure Blockers

1. **`GRAPHQL_ENDPOINT`**: Dev endpoint (`https://indexer.dev.hyperindex.xyz/18880d0/v1/graphql`) returns 500s — needs production URL from Spicenet team. The UI degrades gracefully (falls back to on-chain data only).
2. **`SPICENET_RELAYER_DESTINATION`**: Must be set to the production Spicenet TX Submission API URL before deploying. Without it, gasless 7702 flows (SupplyViaSpiceFlow) will not work.

---

## Deployment Prerequisites

See `DEPLOYMENT.md` for the complete checklist. Key items:

- Add deployment domain to Elitra Fork Privy app's allowed origins
- Set all required env vars (see `.env.example`)
- Run `npm ci` — the `postinstall` script patches the SpiceFlow SDK; CI will fail loudly if patches don't apply

---

## Key Patterns

See `CLAUDE.md` for all established code patterns, including:

- Shell/inner component guard for Privy hooks inside SpiceFlow provider tree
- ERC-20 `approve` target is **vault address**, not teller
- BigInt rules for uint256 args
- `bulkWithdrawNow` must pass `minimumAssets` with 0.5% slippage (never `0n`)
- Centralized constants in `lib/spiceflowConfig.ts` (do not re-define locally)

---

## Pass Summary (25 passes, Feb 18–19 2026)

| Pass Range | Focus |
|---|---|
| 1–5 | Core SDK integration, DepositFlow, WithdrawFlow, SpiceFlow provider wiring |
| 6–10 | Hook architecture (useDeposit, useWithdraw, useAllowance, useGaslessTransaction) |
| 11–15 | Analytics, error handling, APY calculation, test suite foundation |
| 16–20 | UI polish, accessibility, PWA manifest, metadata, campaign registration |
| 21–24 | Test coverage expansion (422 tests), type safety, dependency cleanup |
| **25** | **Final journey trace — fixed WithdrawModal 0.5% slippage missing bug; centralized WCBTC_ADDRESS + SOLVER_ADDRESS constants; README chain reference updated** |
