// Multichain official tokens list: chainId -> array of tokens

import { zeroAddress } from "viem";
import { TokenType } from "./types";
// Add or update tokens as needed for each chain
export const OFFICIAL_TOKENS: Record<number, Array<TokenType>> = {
  // SEI Mainnet (example: 1329)
  1329: [
    {
      address: zeroAddress, // SEI native token
      symbol: "SEI",
      name: "Sei",
      decimals: 18,
      noBalanceText: "Don’t have SEI?",
      dexLink: "https://app.sei.io/onboarding",
      wrappedAddress: "0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7",
    },
    // {
    //   address: "0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7", 
    //   symbol: "WSEI",
    //   name: "Wrapped SEI",
    //   decimals: 18,
    //   noBalanceText: "Don’t have WSEI?",
    //   dexLink: "https://app.sei.io/onboarding",
    //   wrappedAddress: "0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7"
    // },
    // {
    //   address: "0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392",
    //   symbol: "USDC",
    //   name: "USD Coin",
    //   decimals: 6,
    //   noBalanceText: "Don’t have USDC? Swap",
    //   dexLink: "https://dragonswap.app/swap?inputCurrency=&outputCurrency=0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392",
    //   wrappedAddress: "0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392"
    // }
    // Add more tokens as needed
  ],
  // Ethereum Mainnet (example: 1)
  1: [
    {
      address: "0x0000000000000000000000000000000000000000", // Example: ETH (native, placeholder)
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18,
    },
    // Add more tokens as needed
  ],
  // Citrea Testnet
  5115: [
    {
      address: zeroAddress,
      symbol: "CBTC",
      name: "Citrea BTC",
      decimals: 18,
      noBalanceText: "Get Testnet CBTC from Faucet",
      dexLink: "https://citrea.xyz/faucet",
      wrappedAddress: "0x8d0c9d1c17aE5e40ffF9bE350f57840E9E66Cd93",
    },
    {
      address: "0x9B28B690550522608890C3C7e63c0b4A7eBab9AA",
      symbol: "NUSD",
      name: "Nectra USD",
      decimals: 18,
      noBalanceText: "Don’t have NUSD? Swap CBTC on Satsuma",
      dexLink: "https://www.satsuma.exchange/",
      wrappedAddress: "0x9B28B690550522608890C3C7e63c0b4A7eBab9AA",
    },
    // {
    //   address: "0x8d0c9d1c17aE5e40ffF9bE350f57840E9E66Cd93",
    //   symbol: "WCBTC",
    //   name: "Wrapped Citrea BTC",
    //   decimals: 18,
    // },
    // {
    //   address: "0x4126E0f88008610d6E6C3059d93e9814c20139cB",
    //   symbol: "WETH",
    //   name: "Wrapped Ether",
    //   decimals: 18,
    // },
    // {
    //   address: "0x36c16eaC6B0Ba6c50f494914ff015fCa95B7835F",
    //   symbol: "USDC",
    //   name: "USDC",
    //   decimals: 18,
    // },
    // {
    //   address: "0x9B28B690550522608890C3C7e63c0b4A7eBab9AA",
    //   symbol: "NUSD",
    //   name: "NUSD",
    //   decimals: 18,
    // },
    // {
    //   address: "0x97a4f684620D578312Dc9fFBc4b0EbD8E804ab4a",
    //   symbol: "veSUMA",
    //   name: "Vested SUMA",
    //   decimals: 18,
    // },
    // {
    //   address: "0xdE4251dd68e1aD5865b14Dd527E54018767Af58a",
    //   symbol: "SUMA",
    //   name: "SUMA",
    //   decimals: 18,
    // },
    // Add more tokens as needed
  ],
};

export const VAULT_TOKENS: Record<
  number,
  Array<{
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  }>
> = {
  // SEI Mainnet (example: 1329)
  1329: [
    // {
    //   address: "0x2a75D11c3D289873698cAfcA1196A12C0e82e1aa", // Example: ELITRA
    //   symbol: "eUSDC",
    //   name: "Elitra USDC",
    //   decimals: 18,
    // },
    {
      address: "0xE41A97bCfc4c23Db5A5dE9f0e79df751F7562C04", // Example: ELITRA
      symbol: "eSEI",
      name: "Elitra SEI",
      decimals: 18,
    }
    // Add more tokens as needed
  ],
  // Ethereum Mainnet (example: 1)
  1: [
    {
      address: "0x0000000000000000000000000000000000000000", // Example: ETH (native, placeholder)
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18,
    },
    // Add more tokens as needed
  ],
  // Citrea Testnet
  5115: [
    {
      address: "0x2876a1fb400c238b0a9e4edd2e7e03d3cf9b53c2",
      name: "CBTC Vault",
      symbol: "eCBTC",
      decimals: 18,
    },
    {
      address: "0x2d41d86bb9e7161561fa3186b47d160467efcee3",
      name: "NUSD Vault",
      symbol: "eNUSD",
      decimals: 18,
    },
  ],
};

// Protocol/Vault related address bundle
export interface ProtocolAddresses {
  vaultAddress: string;
  tellerAddress: string;
  accountantAddress: string;
}

