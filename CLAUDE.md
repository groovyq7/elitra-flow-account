# Project: Elitra SpiceFlow Integration

## Reference Files (READ FIRST)
- `.skills/zentra-sdk-gotchas.md` - Known mistakes and anti-patterns. CHECK ALL OF THESE.
- `.skills/account-ux-patterns.md` - Account UX patterns (badge, popup, dashboard).
- `.skills/spiceflow-ui-reference.md` - SDK component source reference.
- `.skills/spiceflow-docs.md` - SDK documentation.

## Privy App ID
- Elitra uses its OWN Privy app (`cmlsy3eup004z0cjskfxwce8n` — "Elitra Fork" in dashboard)
- Set via `NEXT_PUBLIC_PRIVY_APP_ID` env var; fallback is the Elitra Fork ID
- NEVER inherit or reuse the Zentra app ID (`cmli6tyqk0599js0c62h22u4e`)
- When setting up a new deployment, always add its domain to the Elitra Fork Privy app's allowed origins

## Quality Standard
Production-grade DeFi code. No shortcuts. Every edge case handled.

---

## Established Patterns (from overnight deep review — Feb 2026)

### Shell/Inner Component Pattern (Privy + SpiceFlow)

SpiceFlow has its own internal Privy provider. Components that call Privy hooks (`usePrivy`, `useWallets`, etc.) **must** be rendered as children inside SpiceFlow's provider tree — they cannot be called in the outer shell.

Pattern:
```tsx
// ✅ Correct: inner component uses Privy hooks
function PrivyNavItems() {
  const { authenticated } = usePrivy();  // Safe — inside SpiceFlow provider
  return ...;
}

// Outer shell uses useSpiceFlowReady to gate the inner component
export default function MainNav() {
  const isSpiceFlowReady = useSpiceFlowReady();
  return (
    <>
      {isSpiceFlowReady && <PrivyNavItems />}
    </>
  );
}
```

Never call `usePrivy()` / `useWallets()` outside a component that is rendered inside the SpiceFlow provider.

### ERC-20 Approve — Target is Vault, Not Teller

When calling `approve(spender, amount)` for vault deposits:
- ✅ `spender = vault address` (the ERC-4626 vault contract)
- ❌ NOT `spender = teller address`

The teller is the entry point for `deposit()`, but allowance is granted to the vault.

### BigInt Rules

Always use BigInt literals for uint256 arguments in viem/wagmi calls:
- ✅ `0n`, `1n`, `BigInt(amount)`
- ❌ `0`, `1`, `Number(amount)` — causes TypeScript type errors and potential precision loss

For max approval: use `BigInt("0xff...ff")` (MAX_UINT256), not `2n**256n - 1n` (slower).

### Decimal Precision Rules

| Token | Decimals | parseUnits example |
|-------|----------|-------------------|
| USDC  | 6        | `parseUnits("1.0", 6)` → `1_000_000n` |
| ETH, SEI, WBTC | 18 | `parseUnits("1.0", 18)` |

Always use `parseUnits(amount, token.decimals)` — never multiply by `1e6` or `1e18` manually.

### Error Boundary Pattern

Each major page/section has an error boundary:
- `SpiceFlowErrorBoundary` wraps the SpiceFlow SDK render
- `VaultErrorBoundary`, `OpportunitiesErrorBoundary`, `CampaignErrorBoundary` wrap their respective pages
- Error boundaries log to console in dev, fail gracefully in prod
- Pattern: `components/providers/ErrorBoundary.tsx` — extend `React.Component<Props, State>`

### Address Validation Before Contract Calls

Before calling any wagmi `writeContract` or `readContract`, validate addresses with viem's `isAddress()`:
```ts
import { isAddress } from "viem"
if (!isAddress(spender)) {
  toast.error("Invalid spender address")
  return
}
```

This prevents silent failures or on-chain calls with `0x` / empty string addresses.

### APY Route — Direct Function Calls, Not HTTP Self-Fetch

The `/api/apy` route calls Takara and YEI protocol data by importing `fetchTakaraData` and `fetchYeiData` directly — **not** via `fetch("${origin}/api/protocols/...")`.

HTTP self-calls fail silently in serverless contexts when `url.origin` resolves to `localhost:3000`. The correct pattern is to export a plain async function from each route file and import it.

### useQuery Hook — Memo Your Variables

When calling `useQuery({ query, variables })`, ensure `variables` is memoized with `useMemo` or defined as a static constant — otherwise a new object is created on every render and the query will re-fetch in a loop.

```ts
// ✅ Memoized
const vars = useMemo(() => ({ id: vaultId }), [vaultId]);
const [result] = useQuery({ query: MY_QUERY, variables: vars });
```

### Campaign Registration — Idempotent Upsert

`/api/campaign/register` uses MongoDB upsert (`updateOne` with `upsert: true`) keyed by wallet address. Re-submitting the same wallet is safe and idempotent — no duplicate documents.

### Async Effect Cleanup Pattern

All async `useEffect` calls must use a `cancelled` flag to prevent setState-after-unmount:

```ts
useEffect(() => {
  let cancelled = false;
  async function fetchData() {
    const result = await someAsyncCall();
    if (!cancelled) setState(result);
  }
  fetchData();
  return () => { cancelled = true; };
}, [deps]);
```

### ESLint Configuration

`.eslintrc.json` enforces:
- `no-console` (warn) — allows `console.error` / `console.warn` only
- `prefer-const` (error) — use `const` for variables that are never reassigned
- `@typescript-eslint/no-unused-vars` (error) — prefix intentionally unused vars/args with `_`

