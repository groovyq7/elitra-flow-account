import {
  Chain as ViemChain,
} from "viem";
import {
  sepolia,
  arbitrumSepolia,
  citreaTestnet,
  baseSepolia,
} from "viem/chains";
import { CBTC_LOGO_URI } from "@/lib/constants";

export interface Chain {
  id: number;
  name: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorers?: {
    default: {
      name: string;
      url: string;
    };
  };
}
export interface TokenConfig {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

export interface ChainConfig {
  id: number;
  name: string;
  displayName: string;
  shortName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorers: {
    default: {
      name: string;
      url: string;
    };
  };
  viemChain?: ViemChain;
  delegateContract: string;
  icon: {
    symbol: string;
    backgroundColor: string;
    textColor: string;
  };
  moralisName?: string;
  isTestnet: boolean;
  supportedTokens: TokenConfig[];
}

export const CHAIN_CONFIGS: { [chainId: number]: ChainConfig } = {
  // Ethereum Sepolia
  11155111: {
    id: 11155111,
    name: "Ethereum Sepolia",
    displayName: "Sepolia",
    shortName: "SEP",
    nativeCurrency: {
      name: "Sepolia Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
    blockExplorers: {
      default: {
        name: "Etherscan",
        url: "https://sepolia.etherscan.io",
      },
    },
    viemChain: sepolia,
    delegateContract: "0xDF7d39BB544778F467D10b08B1F5C170fd7fB480",
    icon: {
      symbol: "Ξ",
      backgroundColor: "#627EEA",
      textColor: "#FFFFFF",
    },
    moralisName: "sepolia",
    isTestnet: true,
    supportedTokens: [
      {
        address: "0x4Fc381B6CC6Df8cF1c1bD46D184475bE5b7A3c62",
        name: "Mock Wrapped BTC",
        symbol: "WBTC",
        decimals: 8,
      },
    ],
  },

  // Arbitrum Sepolia
  421614: {
    id: 421614,
    name: "Arbitrum Sepolia",
    displayName: "Arbitrum Sepolia",
    shortName: "ARB_SEPOLIA",
    isTestnet: true,
    nativeCurrency: {
      name: "Sepolia Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
    blockExplorers: {
      default: {
        name: "Arbiscan",
        url: "https://sepolia.arbiscan.io",
      },
    },
    viemChain: arbitrumSepolia,
    delegateContract: "0x151755d1bdFeB6082D141EF86e4291b2e902b43F",
    icon: {
      symbol: "A",
      backgroundColor: "#28A0F0",
      textColor: "#FFFFFF",
    },
    moralisName: "",
    supportedTokens: [
      {
        address: "0xBA4c54d4CF10C766c22A08F783998cFaB237F7C9",
        name: "Wrapped Bitcoin",
        symbol: "WBTC",
        decimals: 8,
      },
    ],
  },

  // Base Sepolia
  84532: {
    id: 84532,
    name: "Base Sepolia",
    displayName: "Base Sepolia",
    shortName: "BASE_SEPOLIA",
    isTestnet: true,
    nativeCurrency: {
      name: "Sepolia Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: ["https://sepolia.base.org"],
    blockExplorers: {
      default: {
        name: "Basescan",
        url: "https://sepolia.basescan.org",
      },
    },
    viemChain: baseSepolia,
    delegateContract: "0xD4C4A222cdd42f5c3219249a083a5aBf1420E9D8",
    icon: {
      symbol: "B",
      backgroundColor: "#0052FF",
      textColor: "#FFFFFF",
    },
    moralisName: "0x14a34",
    supportedTokens: [
      {
        address: "0x16DD3a855433059Be478FAcb416D9aFed6CA96Ec",
        name: "Mock Wrapped BTC",
        symbol: "WBTC",
        decimals: 8,
      },
    ],
  },

  // Citrea Testnet
  5115: {
    id: 5115,
    name: "Citrea Testnet",
    displayName: "Citrea Testnet",
    shortName: "CITREA",
    nativeCurrency: {
      name: "cBTC",
      symbol: "cBTC",
      decimals: 18,
    },
    rpcUrls: ["https://rpc.testnet.citrea.xyz"],
    blockExplorers: {
      default: {
        name: "Citrea Explorer",
        url: "https://explorer.testnet.citrea.xyz",
      },
    },
    viemChain: citreaTestnet,
    delegateContract: "0x9DE3D53419a8F821b6E2039A7249c5738004FB94",
    icon: {
      symbol: "C",
      backgroundColor: "#EA4B4B",
      textColor: "#FFFFFF",
    },
    moralisName: "",
    isTestnet: true,
    supportedTokens: [
      {
        address: "0x8d0c9d1c17aE5e40ffF9bE350f57840E9E66Cd93",
        name: "Wrapped Citrea BTC",
        symbol: "WCBTC",
        decimals: 18,
        logoURI: CBTC_LOGO_URI,
      },
    ],
  },
};

/**
 * Map of spice symbols to cross-chain token symbols
 */
const CROSS_CHAIN_TOKEN_MAP: Record<string, string[]> = {
  CBTC: ["WBTC"],
  WCBTC: ["WCBTC"],
  NUSD: ["USDC"],
};

// Utility functions

/**
 * Get chain configuration by ID
 */
export const getChainConfig = (chainId: number): ChainConfig | undefined => {
  return CHAIN_CONFIGS[chainId];
};

/**
 * Get supported tokens for a chain
 */
export const getSupportedTokens = (chainId: number): TokenConfig[] => {
  const config = getChainConfig(chainId);
  return config?.supportedTokens || [];
};

/**
 * Get target addresses for a given spice symbol
 */
export const getTargetAddresses = (spiceSymbol: string): string[] => {
  const crossChainSymbols = CROSS_CHAIN_TOKEN_MAP[spiceSymbol] || [];

  return Object.values(CHAIN_CONFIGS)
    .flatMap((chain) => chain.supportedTokens)
    .filter((token) => crossChainSymbols.includes(token.symbol))
    .map((token) => token.address.toLowerCase());
};
