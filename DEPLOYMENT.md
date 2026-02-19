# Deployment Guide

## Required Environment Variables

All variables are read from `.env.local` in development. In production (Vercel), set them
in the Vercel project dashboard under **Settings → Environment Variables**.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | ✅ Yes | Privy authentication app ID. Use the Elitra Fork app: `cmlsy3eup004z0cjskfxwce8n`. After deploying to a new domain, add that domain to the allowed origins list in the Privy dashboard. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | ✅ Yes | WalletConnect v2 project ID. Get one at [cloud.walletconnect.com](https://cloud.walletconnect.com). |
| `MONGODB_URI` | ✅ Yes | MongoDB connection string for storing campaign/waitlist wallet registrations. Use `mongodb+srv://...` for Atlas (TLS is implicit). Add `?tls=true` if using a plain `mongodb://` URI. |
| `NEXT_PUBLIC_POSTHOG_KEY` | ⚠️ Recommended | PostHog analytics project API key (`phc_...`). If omitted, analytics are silently disabled. |
| `NEXT_PUBLIC_POSTHOG_HOST` | ⚠️ Recommended | PostHog API host. Defaults to `https://eu.i.posthog.com`. |
| `GRAPHQL_ENDPOINT` | ⚠️ Recommended | HyperIndex GraphQL endpoint for live vault metrics. Defaults to the dev endpoint (see Known Blockers). |
| `NEXT_PUBLIC_RELAYER_API_URL` | Optional | SpiceNet relayer API URL. Defaults to `/api/relayer` (local Next.js proxy). |
| `SPICENET_RELAYER_DESTINATION` | Optional | Destination URL the local relayer proxy forwards to. Defaults to `https://tx-submission-testnet.spicenet.io`. Set to the production URL for mainnet. |
| `RPC_URL` | Optional | RPC URL for SEI mainnet read-only calls. Defaults to `https://evm-rpc.sei-apis.com`. |
| `NODE_OPTIONS` | ✅ Yes (Vercel) | Set to `--max-old-space-size=3072` to prevent OOM build failures on Vercel. |
| `NEXT_PUBLIC_VAULT_ADDRESS_1329_SEI` | Optional | Override SEI mainnet vault contract address. |
| `NEXT_PUBLIC_TELLER_ADDRESS_1329_SEI` | Optional | Override SEI mainnet Teller contract address. |
| `NEXT_PUBLIC_ACCOUNTANT_ADDRESS_1329_SEI` | Optional | Override SEI mainnet Accountant contract address. |
| `NEXT_PUBLIC_VAULT_ADDRESS_5115_CBTC` | Optional | Override Citrea testnet CBTC vault address. |
| `NEXT_PUBLIC_TELLER_ADDRESS_5115_CBTC` | Optional | Override Citrea testnet CBTC Teller address. |
| `NEXT_PUBLIC_ACCOUNTANT_ADDRESS_5115_CBTC` | Optional | Override Citrea testnet CBTC Accountant address. |
| `NEXT_PUBLIC_VAULT_ADDRESS_5115_NUSD` | Optional | Override Citrea testnet NUSD vault address. |
| `NEXT_PUBLIC_TELLER_ADDRESS_5115_NUSD` | Optional | Override Citrea testnet NUSD Teller address. |
| `NEXT_PUBLIC_ACCOUNTANT_ADDRESS_5115_NUSD` | Optional | Override Citrea testnet NUSD Accountant address. |

> **Test/CI only** — never set in production:
> - `NEXT_PUBLIC_USE_TEST_WALLET` — enables mock wallet for Playwright tests
> - `NEXT_PUBLIC_TEST_WALLET_ADDRESS` — test wallet address
> - `TEST_WALLET_PRIVATE_KEY` — test wallet private key (never a funded mainnet key)

---

## Known Blockers (as of 2026-02-19)

### 1. GRAPHQL_ENDPOINT returns 500s on Vercel

The default dev endpoint (`https://indexer.dev.hyperindex.xyz/18880d0/v1/graphql`) returns
HTTP 500 when called from Vercel's edge network.

**Impact:** Live APY, TVL, rate snapshots, and historical metrics fall back to static/cached
values. Users see a "Historical data unavailable" banner on vault pages. The app does not
crash — all components degrade gracefully to the statically-registered vault data.

**Fix:** Get the production HyperIndex endpoint from the Spicenet team and set:
```
GRAPHQL_ENDPOINT=https://<production-endpoint>/v1/graphql
```

### 2. SPICENET_RELAYER_DESTINATION points to testnet

The default relayer destination (`https://tx-submission-testnet.spicenet.io`) is the
testnet URL. For mainnet, you must set the production relayer URL.

**Fix:** Get the production relayer URL from the Spicenet team and set:
```
SPICENET_RELAYER_DESTINATION=https://<production-relayer-url>
```

---

## Vercel Deployment Checklist

- [ ] Set `NEXT_PUBLIC_PRIVY_APP_ID` (Elitra Fork: `cmlsy3eup004z0cjskfxwce8n`)
- [ ] Add deployment domain to Privy dashboard allowed origins
- [ ] Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- [ ] Set `MONGODB_URI` (Atlas SRV URI recommended)
- [ ] Set `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`
- [ ] Set `GRAPHQL_ENDPOINT` (production URL from Spicenet team — see Known Blockers)
- [ ] Set `SPICENET_RELAYER_DESTINATION` (production relayer URL for mainnet)
- [ ] Set `NODE_OPTIONS=--max-old-space-size=3072` (prevents OOM build failures)
- [ ] Verify SDK patches applied: check build logs for `[patch-spiceflow] VERIFIED` messages
- [ ] If deploying to a new domain, update Privy allowed origins and WalletConnect allowed domains

---

## SpiceFlow SDK Version

The SpiceFlow SDK (`@spicenet-io/spiceflow-ui`) is pinned to exact version **1.11.13**.

> ⚠️ **Do NOT upgrade without updating `scripts/patch-spiceflow.js`.**

The SDK requires a post-install patch (`postinstall` script in `package.json`) to fix
compatibility issues. Upgrading the SDK version without updating the patch script will break
the build.

See `CLAUDE.md` for the full patch update guide, including how to verify patch signatures and
update the expected file hashes.

---

## Build Notes

### Memory requirements

Next.js builds require ~3 GB of heap on Vercel. Always set:
```
NODE_OPTIONS=--max-old-space-size=3072
```

### SDK patch verification

During `npm install`, the `postinstall` script runs `scripts/patch-spiceflow.js`. The build
logs should contain:
```
[patch-spiceflow] VERIFIED — patch applied successfully
```

If you see `[patch-spiceflow] FAILED`, the SDK version has changed and the patch needs
updating. See `CLAUDE.md` for instructions.

### TypeScript

Run `npx tsc --noEmit` before deploying to catch type errors. The project enforces strict
TypeScript (`"strict": true` in `tsconfig.json`).
