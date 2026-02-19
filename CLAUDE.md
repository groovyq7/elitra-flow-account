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
