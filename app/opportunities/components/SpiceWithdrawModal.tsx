import { WithdrawWidgetModal, useAssetInput } from "@spicenet-io/spiceflow-ui";
import { SelectChainModal } from "@/components/cross-chain-deposit/SelectChainModal";
import { getChainConfig } from "@/lib/utils/chains";
import { useEffect, useState, useMemo } from "react";
import React from "react";
import { encodeFunctionData, parseUnits } from "viem";
import TELLER_ABI from "@/lib/abis/EliteraTeller.json";
import { getAddresses } from "@/lib/constants";
import { ChainBatch } from "@/lib/types";

const SOLVER_ADDRESS = "0x111115763723B53395308eC4c9AB9d5FB0844cae" as `0x${string}`;

const CITREA_TOKENS_CONFIG = [
  {
    address: "0x2876a1fb400c238b0a9e4edd2e7e03d3cf9b53c2" as `0x${string}`,
    symbol: "eCBTC",
    name: "Citrea BTC",
    decimals: 18,
    chainId: 5115,
    logoURI: "https://citrea.elitra.xyz/images/tokens/cbtc.jpg",
  },
];

const SUPPORTED_CHAINS = [11155111, 84532, 5115];

function getWBTCForChain(chainId: number): { address: `0x${string}`; decimals: number } | null {
  const config = getChainConfig(chainId);
  const wbtc = config?.supportedTokens?.find(
    (t) => t.symbol === "WBTC" || t.symbol === "WCBTC"
  );
  if (!wbtc) return null;
  return { address: wbtc.address as `0x${string}`, decimals: wbtc.decimals };
}

interface SpiceWithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenSymbol: string;
  externalWalletAddress: `0x${string}`;
  embeddedWalletAddress: `0x${string}`;
  destination: "collateral" | "external";
}

type Step = "chain-select" | "withdraw";

export const SpiceWithdrawModal: React.FC<SpiceWithdrawModalProps> = ({
  open,
  onOpenChange,
  tokenSymbol,
  externalWalletAddress,
  embeddedWalletAddress,
  destination,
}) => {
  const [step, setStep] = useState<Step>(destination === "external" ? "chain-select" : "withdraw");
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);
  const [tokenAddress, setTokenAddress] = useState<`0x${string}`>();
  const withdrawInput = useAssetInput();

  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setStep(destination === "external" ? "chain-select" : "withdraw");
        setSelectedChainId(null);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open, destination]);

  useEffect(() => {
    if (!open) return;
    if (tokenSymbol === "eCBTC") {
      setTokenAddress("0x8d0c9d1c17aE5e40ffF9bE350f57840E9E66Cd93");
    } else if (tokenSymbol === "eNUSD") {
      setTokenAddress("0x9B28B690550522608890C3C7e63c0b4A7eBab9AA");
    }
  }, [open, tokenSymbol]);

  const isCrossChainExternal =
    destination === "external" && selectedChainId != null;

  const withdrawBatches = useMemo((): ChainBatch[] => {
    if (!tokenAddress || !embeddedWalletAddress || !externalWalletAddress) return [];
    const addresses = getAddresses(5115, tokenSymbol);
    if (!addresses?.tellerAddress) return [];

    const tokenAmount = parseUnits(withdrawInput.assetAmount || "0", 18);
    const recipient = isCrossChainExternal
      ? SOLVER_ADDRESS
      : destination === "collateral"
        ? embeddedWalletAddress
        : externalWalletAddress;

    return [
      {
        chainId: 5115,
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
    tokenSymbol,
    withdrawInput.assetAmount,
    destination,
    selectedChainId,
    embeddedWalletAddress,
    externalWalletAddress,
    isCrossChainExternal,
  ]);

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

  // Cancel — closes modal without side effects
  const handleCancel = () => {
    onOpenChange(false);
  };

  // Complete — fires event only on successful withdrawal
  const handleComplete = () => {
    window.dispatchEvent(new CustomEvent("crosschain-withdraw-complete", { detail: { tokenSymbol } }));
    onOpenChange(false);
  };

  const handleChainSelect = (chainId: number | undefined) => {
    if (!chainId) return;
    setSelectedChainId(chainId);
    setStep("withdraw");
  };

  if (!tokenAddress) return null;

  // For external withdraw: show chain selector first
  if (destination === "external" && step === "chain-select" && open) {
    return (
      <SelectChainModal
        isOpen={open}
        onClose={handleCancel}
        onChainSelect={handleChainSelect}
        supportedChains={SUPPORTED_CHAINS}
        closeOnSelect={false}
      />
    );
  }

  const isCollateral = destination === "collateral";
  const withdrawMode = isCollateral ? "embedded" : "external";
  const title = isCollateral
    ? `Withdraw ${tokenSymbol} to Elitra Account`
    : `Withdraw ${tokenSymbol} to external wallet`;
  const description = isCollateral
    ? "Withdraw vault shares to your Elitra Account balance."
    : `Withdraw vault shares to your external wallet. You will receive WBTC on ${selectedChainId != null ? getChainConfig(selectedChainId)?.displayName ?? `chain ${selectedChainId}` : "Citrea"}.`;

  const WithdrawWidgetModalAny = WithdrawWidgetModal as any;

  return (
    <WithdrawWidgetModalAny
      isOpen={open}
      onClose={handleCancel}
      onComplete={handleComplete}
      title={title}
      description={description}
      withdrawBatches={withdrawBatches}
      externalWithdrawBatches={isCrossChainExternal ? externalWithdrawBatches : undefined}
      tokens={CITREA_TOKENS_CONFIG}
      supportedTokens={["eCBTC"]}
      depositTokenAddress={tokenAddress}
      withdrawInputHook={withdrawInput}
      filterChains={[5115]}
      withdrawMode={withdrawMode}
      hideWithdrawModeSelector={true}
      externalWalletAddress={externalWalletAddress}
      embeddedWalletAddress={embeddedWalletAddress}
    />
  );
};
