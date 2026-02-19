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

### Console.log Policy

- No `console.log` in production code
- Use `console.error` / `console.warn` only inside `catch` blocks where structured logging isn't available
- PostHog analytics (`lib/analytics.ts`) is the approved mechanism for event tracking
