import type { Vault } from "@/lib/types";
import { zeroAddress } from "viem";
import { fetchQuery, cache as gqlCache } from "@/lib/utils/query";
import { computeApy24hLinear } from "../utils/apy";

// Local cache wrapper for enriched vault data (subgraph + static)
const enrichedVaultCache: Record<
  string,
  { vaults: Vault[]; timestamp: number }
> = {};
const ENRICH_TTL = 60_000; // 1 minute

// Subgraph query for vault metrics (single or multiple by id list)
const VAULT_METRICS_QUERY = `
    query VaultMetrics($ids: [String!]) {
      Vault(where: { id: { _in: $ids } }) {
        id
        apy
        rate
        tvl
        totalSupply
        totalAssetDepositedRaw
        totalAssetWithdrawnRaw
        depositsCount
        withdrawalsCount
        rateSnapshots(limit: 24, order_by: { timestamp: desc }) {
          rate
          timestamp
        }
      }
    }
`;

export const VAULTS: Record<number, Vault[]> = {
  // Sei Mainnet
  1329: [
    {
      id: "0xE41A97bCfc4c23Db5A5dE9f0e79df751F7562C04",
      name: "SEI Vault",
      symbol: "eSEI",
      decimals: 18,
      apy: 1.2,
      launchDate: "2024-01-01",
      chainId: 1329,
      token0: {
        symbol: "SEI",
        address: zeroAddress,
        decimals: 18,
        name: "SEI",
        wrapped: {
          symbol: "WSEI",
          address: "0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7",
          decimals: 18,
          name: "WSEI",
        },
      },
      breakdown: [
        {
          protocol: "Yei Finance",
          percentage: 60,
          apy: 10.2,
          logo: "/images/protocols/yei.webp",
          url: "https://app.yei.finance",
          id: "yei",
        },
        {
          protocol: "Takara Lend",
          percentage: 25,
          apy: 9.5,
          logo: "/images/protocols/takara.webp",
          url: "https://app.takaralend.com/",
          id: "takara",
        },
      ],
    },
    // {
    //   id: "0xE41A97bCfc4c23Db5A5dE9f0e79df751F7562C04",
    //   name: "WSEI Vault",
    //   symbol: "eSEI",
    //   decimals: 18,
    //   apy: 1.2,
    //   launchDate: "2024-01-01",
    //   token0: {
    //     symbol: "WSEI",
    //     address: "0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7",
    //     decimals: 18,
    //     name: "WSEI",
    //     wrapped: {
    //       symbol: "WSEI",
    //       address: "0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7",
    //       decimals: 18,
    //       name: "WSEI",
    //     },
    //   },
    //   breakdown: [
    //     { protocol: "YeiFinance", percentage: 60, apy: 10.2, logo: "/images/protocols/yei.webp", url: "https://app.yei.finance", id: "yei" },
    //     { protocol: "TakaraLend", percentage: 25, apy: 9.5, logo: "/images/protocols/takara.webp", url: "https://app.takaralend.com/", id: "takara" },
    //   ],
    // },
    // {
    //   id: "0x2a75D11c3D289873698cAfcA1196A12C0e82e1aa",
    //   name: "USDC Vault",
    //   symbol: "eUSDC",
    //   decimals: 18,
    //   protocol: "YeiFinance + TakaraLend",
    //   apy: 9.8,
    //   tvl: 5200000,
    //   launchDate: "2024-01-01",
    //   token0: {
    //     symbol: "USDC",
    //     address: "0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392",
    //     decimals: 6,
    //     name: "USDC",
    //   },
    //   sharePrice: 1,
    //   rate: BigInt("1000000"), //0.0000000000001
    //   totalAssets: BigInt("5200000000000"),
    //   totalSupply: BigInt("4737159562842"),
    //   breakdown: [
    //     { protocol: "YeiFinance", percentage: 60, apy: 10.2, logo: "/images/protocols/yei.webp", url: "https://app.yei.finance" },
    //     { protocol: "TakaraLend", percentage: 25, apy: 9.5, logo: "/images/protocols/takara.webp", url: "https://app.takaralend.com/" },
    //   ],
    // },
  ],

  // Citrea Testnet
  5115: [
    {
      id: "0x2876a1fb400c238b0a9e4edd2e7e03d3cf9b53c2",
      name: "CBTC Vault",
      symbol: "eCBTC",
      decimals: 18,
      apy: 6.3,
      launchDate: "2025-09-01",
      chainId: 5115,
      token0: {
        symbol: "CBTC",
        address: zeroAddress,
        decimals: 18,
        name: "Citrea Bitcoin",
        noBalanceText: "Get Testnet CBTC from Faucet",
        dexLink: "https://citrea.xyz/faucet",
        wrapped: {
          symbol: "WCBTC",
          address: "0x8d0c9d1c17aE5e40ffF9bE350f57840E9E66Cd93",
          decimals: 18,
          name: "Wrapped Citrea Bitcoin",
          noBalanceText: "Get Testnet CBTC from Faucet",
          dexLink: "https://citrea.xyz/faucet",
        },
      },
      strategyDescription:
        "This vault allocates cBTC into Satsuma Exchange’s cBTC pool to earn yield from fees with auto-compounding and risk diversification. In parallel, it converts a portion of cBTC into Nectra’s nUSD and deposits it into their savings accounts to generate additional stablecoin yield.",
      shortDescription:
        "This vault allocates cBTC into Satsuma Exchange’s cBTC pool to earn yield from fees with auto-compounding and risk diversification.",
      breakdown: [
        {
          id: "satsuma-wcbtc",
          protocol: "Satsuma WCBTC Pool",
          percentage: 95,
          apy: 0,
          logo: "/images/protocols/satsuma.jpg",
          url: "https://www.satsuma.exchange/liquidity/0x9aa034631e14e2c7fc01890f8d7b19ab6aed1666/new-position",
        },
        {
          id: "nectra-nusd",
          protocol: "Nectra NUSD",
          percentage: 5,
          apy: 2.21,
          logo: "/images/protocols/nectra.svg",
          url: "https://app.nectra.xyz/",
        },
      ],
    },
    {
      id: "0x2d41d86bb9e7161561fa3186b47d160467efcee3",
      name: "NUSD Vault",
      symbol: "eNUSD",
      decimals: 18,
      apy: 7.21,
      launchDate: "2025-09-01",
      chainId: 5115,
      token0: {
        symbol: "NUSD",
        address: "0x9B28B690550522608890C3C7e63c0b4A7eBab9AA",
        decimals: 18,
        name: "Nectra USD",
        noBalanceText: "Don’t have NUSD? Swap CBTC on Satsuma",
        dexLink: "https://www.satsuma.exchange/",
        wrapped: {
          symbol: "NUSD",
          address: "0x9B28B690550522608890C3C7e63c0b4A7eBab9AA",
          decimals: 18,
          name: "Nectra USD",
          noBalanceText: "Don’t have NUSD? Swap CBTC on Satsuma",
          dexLink: "https://www.satsuma.exchange/",
        },
      },
      strategyDescription:
        "This vault automatically places your nUSD into Nectra’s savings account, allowing you to earn stablecoin yield with no extra steps.",
      shortDescription:
        "This vault automatically places your nUSD into Nectra’s savings account, allowing you to earn stablecoin yield with no extra steps.",
      breakdown: [
        {
          id: "nectra-nusd",
          protocol: "Nectra NUSD",
          percentage: 100,
          apy: 7.21,
          logo: "/images/protocols/nectra.svg",
          url: "https://app.nectra.xyz/",
        },
      ],
    },
  ],
};

