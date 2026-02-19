import { useContractTransaction } from "./useContractTransaction";

export function useDeposit() {
  const { execute: writeDeposit, ...rest } = useContractTransaction("Deposit");

  return {
    writeDeposit,
    ...rest,
  };
}
