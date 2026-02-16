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
const projectId = "your-walletconnect-project-id";

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

export const config = createConfig({
  chains: [citreaTestnet, sepolia, arbitrumSepolia, baseSepolia],
  connectors: connectors,
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
