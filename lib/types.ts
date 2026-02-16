export interface Vault {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  apy: number | string;
  launchDate: string;
  token0: TokenType;
  token1?: {
    symbol: string;
    address: string;
    decimals: number;
    name: string;
  };
  strategyDescription?: string;
  shortDescription?: string;
  breakdown?: VaultBreakdown[]; // Added optional breakdown field
  chainId?: number; // Added chainId field to support multi-chain vaults
}

export interface UserPosition {
  vaultId: string;
  vault: Vault;
  shares: bigint;
  assets: bigint;
  pendingRewards: bigint;
}

export interface ChainConfig {
  id: number;
  name: string;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface VaultTransaction {
  hash: string;
  type: "deposit" | "withdraw";
  amount: bigint;
  timestamp: number;
  blockNumber: number;
}

export interface VaultBreakdown {
  id: string;
  protocol: string;
  percentage: number;
  apy: number;
  logo?: string;
  url?: string;
}

export interface ProtocolData {
  apy: number;
  liquidityScore: number;
  vaultId: string;
  yieldScore: number;
  protocol: string;
}

export interface VaultType {
  id: string;
  name: string;
  icon: any;
  apy: string;
  description: string;
  active: boolean;
}

export interface TokenType {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  [key: string]: any;
}

export interface UserPnlInfo {
  pnl: string | number;
  pnlUSD: string | number;
  deposited: string | number;
  depositedUSD: string | number;
  underlyingValue: string | number;
  underlyingValueUSD: string | number;
}

// Global type declarations for MongoDB
declare global {
  var _mongoClientPromise: Promise<import("mongodb").MongoClient> | undefined;
}

export interface Call {
  to: `0x${string}`;
  value: bigint;
  data: `0x${string}`;
}

export interface ChainBatch {
  chainId: number;
  calls: Call[];
}
