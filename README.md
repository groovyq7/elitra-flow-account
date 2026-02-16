# Vault Protocol Frontend

This is the frontend application for the Vault Protocol, a decentralized finance (DeFi) platform for managing vaults, deposits, withdrawals, and portfolio analytics.

## Features

- Multichain support for vaults and tokens
- Connect wallet (RainbowKit, wagmi)
- Deposit and withdraw assets
- Portfolio overview and growth charts
- APY and rewards tracking
- Responsive UI with Tailwind CSS
- Transaction status modals and notifications

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Yarn](https://yarnpkg.com/) or [npm](https://www.npmjs.com/)
- Environment variables for contract addresses and API keys

### Installation

```bash
yarn install
# or
npm install
```

### Running the Development Server

```bash
yarn dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app in your browser.

## Environment Variables

Create a `.env.local` file and set the following variables as needed:

```
NEXT_PUBLIC_VAULT_ADDRESS_1=
NEXT_PUBLIC_TELLER_ADDRESS_1=
NEXT_PUBLIC_ACCOUNTANT_ADDRESS_1=
NEXT_PUBLIC_AUTHORITY_ADDRESS_1=
NEXT_PUBLIC_MANAGER_ADDRESS_1=
# ...add other chain IDs as needed
```

## Analytics (PostHog)

This app uses PostHog for product analytics. The provider is initialized in `components/providers/PostHogProvider.tsx` and safe client-side helpers live in `lib/analytics.ts`.

### Environment variables

Set the following in your environment (e.g., `.env.local`):

```
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

### Page views

We capture client-side navigations as `$pageview` events.

### User identification

On wallet connect, we identify the user by their wallet address and attach chain metadata. On disconnect, we reset identity.

- File: `components/providers/wagmi-provider.tsx`
	- identify on connect: `identifyUser(address, { chainId })`
	- track connect/disconnect: `trackWalletConnected`, `trackWalletDisconnected`
	- track chain change: `trackChainChanged`

### Key events

- Approvals: `approval_attempt`, `approval_success`, `approval_error`
- Deposits: `deposit_attempt`, `deposit_success`, `deposit_failed`
- Withdraws: `withdraw_attempt`, `withdraw_success`, `withdraw_failed`
- Modals: `modal_open` (deposit | withdraw | token-selector)
- Token selection: `token_selected`
- Chart timeframe: `chart_timeframe_selected`

Properties include tokenSymbol, tokenAddress, amount (human), amountWei, amountUSD, chainId, tellerAddress, and reason/txHash where applicable.

### Adding new events

Use `track('event_name', { ...props })` from `lib/analytics.ts` or add a typed helper similar to the existing ones. Ensure calls run only on the client.

## Project Structure

- `app/` — Next.js app directory and pages
- `components/` — Reusable UI components
- `hooks/` — Custom React hooks
- `lib/` — Utility functions and constants
- `public/` — Static assets

## Technologies Used

- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [RainbowKit](https://www.rainbowkit.com/)
- [wagmi](https://wagmi.sh/)
- [viem](https://viem.sh/)

## Contributing

Pull requests and issues are welcome! Please follow conventional commit messages and ensure your code passes linting and tests.

## License