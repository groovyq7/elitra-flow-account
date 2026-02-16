import { ErrorHandler } from "@/services/ErrorHandler";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";

export function useWithdraw() {
  const {
    writeContract,
    data: hash,
    error,
    isPending,
    reset,
  } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess,
    isError,
    error: txError,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash });

  const writeWithdraw = (params: Parameters<typeof writeContract>[0]) =>
    writeContract(params);

  useEffect(() => {
    if (error) {
      toast.dismissAll();
      toast.error("Withdraw failed: " + ErrorHandler.handleError(error));
    }
    if (isPending) {
      toast.dismissAll();
      toast.loading("Withdraw: Waiting for wallet confirmation...");
    }
    if (txError) {
      toast.dismissAll();
      toast.error("Withdraw failed: " + ErrorHandler.handleError(txError));
    }
    if (isConfirming) {
      toast.dismissAll();
      toast.loading("Withdraw: Waiting for transaction confirmation...");
    }
    if (isSuccess) {
      toast.dismissAll();
      toast.success("Withdraw successful!");
      setTimeout(() => {
        reset();
      }, 5000);
    }
  }, [error, isConfirming, isPending, isSuccess, receipt, reset, txError]);

  return {
    writeWithdraw,
    isLoading: isConfirming || isPending,
    isSuccess,
    isError,
    isConfirming,
    isPending,
    error: error || txError,
    hash,
    receipt,
    reset,
  };
}
