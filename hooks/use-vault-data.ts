"use client"

import { useQuery } from "@tanstack/react-query"
import { useChainId, useAccount } from "wagmi"
import { getVaultsByChain, getVaultById } from "@/lib/contracts/vault-registry"
import type { UserPosition } from "@/lib/types"

export function useVaultList() {
  const chainId = useChainId()

  return useQuery({
    queryKey: ["vaults", chainId],
    queryFn: () => getVaultsByChain(chainId),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  })
}

export function useVaultDetails(vaultId: string) {
  const chainId = useChainId()

  return useQuery({
    queryKey: ["vault", vaultId, chainId],
    queryFn: () => getVaultById(vaultId, chainId),
    enabled: !!vaultId,
    staleTime: 30000,
    refetchInterval: 60000,
  })
}

export function useUserPositions() {
  const { address } = useAccount()
  const chainId = useChainId()

  return useQuery({
    queryKey: ["userPositions", address, chainId],
    queryFn: async (): Promise<UserPosition[]> => {
      if (!address) return []
      // Real on-chain position fetching is handled per-vault by
      // getUserVaultPositionFromSubgraph in the individual table components.
      // This hook returns empty until a proper aggregation layer is implemented.
      return []
    },
    enabled: !!address,
    staleTime: 30000,
    refetchInterval: 60000,
  })
}

export function useUserRewards(vaultId?: string) {
  const { address } = useAccount()
  const chainId = useChainId()

  return useQuery({
    queryKey: ["userRewards", address, vaultId, chainId],
    queryFn: async () => {
      if (!address) return BigInt(0)
      // Real pending rewards fetching is handled per-vault.
      // Returning zero here until a proper aggregation layer is implemented.
      return BigInt(0)
    },
    enabled: !!address,
    staleTime: 30000,
    refetchInterval: 30000,
  })
}

export function useVaultData() {
  const vaultList = useVaultList()
  const userPositions = useUserPositions()
  const userRewards = useUserRewards()

  return {
    vaults: vaultList.data || [],
    isLoading: vaultList.isLoading,
    userPositions: userPositions.data || [],
    userRewards: userRewards.data || BigInt(0),
    refetch: () => {
      vaultList.refetch()
      userPositions.refetch()
      userRewards.refetch()
    },
  }
}
