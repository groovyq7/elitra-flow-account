import { useSpiceStore } from "@/store/useSpiceStore";
import { useEffect } from "react"
import toast from "react-hot-toast"
import { ERC20_ABI } from "@/lib/contracts/vault-abi"
import {
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi"
import { ErrorHandler } from "@/services/ErrorHandler"
import { isAddress } from "viem"

// Use the largest uint256 value for max approval (EIP-2612 infinite approval pattern)
const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")

export function useAllowance(selectedTokenAddressIn: string, spender: string) {
  const address = useSpiceStore((s) => s.connectedAddress)

  // Validate addresses before using them in contract reads/writes
  const isTokenValid = isAddress(selectedTokenAddressIn)
  const isSpenderValid = isAddress(spender)

  const { data: allowanceAmount = BigInt(0), refetch } = useReadContract({
    address: isTokenValid ? (selectedTokenAddressIn as `0x${string}`) : undefined,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address as `0x${string}`, spender as `0x${string}`],
    // Pause query when addresses are invalid
    query: { enabled: isTokenValid && isSpenderValid && !!address },
  })

  const {
    writeContract,
    data: hash,
    error,
    isPending,
    reset,
  } = useWriteContract()
  const {
    isLoading: isConfirming,
    isSuccess,
    error: txError,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash })

  /**
   * Approve `spender` to spend `value` tokens on behalf of the connected wallet.
   * Defaults to MAX_UINT256 (infinite approval) — standard DeFi UX.
   * Guards against invalid token or spender addresses before submitting.
   */
  const writeAllowance = (value = MAX_UINT256) => {
    if (!isTokenValid) {
      toast.error("Invalid token address — cannot approve")
      return
    }
    if (!isSpenderValid) {
      toast.error("Invalid spender address — cannot approve")
      return
    }
    writeContract({
      address: selectedTokenAddressIn as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spender as `0x${string}`, value],
    })
  }

  useEffect(() => {
    if (error) {
      toast.dismissAll();
      toast.error("Confirmation failed: " + ErrorHandler.handleError(error))
    }
    if (isPending && !txError && !error) {
      toast.dismissAll();
      toast.loading("Confirm your Approval: Waiting to confirm...")
    }
    if (txError) {
      toast.dismissAll();
      toast.error("Failed to Approve: " + txError.message)
    }
    if (isConfirming) {
      toast.dismissAll();
      toast.loading("Pending Network: Getting approval transaction...")
    }
    if (isSuccess) {
      toast.dismissAll();
      refetch()
      toast.success("Token Approved: You have approved the token.")
      setTimeout(() => {
        refetch()
        reset()
      }, 5000)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- toast is a module-level function, not reactive
  }, [error, isConfirming, isPending, isSuccess, receipt, refetch, reset, txError])

  return {
    allowanceAmount,
    refetch,
    writeAllowance,
    isLoading: isConfirming || isPending,
    txError,
    error,
    isSuccess,
    isConfirming,
    isPending,
    hash,
    reset
  }
}
