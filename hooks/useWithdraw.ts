import { useContractTransaction } from "./useContractTransaction";

export function useWithdraw() {
  const { execute: writeWithdraw, ...rest } = useContractTransaction("Withdraw");

  return {
    writeWithdraw,
    ...rest,
  };
}
