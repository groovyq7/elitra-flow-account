import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { AmountInput } from "@/components/ui/AmountInput";
import { Button } from "@/components/ui/button";
import { getTokenImage } from "@/lib/utils";
import React, { useEffect, useMemo, useState } from "react";
import { useDeposit } from "@/hooks/useDeposit";
import { useChainId, useChains } from "wagmi";
import { useVaultData } from "@/hooks/use-vault-data";
import { TokenType } from "@/lib/types";
import { TransactionStatusModal } from "./TransactionStatusModal";
import TELLER_ABI from "@/lib/abis/EliteraTeller.json";
import { getAddresses, NATIVE_TOKEN_ADDRESS } from "@/lib/constants";
import { useAllowance } from "@/hooks/useAllowance";
import { config } from "@/lib/wagmi";
import toast from "react-hot-toast";
import { ErrorHandler } from "@/services/ErrorHandler";
import { zeroAddress } from "viem";
import { DialogTitle } from "@radix-ui/react-dialog";
import { abbreviateNumber, formatAPY, formatPrice } from "@/lib/utils/format";
import { getTokenPrice, getVaultRate } from "@/lib/utils/get-token-balance";
import Image from "next/image";
import { trackApprovalAttempt, trackApprovalResult, trackDepositAttempt, trackDepositFailed, trackDepositSuccess, trackModalOpen } from '@/lib/analytics'

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apy: number | string | null;
  amount: string;
  setAmount: (val: string) => void;
  selectedToken: TokenType;
  setSelectedToken: (val: TokenType) => void;
  isTokenSelectorOpen: boolean;
  setIsTokenSelectorOpen: (open: boolean) => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({
  open,
  onOpenChange,
  apy,
  amount,
  setAmount,
  selectedToken,
  setSelectedToken,
  isTokenSelectorOpen,
  setIsTokenSelectorOpen,
}) => {
  const chainId = useChainId();
  const chains = useChains();
  const currentChain = chains.find((c) => c.id === chainId);
  const { vaults } = useVaultData();
  const [isDisabled, setIsDisabled] = useState(false);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txStatus, setTxStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [vaultRate, setVaultRate] = useState<{ raw: bigint; formatted: string } | null>(null);
  const [tokenPrice, setTokenPrice] = useState<number | null>(null); // token price in USD

  const [isRateLoading, setIsRateLoading] = useState(false);

  // Prepare hooks outside the handler
  const vaultAddresses =
    getAddresses(chainId, selectedToken?.symbol) ?? {
      vaultAddress: '0x0000000000000000000000000000000000000000',
      tellerAddress: '0x0000000000000000000000000000000000000000',
      accountantAddress: '0x0000000000000000000000000000000000000000',
    };
  const depositTokenAddress = selectedToken.address;
  const decimals = selectedToken.decimals;
  const parsedAmount = amount && !isNaN(Number(amount)) ? BigInt(Math.floor(Number(amount) * 10 ** decimals)) : 0n;
  const selectedVault = vaults.find(
    (v) => v.token0.address === selectedToken.address
  );

  // Fetch the live vault rate from chain (via Accountant getRate)
  useEffect(() => {
    let cancelled = false;
    async function fetchRate() {
      if (!currentChain || !selectedVault) {
        setVaultRate(null);
        return;
      }
      try {
        setIsRateLoading(true);
        const res: any = await getVaultRate(selectedVault.symbol, currentChain);
        const priceData: any = await getTokenPrice(selectedVault.token0.symbol);
        // res.rate may be a formatted decimal string or bigint depending on util implementation
        const rateBigInt: bigint = res.rateRaw ?? 0n;
        setTokenPrice(priceData.price);
        if (!cancelled) setVaultRate({raw: rateBigInt, formatted: res.rate });
      } catch (e) {
        if (!cancelled) setVaultRate(null);
      } finally {
        if (!cancelled) setIsRateLoading(false);
      }
    }
    fetchRate();
    return () => {
      cancelled = true;
    };
  }, [currentChain?.id, selectedVault?.id]);

  // Calculate estimated shares and min amount using vault rate
  const {
    estimatedShares,
    minAmount,
    formattedEstimatedShares,
    formattedMinAmount,
    formattedUSDAmount,
  } = useMemo(() => {
    if (!amount || Number(amount) <= 0) {
      return {
        estimatedShares: BigInt(0),
        minAmount: BigInt(0),
        formattedEstimatedShares: "0",
        formattedMinAmount: "0",
      };
    }

    if (!selectedVault || !vaultRate || !vaultRate.raw) {
      return {
        estimatedShares: BigInt(0),
        minAmount: BigInt(0),
        formattedEstimatedShares: "0",
        formattedMinAmount: "0",
      };
    }

    // Calculate estimated shares.
    // vaultRate (rateRaw) represents ASSETS_PER_SHARE scaled by 1e18 (assets per 1 share).
    // We need SHARES for a given asset amount (amountInWei, 1e18 scaled), so:
    // shares = assets * 1e18 / assetsPerShareScaled
    // => estimatedShares = (amountInWei * 1e18) / vaultRate
    const amountInWei = parsedAmount;
    const RATE_SCALE = BigInt("1000000000000000000"); // 1e18
    const estimatedShares = (amountInWei * RATE_SCALE) / vaultRate.raw;

    // Minimum shares with 0.5% slippage protection
    const minAmount = estimatedShares; //- (estimatedShares * BigInt(5)) / BigInt(1000);
    const usdAmount = tokenPrice
      ? (Number(tokenPrice) * Number(amount)).toFixed(2)
      : "0.00";

    // Format for display - convert back to human readable format
    const formatShares = (shares: bigint) => {
      if (shares === BigInt(0)) return "0";

      // Convert to number with proper decimals
      const sharesNumber = Number(shares) / 10 ** 18;
      return sharesNumber.toFixed(8); // Show up to 18 decimal places
    };

    return {
      estimatedShares,
      minAmount,
      formattedEstimatedShares: formatShares(estimatedShares),
      formattedMinAmount: formatShares(minAmount),
      formattedUSDAmount: usdAmount,
    };
  }, [
    amount,
    vaults,
    selectedToken.address,
    parsedAmount,
    selectedToken.decimals,
    vaultRate,
  ]);

  // Allowance using custom hook
  const {
    allowanceAmount: allowance = BigInt(0),
    refetch: refetchAllowance,
    writeAllowance,
    isLoading: isAllowanceLoading,
    isConfirming: isAllowanceConfirming,
    isSuccess: isAllowanceSuccess,
    error: isAllowanceError,
    txError: isAllowanceTxError,
    reset: resetAllowance,
  } = useAllowance(depositTokenAddress, vaultAddresses.vaultAddress);

  // Deposit logic and status
  const {
    writeDeposit,
    isLoading: isDepositLoading,
    isSuccess: isDepositSuccess,
    isError: isDepositError,
    isConfirming: isDepositConfirming,
    isPending: isDepositPending,
    error: depositError,
    hash: depositHash,
    receipt: depositReceipt,
    reset: resetDeposit,
  } = useDeposit();

  // Real deposit logic
  const handleAction = async () => {
    try {
      // Find the selected vault
      const selectedVault = vaults.find(
        (v) => v.token0.address === selectedToken.address
      );
      if (!selectedVault) throw new Error("Vault not found");

      // 1. Check allowance
      if (selectedToken.address !== zeroAddress && allowance < parsedAmount) {
        //toast.loading(`Approving ${selectedToken.symbol} for vault...`);
        try {
          trackApprovalAttempt(selectedToken.symbol, selectedToken.address, parsedAmount, {
            chainId,
            spender: vaultAddresses.vaultAddress,
            context: 'deposit',
          })
          writeAllowance(parsedAmount);
        } catch {
          toast.dismissAll();
          toast.error("User rejected the approval transaction.");
          trackApprovalResult('error', { reason: 'rejected', context: 'deposit' })
          return;
        }
        await refetchAllowance();
      }

      let depositResult;
      try {
        trackDepositAttempt({
          tokenSymbol: selectedToken.symbol,
          tokenAddress: selectedToken.address,
          amountWei: String(parsedAmount),
          amount,
          amountUSD: formattedUSDAmount,
          chainId,
          tellerAddress: vaultAddresses.tellerAddress,
        })
        if (depositTokenAddress === zeroAddress) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- wagmi type doesn't infer `value` from JSON ABI payable mutability
          depositResult = writeDeposit({
            address: vaultAddresses.tellerAddress as `0x${string}`,
            abi: TELLER_ABI,
            functionName: "deposit",
            args: [NATIVE_TOKEN_ADDRESS[chainId], parsedAmount, 1],
            value: parsedAmount,
          } as any);
        } else {
          depositResult = writeDeposit({
            address: vaultAddresses.tellerAddress as `0x${string}`,
            abi: TELLER_ABI,
            functionName: "deposit",
            args: [depositTokenAddress, parsedAmount, 1],
          });
        }
        setTxStatus("loading");
        setTxModalOpen(true);
      } catch (err: unknown) {
        setTxStatus("error");
        setTxModalOpen(true);
        trackDepositFailed({ reason: err instanceof Error ? err.message : String(err), tokenSymbol: selectedToken.symbol, amount: String(parsedAmount) })
        return;
      }
    } catch (err: unknown) {
      setTxStatus("error");
      setTxModalOpen(true);
      trackDepositFailed({ reason: err instanceof Error ? err.message : String(err), tokenSymbol: selectedToken.symbol, amount: String(parsedAmount) })
    }
  };

  // Track deposit states for TransactionStatusModal (only for deposit, not allowance)
  useEffect(() => {
    // Only handle deposit-related states for the modal
    if (isDepositConfirming) {
      setTxStatus("loading");
      setTxModalOpen(true);
    } else if (isDepositSuccess) {
      setTxStatus("success");
      setTxModalOpen(true);
      trackDepositSuccess({ txHash: depositHash, tokenSymbol: selectedToken.symbol, amountWei: String(parsedAmount), amount, amountUSD: formattedUSDAmount })
    } else if (isDepositError || depositError) {
      setTxStatus("error");
      setTxModalOpen(true);
      trackDepositFailed({ reason: depositError?.message, tokenSymbol: selectedToken.symbol, amountWei: String(parsedAmount), amount, amountUSD: formattedUSDAmount })
    }

    if (depositHash) {
      setTxHash(depositHash);
    }
  }, [
    isDepositConfirming,
    isDepositSuccess,
    isDepositError,
    depositError,
    depositHash,
  ]);

  // Track approval result via allowance hook state
  useEffect(() => {
    if (isAllowanceSuccess) {
      trackApprovalResult('success', { context: 'deposit', token: selectedToken.symbol })
    }
    if (isAllowanceError || isAllowanceTxError) {
      trackApprovalResult('error', { context: 'deposit', message: isAllowanceTxError?.message })
    }
  }, [isAllowanceSuccess, isAllowanceError, isAllowanceTxError, selectedToken.symbol])

  const handleCopy = () => {
    if (txHash) {
      navigator.clipboard.writeText(txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  const handleTxModalClose = () => {
    setTxModalOpen(false);
    setTxStatus("idle");
    setTxHash(null);
    resetDeposit();
    resetAllowance();
    setCopied(false);
    setAmount("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (v) trackModalOpen('deposit')
      onOpenChange(v)
    }}>
      <DialogTitle></DialogTitle>
      <DialogContent
        className="sm:max-w-[600px] max-w-[95vw] p-0 max-h-[90vh] overflow-y-auto"
        showCloseButton={true}
      >
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-semibold">Deposit</h2>
          </div>

          {/* Amount Input */}
          <AmountInput
            amount={amount}
            setAmount={setAmount}
            selectedToken={selectedToken}
            setIsTokenSelectorOpen={setIsTokenSelectorOpen}
            isDisabled={isDisabled}
            setIsDisabled={setIsDisabled}
            reload={txModalOpen}
          />

          {/* Min Amount Display */}
          <div className="mb-4 flex flex-col gap-3 items-strech justify-center w-full">
            <div className="mb-1 p-3 bg-gray-50 rounded-lg flex justify-between gap-3">
              <div className="flex flex-col items-start">
                <div className="text-xl md:text-3xl font-semibold text-gray-600">
                  {formattedMinAmount}
                </div>
                <span className="text-left">
                  ${formatPrice(formattedUSDAmount)}
                </span>
              </div>
              <div className="font-semibold flex gap-2 items-center">
                <Image
                  src={
                    getTokenImage(selectedVault?.symbol ?? "") || "/placeholder.svg"
                  }
                  alt={selectedVault?.symbol || ""}
                  width={20}
                  height={20}
                  className="w-5 h-5 rounded-full"
                />
                {selectedVault?.symbol}
              </div>
            </div>
              <div className="mb-1 p-3 bg-gray-50 rounded-lg flex flex-col items-stretch">
                <div className="flex justify-between gap-3">
                  <div className="flex flex-col items-start">
                    <div className="text-lg font-semibold text-gray-500">
                      APY
                    </div>
                  </div>
                  <div className="text-xl font-semibold flex gap-2 items-center">
                    {formatAPY(Number(apy || 0))}
                  </div>
                </div>
              </div>
            
          </div>

          {/* Action Button: Approve if needed, else Deposit */}
          <Button
            className="w-full h-12 sm:h-14 text-base sm:text-lg"
            disabled={
              !amount ||
              Number(amount) <= 0 ||
              isAllowanceLoading ||
              isDepositLoading ||
              isDisabled
            }
            onClick={async () => {
              if (
                selectedToken.address !== zeroAddress &&
                allowance < parsedAmount
              ) {
                // Only approve, don't deposit - show loading spinner on button but no modal
                try {
                  writeAllowance(parsedAmount);
                } catch (err: any) {
                  toast.error("User rejected the approval transaction.");
                }
              } else {
                // For deposit, open tx status modal
                handleAction();
              }
            }}
          >
            {isDisabled ? (
              "Insufficient balance"
            ) : isAllowanceLoading || isAllowanceConfirming ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Approving...
              </div>
            ) : allowance < parsedAmount &&
              selectedToken.address !== zeroAddress ? (
              `Approve ${selectedToken?.symbol}`
            ) : (
              `Deposit ${selectedToken?.symbol}`
            )}
          </Button>
        </div>
      </DialogContent>
      <TransactionStatusModal
        open={txModalOpen}
        key={txStatus}
        status={txStatus}
        txHash={txHash}
        onClose={handleTxModalClose}
        copied={copied}
        onCopy={handleCopy}
        modalType={"deposit"}
        amount={formatPrice(amount)}
        tokenSymbol={selectedToken?.symbol}
  tokenImage={getTokenImage(selectedToken?.symbol) || "/placeholder.svg"}
  tokenOutputImage={getTokenImage(selectedToken?.symbol) || "/placeholder.svg"}
        tokenOutputSymbol={`e${selectedToken?.symbol}`}
        amountUSD={formatPrice(formattedUSDAmount)}
        outputAmount={formatPrice(formattedMinAmount)}
        outputAmountUSD={formatPrice(formattedUSDAmount)}
        title={
          txStatus === "loading"
            ? "Confirming Deposit..."
            : txStatus === "success"
            ? "Deposit Successful!"
            : txStatus === "error"
            ? "Deposit Failed"
            : undefined
        }
        description={
          txStatus === "loading"
            ? "Waiting for your wallet to confirm the deposit transaction."
            : txStatus === "success"
            ? "Your deposit was successful!"
            : txStatus === "error"
            ? ErrorHandler.handleError(depositError) ||
              "Deposit transaction failed."
            : undefined
        }
      />
    </Dialog>
  );
};
