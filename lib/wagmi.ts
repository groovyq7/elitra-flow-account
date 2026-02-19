import { http, createConfig } from "wagmi";
import { defineChain } from "viem";
import { sepolia, arbitrumSepolia, baseSepolia } from "viem/chains";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
  coinbaseWallet,
} from "@rainbow-me/rainbowkit/wallets";

export const seiMainnet = defineChain({
  id: 1329,
  name: "Sei",
  nativeCurrency: {
    decimals: 18,
    name: "Sei",
    symbol: "SEI",
  },
  rpcUrls: {
    default: {
      http: ["https://sei-mainnet.g.alchemy.com/v2/GCdwE4pZmgN9WnmlWIgpS"],
    },
  },
  blockExplorers: {
    default: { name: "Seitrace", url: "https://seitrace.com" },
  },
});

export const seiTestnet = defineChain({
  id: 713715,
  name: "Sei Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Sei",
    symbol: "SEI",
  },
  rpcUrls: {
    default: {
      http: ["https://evm-rpc-testnet.sei-apis.com"],
    },
  },
  blockExplorers: {
    default: { name: "Seitrace Testnet", url: "https://seitrace.com" },
  },
});

export const citreaTestnet = defineChain({
  id: 5115,
  name: "Citrea Testnet",
  nativeCurrency: { name: "cBTC", symbol: "cBTC", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.citrea.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Citrea Explorer",
      url: "https://explorer.testnet.citrea.xyz",
      apiUrl: "https://explorer.testnet.citrea.xyz/api",
    },
  },
  testnet: true,
});

export const supportedChains = [citreaTestnet] as const;
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "your-walletconnect-project-id";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [
        rainbowWallet,
        walletConnectWallet,
        metaMaskWallet,
        coinbaseWallet,
      ],
    },
  ],
  {
    appName: "Elitra Vaults",
    projectId: projectId,
  }
);

// WalletConnect project ID - in production this should be from env vars

// In test mode, add the mock connector so tests can auto-connect without MetaMask
const testConnectors =
  process.env.NEXT_PUBLIC_USE_TEST_WALLET === "true"
    ? (() => {
        const { mock } = require("wagmi/connectors");
        return [mock({ accounts: [process.env.NEXT_PUBLIC_TEST_WALLET_ADDRESS as `0x${string}` || "0xc6D299a212868f12A5F05f9e414Af662615aF715"] })];
      })()
    : [];

export const config = createConfig({
  chains: [citreaTestnet, sepolia, arbitrumSepolia, baseSepolia],
  connectors: process.env.NEXT_PUBLIC_USE_TEST_WALLET === "true" ? testConnectors : connectors,
  transports: {
    [citreaTestnet.id]: http(),
    [sepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
    [baseSepolia.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
