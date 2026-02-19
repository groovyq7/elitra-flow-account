"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import React from "react";
import dynamic from "next/dynamic";
import { SelectChainModal } from "@/components/cross-chain-deposit/SelectChainModal";
import { encodeFunctionData, parseUnits } from "viem";
import TELLER_ABI from "@/lib/abis/EliteraTeller.json";
import { getAddresses } from "@/lib/constants";
import { ChainBatch } from "@/lib/types";
import { DepositWidgetModal, useAssetInput } from "@spicenet-io/spiceflow-ui";
import { ERC20_ABI } from "@/lib/contracts/vault-abi";
import { getTokenPrice } from "@/lib/utils/get-token-balance";

// Dynamically import CrossChainDepositFlow to avoid SSR issues
const CrossChainDepositFlow = dynamic(
  () => import("@/components/cross-chain-deposit/CrossChainDepositFlow"),
  { ssr: false }
);

interface SpiceDepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenSymbol: string;
  yieldPercentage: number;
}

// All supported chains including Citrea and source chains
// Balance is stored with SOURCE chain ID, so we need all chains here
const SUPPORTED_CHAINS = [11155111, 84532, 421614, 5115];

// WCBTC token address on Citrea (destination token for vault deposit)
const WCBTC_ADDRESS = "0x8d0c9d1c17aE5e40ffF9bE350f57840E9E66Cd93" as `0x${string}`;

type ModalStep = "chain-select" | "cross-chain-deposit" | "vault-deposit";

