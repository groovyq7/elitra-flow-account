"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSpiceStore } from "@/store/useSpiceStore";
import { useWallets } from "@privy-io/react-auth";
import { SelectChainModal } from "@/components/cross-chain-deposit/SelectChainModal";
import { WithdrawWidgetModal, useAssetInput } from "@spicenet-io/spiceflow-ui";
import { encodeFunctionData, parseUnits } from "viem";
import TELLER_ABI from "@/lib/abis/EliteraTeller.json";
import { getAddresses } from "@/lib/constants";
import { getChainConfig } from "@/lib/utils/chains";
import {
  SUPPORTED_CHAIN_IDS,
  NATIVE_CHAIN_ID,
  SOLVER_ADDRESS,
} from "@/lib/spiceflowConfig";
import type { ChainBatch } from "@/lib/types";

// Citrea vault share tokens available for withdrawal
const CITREA_VAULT_TOKENS = [
  {
    address: "0x2876a1fb400c238b0a9e4edd2e7e03d3cf9b53c2" as `0x${string}`,
    symbol: "eCBTC",
    name: "Citrea BTC Vault",
    decimals: 18,
    chainId: NATIVE_CHAIN_ID,
    logoURI: "https://citrea.elitra.xyz/images/tokens/cbtc.jpg",
  },
];

// Map vault share token → underlying token address on Citrea for Teller.bulkWithdrawNow
const UNDERLYING_TOKEN_MAP: Record<string, `0x${string}`> = {
  eCBTC: "0x8d0c9d1c17aE5e40ffF9bE350f57840E9E66Cd93", // WCBTC
};

// Map vault share token → its Teller symbol key for getAddresses()
const TELLER_SYMBOL_MAP: Record<string, string> = {
  eCBTC: "CBTC",
};

function getWBTCForChain(
  chainId: number
): { address: `0x${string}`; decimals: number } | null {
  const config = getChainConfig(chainId);
  const wbtc = config?.supportedTokens?.find(
    (t) => t.symbol === "WBTC" || t.symbol === "WCBTC"
  );
  if (!wbtc) return null;
  return { address: wbtc.address as `0x${string}`, decimals: wbtc.decimals };
}

type Step = "chain-select" | "withdraw";

