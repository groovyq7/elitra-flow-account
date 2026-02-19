// Centralized SpiceFlow configuration constants
// All chain IDs, delegate contracts, and API config in one place

export const SUPPORTED_CHAIN_IDS = [11155111, 421614, 84532, 5115] as const;
export const SPICEFLOW_MODE = '7702' as const;
export const NATIVE_CHAIN_ID = 5115; // Citrea Testnet
export const SPICENET_API_URL =
  process.env.NEXT_PUBLIC_RELAYER_API_URL || '/api/relayer';

export const SOLVER_ADDRESS =
  "0x111115763723B53395308eC4c9AB9d5FB0844cae" as `0x${string}`;

export const DELEGATE_CONTRACTS: Record<number, `0x${string}`> = {
  11155111: "0xDF7d39BB544778F467D10b08B1F5C170fd7fB480", // Sepolia
  421614: "0x151755d1bdFeB6082D141EF86e4291b2e902b43F",   // Arbitrum Sepolia
  84532: "0xD4C4A222cdd42f5c3219249a083a5aBf1420E9D8",    // Base Sepolia
  5115: "0x9DE3D53419a8F821b6E2039A7249c5738004FB94",     // Citrea Testnet
};

// WCBTC token address on Citrea Testnet (destination token for vault deposits)
export const WCBTC_ADDRESS =
  "0x8d0c9d1c17aE5e40ffF9bE350f57840E9E66Cd93" as `0x${string}`;

// Note: NEXT_PUBLIC_RELAYER_API_URL is optional.
// When unset (the default), SPICENET_API_URL defaults to '/api/relayer' which proxies
// requests through next.config.mjs rewrites to SPICENET_RELAYER_DESTINATION.
// Only set NEXT_PUBLIC_RELAYER_API_URL if you want to bypass the proxy and call
// the relayer URL directly from the browser (not recommended in production).