export const CHAIN_METADATA: Record<
  number,
  {
    name: string;
    shortName: string;
    color: string;
    icon: string;
    blockExplorer: string;
  }
> = {
  1329: {
    name: "Sei",
    shortName: "SEI",
    color: "#8B0000",
    icon: "⚡",
    blockExplorer: "https://seitrace.com",
  },
  713715: {
    name: "Sei Testnet",
    shortName: "SEI-TEST",
    color: "#CD5C5C",
    icon: "⚡",
    blockExplorer: "https://seitrace.com",
  },
};

export function getVaultsByChain(chainId: number): Vault[] {
  return VAULTS[chainId] || [];
}

// Async version that enriches with subgraph data (apy, rate, tvl) + caching
export async function getVaultsByChainWithSubgraph(
  chainId: number
): Promise<Vault[]> {
  const cacheKey = String(chainId);
  const now = Date.now();
  const cached = enrichedVaultCache[cacheKey];
  if (cached && now - cached.timestamp < ENRICH_TTL) {
    return cached.vaults;
  }

  const baseVaults = getVaultsByChain(chainId);
  if (baseVaults.length === 0) return [];

  try {
    const ids = baseVaults.map((v) => v.id.toLowerCase());
    const { data, error } = await fetchQuery(VAULT_METRICS_QUERY, { ids });
    if (error) throw error;
    const metricsById: Record<string, any> = {};
    (data?.Vault || []).forEach((m: any) => {
      metricsById[m.id.toLowerCase()] = m;
    });

    const enriched: Vault[] = await Promise.all(
      baseVaults.map(async (v) => {
        const m = metricsById[v.id.toLowerCase()];
        let apy24h = 0;
        if (m?.rateSnapshots && m.rateSnapshots.length > 1) {
          apy24h = Number(computeApy24hLinear(m.rateSnapshots).apy ?? 0);
        } else {
          const wrappedAddress = v.token0.wrapped?.address ?? v.token0.wrappedAddress;
          if (wrappedAddress) {
            const fetchApyData = await fetch(
              `/api/apy?vaultId=${wrappedAddress}`
            );
            if (fetchApyData.ok) {
              const apyJson = await fetchApyData.json();
              if (typeof apyJson.averageApy === "number") {
                apy24h = apyJson.averageApy;
              }
            }
          }
        }
        if (!m) return v;
        // Preserve original fields but override apy, rate, tvl, totalSupply if present
        return {
          ...v,
          chainId,
          apy: apy24h || v.apy,
          rate: m.rate ? BigInt(m.rate) : 1,
          tvl: typeof m.tvl === "number" ? m.tvl : 0,
          totalSupply: m.totalSupply ? BigInt(m.totalSupply) : 1,
          // Optionally attach extra metrics (non-typed) using index signature
          depositsCount: m.depositsCount,
          withdrawalsCount: m.withdrawalsCount,
          rateSnapshots: m.rateSnapshots,
          totalAssetDepositedRaw: m.totalAssetDepositedRaw,
          totalAssetWithdrawnRaw: m.totalAssetWithdrawnRaw,
        } as Vault;
      })
    );

    enrichedVaultCache[cacheKey] = { vaults: enriched, timestamp: Date.now() };
    return enriched;
  } catch (e) {
    // On failure return base vaults
    return baseVaults;
  }
}