// Multichain address map: chainId -> tokenSymbol -> addresses
// Both base token (e.g. CBTC) and vault/share token (e.g. ECBTC) point to same protocol contracts for now.
export const ADDRESSES: Record<number, Record<string, ProtocolAddresses>> = {
  // SEI Mainnet (example: 1329)
  1329: {
    SEI: {
      vaultAddress:
        process.env.NEXT_PUBLIC_VAULT_ADDRESS_1329_SEI ||
        "0xE41A97bCfc4c23Db5A5dE9f0e79df751F7562C04",
      tellerAddress:
        process.env.NEXT_PUBLIC_TELLER_ADDRESS_1329_SEI ||
        "0xCb428680885a6F9D1EbF83f492Cde733902fCB7f",
      accountantAddress:
        process.env.NEXT_PUBLIC_ACCOUNTANT_ADDRESS_1329_SEI ||
        "0x25De27f15c1c1697dFF38b8A379B113E616ABe58",
    },
    ESEI: {
      vaultAddress:
        process.env.NEXT_PUBLIC_VAULT_ADDRESS_1329_SEI ||
        "0xE41A97bCfc4c23Db5A5dE9f0e79df751F7562C04",
      tellerAddress:
        process.env.NEXT_PUBLIC_TELLER_ADDRESS_1329_SEI ||
        "0xCb428680885a6F9D1EbF83f492Cde733902fCB7f",
      accountantAddress:
        process.env.NEXT_PUBLIC_ACCOUNTANT_ADDRESS_1329_SEI ||
        "0x25De27f15c1c1697dFF38b8A379B113E616ABe58",
    },
  },
  // Citrea Testnet (5115)
  5115: {
    CBTC: {
      vaultAddress:
        process.env.NEXT_PUBLIC_VAULT_ADDRESS_5115_CBTC ||
        "0x2876a1fb400c238b0a9e4edd2e7e03d3cf9b53c2",
      tellerAddress:
        process.env.NEXT_PUBLIC_TELLER_ADDRESS_5115_CBTC ||
        "0x146a9df081afa05d5d9657404752b548a7489f44",
      accountantAddress:
        process.env.NEXT_PUBLIC_ACCOUNTANT_ADDRESS_5115_CBTC ||
        "0x19e3f25442bdefdecf28673a71bfe008bc39fe1e",
    },
    ECBTC: {
      vaultAddress:
        process.env.NEXT_PUBLIC_VAULT_ADDRESS_5115_CBTC ||
        "0x2876a1fb400c238b0a9e4edd2e7e03d3cf9b53c2",
      tellerAddress:
        process.env.NEXT_PUBLIC_TELLER_ADDRESS_5115_CBTC ||
        "0x146a9df081afa05d5d9657404752b548a7489f44",
      accountantAddress:
        process.env.NEXT_PUBLIC_ACCOUNTANT_ADDRESS_5115_CBTC ||
        "0x19e3f25442bdefdecf28673a71bfe008bc39fe1e",
    },
    NUSD: {
      vaultAddress:
        process.env.NEXT_PUBLIC_VAULT_ADDRESS_5115_NUSD ||
        "0x2d41d86bb9e7161561fa3186b47d160467efcee3",
      tellerAddress:
        process.env.NEXT_PUBLIC_TELLER_ADDRESS_5115_NUSD ||
        "0x8b6097d4df90fe657d78bc187058bbd995afd0e0",
      accountantAddress:
        process.env.NEXT_PUBLIC_ACCOUNTANT_ADDRESS_5115_NUSD ||
        "0xb427da8b757a30ace33c53be5bdb8a6a056294ee",
    },
    ENUSD: {
      vaultAddress:
        process.env.NEXT_PUBLIC_VAULT_ADDRESS_5115_NUSD ||
        "0x2d41d86bb9e7161561fa3186b47d160467efcee3",
      tellerAddress:
        process.env.NEXT_PUBLIC_TELLER_ADDRESS_5115_NUSD ||
        "0x8b6097d4df90fe657d78bc187058bbd995afd0e0",
      accountantAddress:
        process.env.NEXT_PUBLIC_ACCOUNTANT_ADDRESS_5115_NUSD ||
        "0xb427da8b757a30ace33c53be5bdb8a6a056294ee",
    },
  },
};

/**
 * Get protocol addresses for a given chainId and optional token symbol.
 * If symbol omitted, returns the first symbol's addresses for backward compatibility.
 */
export function getAddresses(
  chainId: number,
  symbol?: string
): ProtocolAddresses | undefined {
  const chainMap = ADDRESSES[chainId];
  if (!chainMap) return undefined;
  if (symbol) return chainMap[symbol.toUpperCase()];
  // Backward compat: return first entry
  const first = Object.values(chainMap)[0];
  return first;
}

export const LINKS = {
  get: "https://citrea.xyz/faucet",
  docs: "https://docs.elitra.xyz",
  discord: "https://discord.gg/elitra",
  twitter: "https://x.com/elitraxyz",
  github: "https://github.com/elitraxyz",
};

// Multichain dummy price map: chainId -> symbol -> price
export const DUMMY_PRICES: Record<number, Record<string, number>> = {
  1329: {
    SEI: 0.8,
    WSEI: 0.8,
    USDC: 1,
    ATOM: 6.6,
    WCBTC: 100000.0,
    CBTC: 100000.0,
  },
  1: {
    ETH: 1800.0,
    USDC: 1,
    WBTC: 100000.0,
    // Add more as needed
  },
  5115: {
    CBTC: 100000.0,
    WETH: 1800.0,
    USDC: 1,
    NUSD: 1,
    veSUMA: 0.5,
    SUMA: 0.5,
    WCBTC: 100000.0,
    ECBTC: 110000.0,
    // Add more as needed
  },
};

export const NATIVE_TOKEN_ADDRESS: Record<number, string> = {
  5115: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  1329: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  1: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
};
