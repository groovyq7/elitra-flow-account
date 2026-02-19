"use client"

import { useAccount, useReadContract } from "wagmi"
import { formatUnits, erc20Abi } from "viem"
import { VAULT_ABI, ERC20_ABI } from "@/lib/contracts/vault-abi"

export function useBalance(tokenAddress: string) {
  const { address } = useAccount()

  // Read share token decimals assuming the vault share token conforms to ERC20 (common for ERC4626)
  const { data: decimals } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: !!tokenAddress },
  })

  const { data: balance, refetch } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: VAULT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!tokenAddress,
      refetchInterval: 30000,
    },
  })

  const decimalsNumber = typeof decimals === "number" ? decimals : decimals ? Number(decimals) : 18 // fallback to 18
  const rawBalance = (balance as bigint) || BigInt(0)
  const formattedBalance = formatUnits(rawBalance, decimalsNumber)

  return {
    balance: rawBalance,
    decimals: decimalsNumber,
    formattedBalance,
    refetch,
  }
}

export function useTotalSupply(tokenAddress: string) {
  // Read share token decimals — do NOT hardcode 18; vault share tokens can have
  // varying precision (e.g. USDC-denominated vaults use 6 decimals).
  const { data: decimals } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: !!tokenAddress },
  })

  // Read total supply of the vault share token
  const { data: totalSupply } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "totalSupply",
    query: { enabled: !!tokenAddress },
  })

  const decimalsNumber = typeof decimals === "number" ? decimals : decimals ? Number(decimals) : 18
  const formattedTotalSupply = formatUnits(totalSupply || BigInt(0), decimalsNumber)

  return {
    totalSupply: totalSupply || BigInt(0),
    decimals: decimalsNumber,
    formattedTotalSupply,
  }
}