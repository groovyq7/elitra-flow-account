"use client";

import { useMemo } from "react";
import { useChainId } from "wagmi";
import { getVaultsByChain } from "@/lib/contracts/vault-registry";
import type { Vault } from "@/lib/types";
import { useQuery } from "./useQuery";

// GraphQL queries mirroring those used in vault-registry enrichment
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
      rateSnapshots(limit: 5, order_by: { timestamp: desc }) { rate timestamp }
    }
  }
`;

const SINGLE_VAULT_QUERY = `
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
      rateSnapshots(limit: 20, order_by: { timestamp: desc }) { rate timestamp }
    }
  }
`;

interface UseVaultListSubgraphResult {
  vaults: Vault[];
  isLoading: boolean;
  error: any;
  refetch: (vars?: Record<string, any>) => Promise<any> | void;
}

interface UseVaultDetailsSubgraphResult {
  vault: Vault | undefined;
  isLoading: boolean;
  error: any;
  refetch: (vars?: Record<string, any>) => Promise<any> | void;
}

/**
 * useVaultListSubgraph
 * Fetches subgraph metrics for all statically registered vaults on current chain
 * using the generic useQuery hook (with its internal caching) and merges results.
 */
export function useVaultListSubgraph(): UseVaultListSubgraphResult {
  const chainId = useChainId();
  const baseVaults = getVaultsByChain(chainId);
  const ids = useMemo(() => baseVaults.map(v => v.id.toLowerCase()), [baseVaults]);

  const pause = ids.length === 0;
  const [result, refetch] = useQuery<{ Vault: any[] }>({
    query: VAULT_METRICS_QUERY,
    variables: { ids },
    pause,
  });

  const metricsMap = useMemo(() => {
    const map: Record<string, any> = {};
    (result.data?.Vault || []).forEach(m => {
      map[m.id.toLowerCase()] = m;
    });
    return map;
  }, [result.data]);

  const enriched = useMemo(() => {
    return baseVaults.map(v => {
      const m = metricsMap[v.id.toLowerCase()];
      if (!m) return v;
      let parsedRate: bigint | undefined = undefined;
      try { if (m.rate !== undefined && m.rate !== null) parsedRate = BigInt(m.rate); } catch {}
      let parsedSupply: bigint | undefined = undefined;
      try { if (m.totalSupply !== undefined && m.totalSupply !== null) parsedSupply = BigInt(m.totalSupply); } catch {}
      return {
        ...v,
        apy: typeof m.apy === "number" ? m.apy : v.apy,
        rate: parsedRate || 1,
        tvl: typeof m.tvl === "number" ? m.tvl : 0,
        totalSupply: parsedSupply || 1,
        depositsCount: m.depositsCount,
        withdrawalsCount: m.withdrawalsCount,
        rateSnapshots: m.rateSnapshots,
        totalAssetDepositedRaw: m.totalAssetDepositedRaw,
        totalAssetWithdrawnRaw: m.totalAssetWithdrawnRaw,
      } as Vault;
    });
  }, [baseVaults, metricsMap]);

  return {
    vaults: enriched,
    isLoading: result.fetching,
    error: result.error,
    refetch,
  };
}

/**
 * useVaultDetailsSubgraph
 * Fetches subgraph metrics for a single vault id and merges with static definition.
 */
export function useVaultDetailsSubgraph(vaultId?: string): UseVaultDetailsSubgraphResult {
  const chainId = useChainId();
  const base = vaultId ? getVaultsByChain(chainId).find(v => v.id.toLowerCase() === vaultId.toLowerCase()) : undefined;
  const lowerId = vaultId?.toLowerCase();
  const pause = !lowerId || !base;

  const [result, refetch] = useQuery<{ Vault: any[] }>({
    query: SINGLE_VAULT_QUERY,
    variables: { id: lowerId },
    pause,
  });

  const enriched: Vault | undefined = useMemo(() => {
    if (!base) return undefined;
    const m = result.data?.Vault?.[0];
    if (!m) return base;
    let parsedRate: bigint | undefined = undefined;
    try { if (m.rate !== undefined && m.rate !== null) parsedRate = BigInt(m.rate); } catch {}
    let parsedSupply: bigint | undefined = undefined;
    try { if (m.totalSupply !== undefined && m.totalSupply !== null) parsedSupply = BigInt(m.totalSupply); } catch {}
    return {
      ...base,
      apy: typeof m.apy === "number" ? m.apy : base.apy,
      rate: parsedRate || 1,
      tvl: typeof m.tvl === "number" ? m.tvl : 0,
      totalSupply: parsedSupply || 1,
      depositsCount: m.depositsCount,
      withdrawalsCount: m.withdrawalsCount,
      rateSnapshots: m.rateSnapshots,
      totalAssetDepositedRaw: m.totalAssetDepositedRaw,
      totalAssetWithdrawnRaw: m.totalAssetWithdrawnRaw,
    } as Vault;
  }, [base, result.data]);

  return {
    vault: enriched,
    isLoading: result.fetching,
    error: result.error,
    refetch,
  };
}