export const SpiceDepositModal: React.FC<SpiceDepositModalProps> = ({
  open,
  onOpenChange,
  tokenSymbol: _tokenSymbol,
  yieldPercentage: _yieldPercentage,
}) => {
  const [step, setStep] = useState<ModalStep>("chain-select");
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);

  const depositInputHook = useAssetInput();

  // Get Teller address for CBTC vault on Citrea
  const { tellerAddress, vaultAddress } = useMemo(() => {
    const addresses = getAddresses(5115, "CBTC");
    return {
      tellerAddress: addresses?.tellerAddress as `0x${string}` | undefined,
      vaultAddress: addresses?.vaultAddress as `0x${string}` | undefined,
    };
  }, []);

  // Conversion rate for implicit swap (Source Token -> WCBTC)
  const [conversionRate, setConversionRate] = useState<number>(0);

  // Fetch conversion rate when asset changes
  useEffect(() => {
    let cancelled = false;
    const fetchRate = async () => {
      const asset = depositInputHook.selectedAsset;
      if (!asset) return;

      if (asset.symbol?.toUpperCase().includes("BTC")) {
        if (!cancelled) setConversionRate(1);
        return;
      }

      // It's likely USDC or similar stable
      const sourcePrice = await getTokenPrice(asset.symbol || "USDC");
      const destPrice = await getTokenPrice("WBTC");

      if (!cancelled && sourcePrice.price && destPrice.price && destPrice.price > 0) {
        const rate = sourcePrice.price / destPrice.price;
        setConversionRate(rate);
      }
    };
    fetchRate();
    return () => { cancelled = true; };
  }, [depositInputHook.selectedAsset]);

  // Token transfer amount for the Teller.deposit call (7702 vault deposit)
  // If user selects WBTC, use amount directly (18 decimals for WCBTC)
  // If user selects USDC, convert to WCBTC amount (Implicit Swap)
  const tokenTransferAmount = useMemo(() => {
    const amountStr = depositInputHook.assetAmount || "0";
    if (!amountStr || amountStr === "0") return null;

    // If WBTC/WCBTC, use 1:1 (assuming input is in correct units, treated as 18 decimals)
    if (depositInputHook.selectedAsset?.symbol?.toUpperCase().includes("BTC")) {
      const tokenAmount = parseUnits(amountStr, 18);
      return tokenAmount > 0n ? tokenAmount : null;
    }

    // Implicit Swap: USDC/Native -> WCBTC
    // We need to pass the *WCBTC Amount* to Teller.deposit
    if (conversionRate > 0) {
      const amountNum = parseFloat(amountStr);
      const wcbtcAmountNum = amountNum * conversionRate;
      // Convert result to 18 decimals (WCBTC decimals)
      const wcbtcAmountStr = wcbtcAmountNum.toFixed(18);
      const tokenAmount = parseUnits(wcbtcAmountStr, 18);
      return tokenAmount > 0n ? tokenAmount : null;
    }

    return null;
  }, [depositInputHook.assetAmount, depositInputHook.selectedAsset, conversionRate]);

  const depositBatches = useMemo((): ChainBatch[] => {
    if (!tellerAddress || !vaultAddress) return [];

    if (!tokenTransferAmount) return [];

    return [
      {
        chainId: 5115,
        calls: [
          {
            to: WCBTC_ADDRESS,
            value: 0n,
            data: encodeFunctionData({
              abi: ERC20_ABI,
              functionName: "approve",
              args: [vaultAddress, tokenTransferAmount],
            }),
          },
          {
            to: tellerAddress,
            value: 0n,
            data: encodeFunctionData({
              abi: TELLER_ABI,
              functionName: "deposit",
              args: [WCBTC_ADDRESS, tokenTransferAmount, 1n], // tokenAddress, amount, minSharesOut
            }),
          },
        ],
      },
    ];
  }, [
    tokenTransferAmount,
    tellerAddress,
    vaultAddress,
  ]);


  // Reset state when modal opens to ensure clean state on every open.
  // Previously a delayed reset on close, which races with rapid close→reopen.
  useEffect(() => {
    if (open) {
      setStep("chain-select");
      setSelectedChainId(null);
      setConversionRate(0); // clear stale rate so it re-fetches when asset is selected
    }
  }, [open]);

  const handleChainSelect = (chainId: number | undefined) => {
    if (!chainId) return;
    setSelectedChainId(chainId);
    // Citrea (5115) is the destination chain — user already has funds here,
    // so skip the cross-chain bridging step and go straight to vault deposit.
    if (chainId === 5115) {
      setStep("vault-deposit");
    } else {
      setStep("cross-chain-deposit");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  // Handle cross-chain escrow deposit completion - transition to vault deposit
  // Auto-populate from sessionStorage with original deposit details (e.g. USDC)
  const handleCrossChainComplete = useCallback(() => {

    // Auto-populate from sessionStorage with original deposit details
    try {
      const stored = sessionStorage.getItem("spiceflow:lastDepositSelection");
      if (stored) {
        const parsed = JSON.parse(stored) as {
          address?: string;
          symbol?: string;
          amount?: string;
          chainId?: number;
          decimals?: number;
        };


        // Normalize native token addresses to zero address (as used in spiceAssets)
        let normalizedAddress = parsed.address;
        if (normalizedAddress) {
          const addrLower = normalizedAddress.toLowerCase();
          if (
            addrLower === "0x0" ||
            addrLower === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
          ) {
            normalizedAddress = "0x0000000000000000000000000000000000000000";
          }
        }

        // Set the selected asset
        if (normalizedAddress && parsed.symbol) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK hook exposes methods not in type declarations
          (depositInputHook as any).setSelectedAsset?.({
            symbol: parsed.symbol,
            address: normalizedAddress,
            decimals: parsed.decimals || 18,
            chainId: parsed.chainId || selectedChainId || 84532,
          });
        }

        // Set the amount
        if (parsed.amount) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK hook exposes methods not in type declarations
          (depositInputHook as any).setAssetAmount?.(parsed.amount);
        }
      }
    } catch (err) {
      console.error("[SpiceDeposit] Failed to load from session:", err);
    }

    // Now show the DepositWidgetModal to deposit from cross-chain balance into vault
    setStep("vault-deposit");
  }, [depositInputHook, selectedChainId]);

  // Step 1: Chain selection using spiceflow's SelectChainModal
  if (step === "chain-select" && open) {
    return (
      <SelectChainModal
        isOpen={open}
        onClose={handleClose}
        onChainSelect={handleChainSelect}
        supportedChains={SUPPORTED_CHAINS}
        closeOnSelect={false}
      />
    );
  }

  // Step 2: Cross-chain deposit flow (same for Citrea and other chains; tx api handles execution)
  if (step === "cross-chain-deposit" && selectedChainId && open) {
    return (
      <CrossChainDepositFlow
        isOpen={open}
        onClose={handleClose}
        onComplete={handleCrossChainComplete}
        supportedChains={[selectedChainId]}
        initialChainId={selectedChainId}
      />
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK type mismatch
  const DepositWidgetModalAny = DepositWidgetModal as unknown as React.ComponentType<Record<string, unknown>>;

  // Step 3: Vault deposit via 7702 using DepositWidgetModal
  // This deposits from cross-chain balance into the Elitra vault
  if (step === "vault-deposit" && open && tellerAddress) {
    return (
      <DepositWidgetModalAny
        isOpen={open}
        onClose={handleClose}
        onComplete={handleClose}
        title="Earn Yield on CBTC"
        depositBatches={depositBatches}
        tokenAddress={WCBTC_ADDRESS}
        tokenDecimals={18}
        tokenTransferAmount={tokenTransferAmount ?? undefined}
        supportedChains={SUPPORTED_CHAINS}  // Include all chains so balance from any source shows
        supportedTokens={["WBTC", "WCBTC"]}  // Show all tokens since deferred conversion
        depositInputHook={depositInputHook}
        submitButtonText="Complete Deposit"
        onDepositSuccess={(intentId: string) => {

          // Dispatch event to trigger vault share balance refresh
          window.dispatchEvent(new CustomEvent('vault-deposit-complete', {
            detail: { tokenSymbol: 'eCBTC', intentId }
          }));
        }}
        onDepositError={(error: string) => {
          console.error("Vault deposit failed:", error);
        }}
      />
    );
  }

  return null;
};
