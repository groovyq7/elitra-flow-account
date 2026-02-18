import { useEffect } from "react"
import toast from "react-hot-toast"
import { ERC20_ABI } from "@/lib/contracts/vault-abi"
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi"
import { ErrorHandler } from "@/services/ErrorHandler"

// Use the largest uint256 value for max approval
const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")

export function useAllowance(selectedTokenAddressIn: string, spender: string) {
  const { address } = useAccount()
  const { data: allowanceAmount = BigInt(0), refetch } = useReadContract({
    address: selectedTokenAddressIn as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address as `0x${string}`, spender as `0x${string}`],
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

  const writeAllowance = (value = MAX_UINT256) =>
    writeContract({
      address: selectedTokenAddressIn as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spender as `0x${string}`, value],
    })

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
