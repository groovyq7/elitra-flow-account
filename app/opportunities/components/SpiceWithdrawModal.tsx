import { WithdrawWidgetModal, useAssetInput } from "@spicenet-io/spiceflow-ui";
import { SelectChainModal } from "@/components/cross-chain-deposit/SelectChainModal";
import { getChainConfig } from "@/lib/utils/chains";
import { getVaultRate } from "@/lib/utils/get-token-balance";
import { useEffect, useState, useMemo } from "react";
import React from "react";
import { encodeFunctionData, parseUnits } from "viem";
import TELLER_ABI from "@/lib/abis/EliteraTeller.json";
import { getAddresses } from "@/lib/constants";
import { ChainBatch } from "@/lib/types";
import { trackWithdrawSuccess } from "@/lib/analytics";

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

const SUPPORTED_CHAINS = [11155111, 84532, 421614, 5115];

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
  const [vaultRate, setVaultRate] = useState<bigint | null>(null); // assets per 1 share, scaled 1e18
  const withdrawInput = useAssetInput();

  // Reset state when modal opens to ensure clean state on every open.
  // Previously a delayed reset on close, which races with rapid close→reopen.
  useEffect(() => {
    if (open) {
      setStep(destination === "external" ? "chain-select" : "withdraw");
      setSelectedChainId(null);
      setVaultRate(null); // Reset rate; fresh fetch will run via separate effect
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

  // Fetch current vault rate (assets per 1 share, scaled by 1e18) so we can
  // compute a proper minimumAssets with 0.5% slippage tolerance.
  // Runs once when the modal opens; stale-on-unmount safe via cancelled flag.
  useEffect(() => {
    if (!open || !tokenSymbol) return;
    let cancelled = false;
    const fetchRate = async () => {
      const chainConfig = getChainConfig(5115);
      if (!chainConfig?.viemChain) return;
      try {
        const result = await getVaultRate(tokenSymbol, chainConfig.viemChain);
        if (!cancelled && result.rateRaw > 0n) {
          setVaultRate(result.rateRaw);
        }
      } catch {
        // Leave vaultRate null; withdrawBatches will use 1n fallback
      }
    };
    fetchRate();
    return () => { cancelled = true; };
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

    // minimumAssets: apply 0.5% slippage tolerance when the vault rate is
    // available. Formula: floor(shares × rateRaw / 1e18 × 0.995).
    // vaultRate is the rate from the Accountant contract: assets per 1 share
    // scaled by 1e18 (e.g. 1.05e18 means each share redeems to 1.05 underlying).
    // Fallback to 1n (accept anything > 0) when the rate fetch is still in
    // flight or failed — prevents blocking the UI for a missing rate.
    const RATE_SCALE = 1_000_000_000_000_000_000n; // 1e18
    const minimumAssets =
      vaultRate && vaultRate > 0n
        ? (tokenAmount * vaultRate / RATE_SCALE) * 995n / 1000n
        : 1n;

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
              args: [tokenAddress, tokenAmount, minimumAssets, recipient],
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
    vaultRate,
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
    trackWithdrawSuccess({
      type: 'spice_withdraw',
      tokenSymbol,
      destination,
      chainId: selectedChainId ?? 5115,
    });
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK type mismatch
  const WithdrawWidgetModalAny = WithdrawWidgetModal as unknown as React.ComponentType<Record<string, unknown>>;

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
