import { ErrorHandler } from "@/services/ErrorHandler";
import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";

/**
 * Shared hook for contract write + wait for receipt + toast notifications.
 *
 * @param label - Human-readable label used in toast messages ("Deposit" / "Withdraw").
 *
 * Returns: { execute, isLoading, isSuccess, isError, isConfirming, isPending, error, hash, receipt, reset }
 */
export function useContractTransaction(label: string) {
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

  // Track a single toast ID so we only manage our own toast,
  // never calling toast.dismissAll() which would kill unrelated toasts.
  const toastId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (isPending) {
      // Show (or update) a loading toast while waiting for wallet signature.
      toastId.current = toast.loading(
        `${label}: Waiting for wallet confirmation...`,
        { id: toastId.current }
      );
    }

    if (isConfirming) {
      // Replace the wallet-pending toast with a block-confirmation toast.
      toastId.current = toast.loading(
        `${label}: Waiting for transaction confirmation...`,
        { id: toastId.current }
      );
    }

    if (isSuccess) {
      toast.success(`${label} successful!`, { id: toastId.current });
      const currentId = toastId.current;
      toastId.current = undefined;
      setTimeout(() => {
        // Dismiss the success toast if still visible, then reset wagmi state.
        if (currentId) toast.dismiss(currentId);
        reset();
      }, 5000);
    }

    if (error) {
      // Wallet rejected or pre-submit error (e.g. user denied signature).
      toast.error(`${label} failed: ${ErrorHandler.handleError(error)}`, {
        id: toastId.current,
      });
      toastId.current = undefined;
    }

    if (txError) {
      // On-chain revert or relay error.
      toast.error(`${label} failed: ${ErrorHandler.handleError(txError)}`, {
        id: toastId.current,
      });
      toastId.current = undefined;
    }
  }, [error, isConfirming, isPending, isSuccess, receipt, reset, txError, label]);

  return {
    execute: writeContract,
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
