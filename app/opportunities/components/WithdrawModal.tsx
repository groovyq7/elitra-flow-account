import { parseUnits } from "viem";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AmountInput } from "@/components/ui/AmountInput";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { getTokenImage } from "@/lib/utils";
import React, { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useChains } from "wagmi";
import { useVaultData } from "@/hooks/use-vault-data";
import { TokenType } from "@/lib/types";
import { TransactionStatusModal } from "./TransactionStatusModal";
import TELLER_ABI from "@/lib/abis/EliteraTeller.json";
import { getAddresses } from "@/lib/constants";
import { ErrorHandler } from "@/services/ErrorHandler";
import { useWithdraw } from "@/hooks/useWithdraw";
import { formatPrice } from "@/lib/utils/format";
import { getTokenPrice, getVaultRate } from "@/lib/utils/get-token-balance";
import Image from "next/image";
import {
  trackModalOpen,
  trackWithdrawAttempt,
  trackWithdrawFailed,
  trackWithdrawSuccess,
} from "@/lib/analytics";

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: string;
  setAmount: (val: string) => void;
  selectedToken: TokenType;
  setSelectedToken: (val: TokenType) => void;
  isTokenSelectorOpen: boolean;
  setIsTokenSelectorOpen: (open: boolean) => void;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  open,
  onOpenChange,
  amount,
  setAmount,
  selectedToken,
  setSelectedToken: _setSelectedToken,
  isTokenSelectorOpen: _isTokenSelectorOpen,
  setIsTokenSelectorOpen,
}) => {
  const chainId = useChainId();
  const chains = useChains();
  const currentChain = chains.find((c) => c.id === chainId);
  const { address } = useAccount();
  const { vaults } = useVaultData();
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txStatus, setTxStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [vaultRate, setVaultRate] = useState<bigint | null>(null); // assets per share scaled 1e18
  const [tokenPrice, setTokenPrice] = useState<number | null>(null); // token price in USD
  const [_isRateLoading, setIsRateLoading] = useState(false);

  // Prepare hooks outside the handler
  const vaultAddresses = getAddresses(chainId, selectedToken?.symbol) ?? {
    vaultAddress: "0x0000000000000000000000000000000000000000",
    tellerAddress: "0x0000000000000000000000000000000000000000",
    accountantAddress: "0x0000000000000000000000000000000000000000",
  };
  const withdrawToken = vaults.find(
    (vault) => vault.id === selectedToken.address
  );
  const decimals = selectedToken.decimals;
  // parseUnits handles precision correctly via BigInt arithmetic (avoids Number float loss).
  // Uses the token's actual decimals (not hardcoded 18) so vault share tokens
  // with non-standard precision are handled correctly.
  const parsedAmount = amount && !isNaN(Number(amount)) && Number(amount) > 0
    ? parseUnits(amount, decimals)
    : 0n;
  const [isDisabled, setIsDisabled] = useState(false);
  const selectedVault = vaults.find((v) => v.id === selectedToken.address);

  // Fetch live vault rate (assets per 1 share, scaled by 1e18)
  useEffect(() => {
    let cancelled = false;
    async function fetchRate() {
      if (!currentChain || !selectedVault) {
        setVaultRate(null);
        return;
      }
      try {
        setIsRateLoading(true);
        const rateData = await getVaultRate(
          selectedVault.symbol,
          currentChain
        );
        const priceData = await getTokenPrice(selectedVault.token0.symbol);
        if (!cancelled) {
          setVaultRate(rateData.rateRaw as bigint);
          setTokenPrice(priceData.price);
        }
      } catch {
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

  // Formatting helper for underlying asset amount
  const formatAssetAmount = (amt: bigint) => {
    if (amt === BigInt(0)) return "0";
    const underlyingDecimals = withdrawToken?.token0.decimals || 18;
    const num = Number(amt) / 10 ** underlyingDecimals;
    return num.toFixed(underlyingDecimals > 8 ? 8 : underlyingDecimals);
  };

  const { estimatedAssets: _estimatedAssets, minAmount: _minAmount, formattedUSDAmount, formattedMinAmount } =
    useMemo(() => {
      if (!amount || Number(amount) <= 0) {
        return {
          estimatedAssets: BigInt(0),
          minAmount: BigInt(0),
          formattedMinAmount: "0",
          formattedUSDAmount: "0",
        } as const;
      }

      if (!selectedVault || !vaultRate || vaultRate === BigInt(0)) {
        return {
          estimatedAssets: BigInt(0),
          minAmount: BigInt(0),
          formattedMinAmount: "0",
          formattedUSDAmount: "0",
        } as const;
      }
      // User inputs number of shares to withdraw (scaled 1e18). We need assets:
      // assets = shares * assetsPerShare / 1e18
      const sharesInWei = parsedAmount; // parsed with 18 decimals
      const SCALE = BigInt("1000000000000000000");
      const assetsInWei = (sharesInWei * vaultRate) / SCALE;
      const minAmount = assetsInWei; // optionally subtract slippage buffer
      const underlyingDecimals = withdrawToken?.token0.decimals || 18;
      const assetsNumber = Number(minAmount) / 10 ** underlyingDecimals;
      const usdAmount = assetsNumber * (tokenPrice ?? 0);

      return {
        estimatedAssets: assetsInWei,
        minAmount,
        formattedMinAmount: formatAssetAmount(minAmount),
        formattedUSDAmount: usdAmount,
      } as const;
    }, [
      amount,
      vaults,
      selectedToken.address,
      parsedAmount,
      selectedToken.decimals,
      vaultRate,
      withdrawToken?.token0.decimals,
      tokenPrice,
    ]);

  // Withdraw logic and status
  const {
    writeWithdraw,
    isLoading: isWithdrawLoading,
    isSuccess: isWithdrawSuccess,
    isError: isWithdrawError,
    isConfirming: isWithdrawConfirming,
    error: withdrawError,
    hash: withdrawHash,
    reset: resetWithdraw,
  } = useWithdraw();

  // Real withdraw logic
  const handleAction = async () => {
    try {
      if (!address) throw new Error("Wallet not connected");
      if (!withdrawToken) throw new Error("Vault not found for selected token");

      try {
        trackWithdrawAttempt({
          tokenSymbol: selectedToken.symbol,
          tokenAddress: selectedToken.address,
          amountWei: String(parsedAmount),
          amount,
          amountUSD: formattedUSDAmount,
          chainId,
          tellerAddress: vaultAddresses.tellerAddress,
        });
        const underlyingTokenAddress =
          withdrawToken?.token0?.wrapped?.address ??
          withdrawToken?.token0?.wrappedAddress ??
          withdrawToken?.token0?.address;
        writeWithdraw({
          address: vaultAddresses.tellerAddress as `0x${string}`,
          abi: TELLER_ABI,
          functionName: "bulkWithdrawNow",
          args: [
            underlyingTokenAddress,
            parsedAmount,
            0n,
            address,
          ],
        });
        //if (withdrawHash) setTxHash(withdrawHash);
        setTxStatus("loading");
        setTxModalOpen(true);
      } catch (err: unknown) {
        setTxStatus("error");
        setTxModalOpen(true);
        trackWithdrawFailed({
          reason: err instanceof Error ? err.message : String(err),
          tokenSymbol: selectedToken.symbol,
          amountWei: String(parsedAmount),
          amount,
          amountUSD: formattedUSDAmount,
        });
        return;
      }
    } catch (err: unknown) {
      setTxStatus("error");
      setTxModalOpen(true);
      trackWithdrawFailed({
        reason: err instanceof Error ? err.message : String(err),
        tokenSymbol: selectedToken.symbol,
        amountWei: String(parsedAmount),
        amount,
        amountUSD: formattedUSDAmount,
      });
    }
  };

  // Track withdraw states for TransactionStatusModal (only for withdraw, not allowance)
  useEffect(() => {
    // Only handle withdraw-related states for the modal
    if (isWithdrawConfirming) {
      setTxStatus("loading");
      setTxModalOpen(true);
    } else if (isWithdrawSuccess) {
      setTxStatus("success");
      setTxModalOpen(true);
      trackWithdrawSuccess({
        txHash: withdrawHash,
        tokenSymbol: selectedToken.symbol,
        amountWei: String(parsedAmount),
        amount,
        amountUSD: formattedUSDAmount,
      });
    } else if (isWithdrawError || withdrawError) {
      setTxStatus("error");
      setTxModalOpen(true);
      trackWithdrawFailed({
        reason: withdrawError?.message,
        tokenSymbol: selectedToken.symbol,
        amountWei: String(parsedAmount),
        amount,
        amountUSD: formattedUSDAmount,
      });
    }

    if (withdrawHash) {
      setTxHash(withdrawHash);
    }
  }, [
    isWithdrawConfirming,
    isWithdrawSuccess,
    isWithdrawError,
    withdrawError,
    withdrawHash,
  ]);

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
    resetWithdraw();
    setCopied(false);
    setAmount("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) trackModalOpen("withdraw");
        onOpenChange(v);
      }}
    >
      <DialogContent
        className="sm:max-w-[600px] max-w-[95vw] p-0 max-h-[90vh] overflow-y-auto"
        showCloseButton={true}
      >
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-semibold">Withdraw</h2>
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

          <ArrowDown className="mx-auto mb-4 text-gray-400" />

          {/* Min Amount Display */}

          <div className="mb-4 flex flex-col gap-1 items-strech justify-center w-full">
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
                    getTokenImage(withdrawToken?.token0.symbol!) ||
                    "/placeholder.svg"
                  }
                  alt={withdrawToken?.token0?.wrapped?.symbol ?? withdrawToken?.token0?.symbol ?? ""}
                  width={20}
                  height={20}
                  className="w-5 h-5 rounded-full"
                />
                {withdrawToken?.token0?.wrapped?.symbol ?? withdrawToken?.token0?.symbol}
              </div>
            </div>
          </div>

          {/* Action Button: Approve if needed, else Withdraw */}
          <Button
            className="w-full h-12 sm:h-14 text-base sm:text-lg"
            disabled={
              !amount || Number(amount) <= 0 || isWithdrawLoading || isDisabled || !withdrawToken
            }
            onClick={async () => {
              handleAction();
            }}
          >
            {isDisabled
              ? `Insufficient balance`
              : `Withdraw ${selectedToken?.symbol}`}
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
        modalType={"withdraw"}
        amount={formatPrice(amount, 6)}
        amountUSD={formatPrice(formattedUSDAmount)}
        tokenSymbol={selectedToken?.symbol}
        tokenImage={getTokenImage(selectedToken?.symbol) || "/placeholder.svg"}
        tokenOutputImage={
          getTokenImage(withdrawToken?.token0.symbol || "") ||
          "/placeholder.svg"
        }
        outputAmount={formatPrice(formattedMinAmount, 8)}
        outputAmountUSD={formatPrice(formattedUSDAmount)}
        tokenOutputSymbol={withdrawToken?.token0?.wrapped?.symbol ?? withdrawToken?.token0?.symbol}
        title={
          txStatus === "loading"
            ? "Confirming Withdraw..."
            : txStatus === "success"
            ? "Withdraw Successful!"
            : txStatus === "error"
            ? "Withdraw Failed"
            : undefined
        }
        description={
          txStatus === "loading"
            ? "Waiting for your wallet to confirm the withdraw transaction."
            : txStatus === "success"
            ? "Your withdraw was successful!"
            : txStatus === "error"
            ? ErrorHandler.handleError(withdrawError) ||
              "Withdraw transaction failed."
            : undefined
        }
      />
    </Dialog>
  );
};