export const WithdrawFlow: React.FC = () => {
  const {
    isWithdrawOpen,
    closeWithdraw,
    crossChainBalance,
    addWithdraw,
    deductBalance,
  } = useSpiceStore();

  const { wallets } = useWallets();
  const embeddedWallet = wallets.find((w) => w.connectorType === "embedded");
  const externalWallet = wallets.find((w) => w.connectorType !== "embedded");

  const embeddedWalletAddress = (embeddedWallet?.address ||
    "") as `0x${string}`;
  const externalWalletAddress = (externalWallet?.address ||
    embeddedWalletAddress) as `0x${string}`;

  // Default token for withdrawal
  const [selectedToken] = useState("eCBTC");

  const [step, setStep] = useState<Step>("chain-select");
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);
  const withdrawInput = useAssetInput();

  // Determine underlying token address from selected vault token
  const tokenAddress = UNDERLYING_TOKEN_MAP[selectedToken];

  // Reset state when modal opens to ensure clean state on every open.
  // Previously this was a delayed reset on close, which created a race condition:
  // close → 200ms timer → reopen before timer fires → timer resets fresh state.
  // Now we reset synchronously on open for a guaranteed clean state.
  useEffect(() => {
    if (isWithdrawOpen) {
      setStep("chain-select");
      setSelectedChainId(null);
    }
  }, [isWithdrawOpen]);

  // ESC key to close (cancel — no side effects)
  useEffect(() => {
    if (!isWithdrawOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeWithdraw();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isWithdrawOpen, closeWithdraw]);

  const isCrossChainExternal = selectedChainId != null;

  // Build withdrawal batches for Teller.bulkWithdrawNow on Citrea
  const withdrawBatches = useMemo((): ChainBatch[] => {
    if (!tokenAddress || !embeddedWalletAddress) return [];
    const tellerSymbol = TELLER_SYMBOL_MAP[selectedToken];
    const addresses = getAddresses(NATIVE_CHAIN_ID, tellerSymbol);
    if (!addresses?.tellerAddress) return [];

    const tokenAmount = parseUnits(withdrawInput.assetAmount || "0", 18);
    // For cross-chain external withdrawals, send to solver
    // Otherwise send to embedded wallet (Elitra Account balance)
    const recipient = isCrossChainExternal
      ? SOLVER_ADDRESS
      : embeddedWalletAddress;

    return [
      {
        chainId: NATIVE_CHAIN_ID,
        calls: [
          {
            to: addresses.tellerAddress as `0x${string}`,
            value: 0n,
            data: encodeFunctionData({
              abi: TELLER_ABI,
              functionName: "bulkWithdrawNow",
              args: [tokenAddress, tokenAmount, 0, recipient],
            }),
          },
        ],
      },
    ];
  }, [
    tokenAddress,
    selectedToken,
    withdrawInput.assetAmount,
    selectedChainId,
    embeddedWalletAddress,
    isCrossChainExternal,
  ]);

  // For cross-chain external withdrawals: token transfer batch on destination chain
  const externalWithdrawBatches = useMemo((): ChainBatch[] => {
    if (!isCrossChainExternal || selectedChainId == null) return [];
    const wbtc = getWBTCForChain(selectedChainId);
    if (!wbtc) return [];

    const amountStr = withdrawInput.assetAmount || "0";
    const amount = parseUnits(amountStr, wbtc.decimals);

    return [
      {
        chainId: selectedChainId,
        calls: [],
        tokenTransfers: [
          {
            from: "solver" as const,
            to: externalWalletAddress,
            token: wbtc.address,
            amount,
          },
        ],
      },
    ];
  }, [
    isCrossChainExternal,
    selectedChainId,
    withdrawInput.assetAmount,
    externalWalletAddress,
  ]);

  // Cancel handler — closes modal without recording anything
  const handleCancel = useCallback(() => {
    closeWithdraw();
  }, [closeWithdraw]);

  // Success handler — only called when withdrawal actually completes
  const handleComplete = useCallback(() => {
    // Dispatch event for vault page refresh
    window.dispatchEvent(
      new CustomEvent("crosschain-withdraw-complete", {
        detail: { tokenSymbol: selectedToken },
      })
    );

    // Record withdrawal in store and deduct from cross-chain balance
    const amount = withdrawInput.assetAmount;
    if (amount && parseFloat(amount) > 0) {
      addWithdraw({
        id: `wd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        amount,
        destinationChain: selectedChainId
          ? getChainConfig(selectedChainId)?.displayName || `Chain ${selectedChainId}`
          : "Elitra Account",
        destinationChainId: selectedChainId || NATIVE_CHAIN_ID,
        timestamp: Date.now(),
      });
      deductBalance(parseFloat(amount));
    }

    closeWithdraw();
  }, [closeWithdraw, withdrawInput.assetAmount, selectedChainId, selectedToken, addWithdraw, deductBalance]);

  const handleChainSelect = (chainId: number | undefined) => {
    if (!chainId) return;
    setSelectedChainId(chainId);
    setStep("withdraw");
  };

  // ---------- Render ----------

  if (!isWithdrawOpen) return null;

  if (!tokenAddress) return null;

  // Step 1: Chain selection
  if (step === "chain-select") {
    return (
      <SelectChainModal
        isOpen={true}
        onClose={() => closeWithdraw()}
        onChainSelect={handleChainSelect}
        supportedChains={[...SUPPORTED_CHAIN_IDS]}
        closeOnSelect={false}
      />
    );
  }

  // Step 2: Withdraw widget
  const title = `Withdraw ${selectedToken}`;
  const chainName =
    selectedChainId != null
      ? getChainConfig(selectedChainId)?.displayName ?? `Chain ${selectedChainId}`
      : "Citrea";
  const description = `Withdraw vault shares to your external wallet. You will receive WBTC on ${chainName}.`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK type mismatch
  const WithdrawWidgetModalAny = WithdrawWidgetModal as unknown as React.ComponentType<Record<string, unknown>>;

  return (
    <WithdrawWidgetModalAny
      isOpen={true}
      onClose={handleCancel}
      onComplete={handleComplete}
      title={title}
      description={description}
      withdrawBatches={withdrawBatches}
      externalWithdrawBatches={
        isCrossChainExternal ? externalWithdrawBatches : undefined
      }
      tokens={CITREA_VAULT_TOKENS}
      supportedTokens={["eCBTC"]}
      depositTokenAddress={tokenAddress}
      withdrawInputHook={withdrawInput}
      filterChains={[NATIVE_CHAIN_ID]}
      withdrawMode="external"
      hideWithdrawModeSelector={true}
      externalWalletAddress={externalWalletAddress}
      embeddedWalletAddress={embeddedWalletAddress}
    />
  );
};