export function getVaultById(
  vaultId: string,
  chainId: number
): Vault | undefined {
  const vaults = getVaultsByChain(chainId);
  const vault = vaults.find((vault) => vault.id.toLowerCase() === vaultId.toLowerCase());
  return vault || Object.values(VAULTS).flat().find((v) => v.id.toLowerCase() === vaultId.toLowerCase());
}

// Async enriched version for a single vault (subgraph + caching)
const singleVaultCache: Record<
  string,
  { vault: Vault | undefined; timestamp: number }
> = {};

export async function getVaultByIdWithSubgraph(
  vaultId: string,
  chainId: number
): Promise<Vault | undefined> {
  const base = getVaultById(vaultId, chainId);
  if (!base) return undefined;

  // If chain-level enriched cache fresh, return enriched version from there
  const chainCache = enrichedVaultCache[String(chainId)];
  const now = Date.now();
  if (chainCache && now - chainCache.timestamp < ENRICH_TTL) {
    return (
      chainCache.vaults.find(
        (v) => v.id.toLowerCase() === vaultId.toLowerCase()
      ) || base
    );
  }

  const cacheKey = `single:${chainId}:${vaultId.toLowerCase()}`;
  const cached = singleVaultCache[cacheKey];
  if (cached && now - cached.timestamp < ENRICH_TTL) {
    return cached.vault;
  }

  const QUERY = `
    query SingleVault($id: String!) {
      Vault(where: { id: { _eq: $id } }) {
        id
        apy
        rate
        tvl
        totalSupply
        totalAssetDepositedRaw
        totalAssetWithdrawnRaw
        depositsCount
        withdrawalsCount
        rateSnapshots(limit: 5, order_by: { timestamp: desc }) { rate timestamp }
      }
    }
  `;

  try {
    const { data, error } = await fetchQuery(QUERY, {
      id: vaultId.toLowerCase(),
    });
    if (error) throw error;
    const m = data?.Vault?.[0];
    let apy24h = 0;
    if (m?.rateSnapshots && m.rateSnapshots.length > 1) {
      apy24h = Number(computeApy24hLinear(m.rateSnapshots).apy ?? 0);
    } else {
      const wrappedAddress = base.token0.wrapped?.address ?? base.token0.wrappedAddress;
      if (wrappedAddress) {
        const fetchApyData = await fetch(
          `/api/apy?vaultId=${wrappedAddress}`
        );
        if (fetchApyData.ok) {
          const apyJson = await fetchApyData.json();
          if (typeof apyJson.averageApy === "number") {
            apy24h = apyJson.averageApy;
          }
        }
      }
    }

    if (!m) {
      singleVaultCache[cacheKey] = { vault: base, timestamp: now };
      return base;
    }
    const enriched: Vault = {
      ...base,
      chainId,
      apy: apy24h || base.apy,
      rate: m.rate ? BigInt(m.rate) : 1,
      tvl: m.tvl ? m.tvl : 1,
      totalSupply: m.totalSupply ? BigInt(m.totalSupply) : 1,
      depositsCount: m.depositsCount,
      withdrawalsCount: m.withdrawalsCount,
      rateSnapshots: m.rateSnapshots,
      totalAssetDepositedRaw: m.totalAssetDepositedRaw,
      totalAssetWithdrawnRaw: m.totalAssetWithdrawnRaw,
    } as Vault;
    singleVaultCache[cacheKey] = { vault: enriched, timestamp: Date.now() };
    return enriched;
  } catch (e) {
    // fallback to base definition
    singleVaultCache[cacheKey] = { vault: base, timestamp: Date.now() };
    return base;
  }
}

export function getAllVaults(): { chainId: number; vaults: Vault[] }[] {
  return Object.entries(VAULTS).map(([chainId, vaults]) => ({
    chainId: Number.parseInt(chainId),
    vaults,
  }));
}

export function getChainMetadata(chainId: number) {
  return CHAIN_METADATA[chainId];
}

export function getSupportedChainIds(): number[] {
  return Object.keys(VAULTS).map(Number);
}