Run: `npm run lint` — exits 0 with only react-hooks/exhaustive-deps warnings (pre-existing intentional dep suppressions).

### Unused Variable Convention

When a prop/param must exist in an interface but isn't used in the implementation, prefix with `_` using destructuring rename syntax:
```ts
// ✅ Correct
function Foo({ bar: _bar, baz }: Props) { /* uses baz, not bar */ }

// ✅ For catch blocks — just omit the binding
} catch { /* no binding needed */ }
```

### Console.log Policy

- No `console.log` in production code
- Use `console.error` / `console.warn` only inside `catch` blocks where structured logging isn't available
- PostHog analytics (`lib/analytics.ts`) is the approved mechanism for event tracking

### Dependencies

Run `npm install` after pulling if `package.json` changed (lockfile may need sync after dependency changes).
Removed unused dependencies in Feb 2026 deep review: `@dynamic-labs/ethereum`, `@dynamic-labs/sdk-react-core`, `jotai`.

**Coverage:** `@vitest/coverage-v8` was added as a devDependency (Feb 2026). Run `npm install` once to install it. After that, `npm run test:coverage` produces a text + json-summary coverage report with 30% line / 25% function thresholds.

---

## SDK Patch: @spicenet-io/spiceflow-ui

### What it does

`scripts/patch-spiceflow.js` makes 8 sets of regex-based patches to the minified
SpiceFlow SDK bundle (`node_modules/@spicenet-io/spiceflow-ui/dist/index.js` and
`index.cjs.js`) to enable integration with an external RainbowKit wallet instead
of Privy's embedded wallet.

**Target SDK version:** `1.11.13` (exact pin, no caret).

### Why we patch instead of forking

The SDK is closed-source. Patching the minified bundle is the only option for
fixing integration issues without maintaining a full fork upstream.

### Patches applied

| # | Label | What it does |
|---|-------|-------------|
| 1 | `closeOnSelect` | Prevents SelectChainModal from closing the deposit flow on chain select |
| 2 | `skip-privy` | Skips the "provider-login" (Privy auth) step; goes straight to "connect-wallet" |
| 3 | `external-wallet-override` | Adds `externalWalletAddress` prop to SpiceDeposit inner; overrides `useAccount()` |
| 4 | `skip-connect-wallet` | Skips "connect-wallet" step when wallet is already connected |
| 5 | `sn-wallet-check` | Fixes wallet-connected check to consider `externalWalletAddress` in 7702 mode |
| 6 | `sn-skip-privy-exec` | Skips Privy auth checks during deposit execution when external wallet is present |
| 7 | `sn-bypass-privy-auth-btn` | Bypasses "Authentication Required" button text when external wallet is connected |
| 8 | `sn-7702-address-fallback` | Uses `externalWalletAddress` as fallback for embedded wallet address in 7702 flow |

### How to update when the SDK version changes

1. Update `"@spicenet-io/spiceflow-ui"` version pin in `package.json`.
2. Bump `EXPECTED_VERSION` in `scripts/patch-spiceflow.js`.
3. Run `npm install` — the postinstall will fail with pattern-not-found warnings.
4. Diff the new minified bundle vs the old to find what changed.
5. Update each `patch()` call's `oldPattern`/`newPattern` as needed.
6. Update the `verify()` calls at the bottom of the script for the new patterns.
7. Run `node scripts/patch-spiceflow.js` manually and confirm all `VERIFIED` lines print.

### Verification

The script runs `verify()` after all patches and calls `process.exit(1)` if any
expected pattern is missing. `npm ci` in CI will fail loudly if patches don't apply.

### Note on `console.log("IS NON 7702", ...)`

This log originates from the SDK's own source. It is preserved in the patched output
(Patches 6a/6b can't avoid it). It is not added by us; it will disappear when the
SDK vendor removes it upstream.

## ABI Files

ABI files in `lib/abis/` include some unused ABIs for future use — do not delete without checking with the Spicenet team.

See `lib/abis/README.md` for a full breakdown of which ABIs are actively used vs. included for future features or external integrators.

---

## Centralized SpiceFlow Constants (lib/spiceflowConfig.ts)

`WCBTC_ADDRESS`, `SOLVER_ADDRESS`, `DELEGATE_CONTRACTS`, `SUPPORTED_CHAIN_IDS`, and `SPICENET_API_URL` are **single-source-of-truth** constants in `lib/spiceflowConfig.ts`.

Do NOT re-define these locally in components. Always import:

```ts
import { WCBTC_ADDRESS, SOLVER_ADDRESS } from "@/lib/spiceflowConfig";
```

### Withdrawal Slippage — Always Pass minAmount

`bulkWithdrawNow(token, shares, minimumAssets, recipient)` requires a minimum assets guard:

```ts
// ✅ Correct: 0.5% slippage protection
const assetsInWei = (sharesInWei * vaultRate) / SCALE;
const minimumAssets = assetsInWei - (assetsInWei * 5n) / 1000n; // 99.5%
writeWithdraw({ args: [token, shares, minimumAssets, receiver] });

// ❌ Wrong: no slippage protection, user can receive nothing
writeWithdraw({ args: [token, shares, 0n, receiver] });
```

The SpiceWithdrawModal (SDK-driven flow) handles this correctly via `withdrawBatches`.
The standard WithdrawModal (direct teller call) must also apply slippage — verified in Pass 25.
