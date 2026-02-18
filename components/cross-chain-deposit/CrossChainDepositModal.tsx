'use client';
import React from "react";
import dynamic from 'next/dynamic';
import { getChainConfig, getSupportedTokens } from "@/lib/utils/chains";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK type mismatch with dynamic import
const CrossChainDepositModalUI = dynamic(
  () => import("@spicenet-io/spiceflow-ui").then((mod) => mod.CrossChainDepositModal) as any,
  { ssr: false }
) as React.ComponentType<Record<string, unknown>>;

interface CrossChainDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  chainId: 5115 | 11155111 | 84532 | undefined;
  embeddedWalletAddress: string;
  externalWalletAddress: string;
  supportedChains: number[];
}

export const CrossChainDepositModal: React.FC<CrossChainDepositModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  chainId,
  embeddedWalletAddress,
  externalWalletAddress,
  supportedChains,
}) => {
  if (!isOpen) return null;

  return (
    <div className="relative">
      <CrossChainDepositModalUI
        isOpen={isOpen}
        onClose={onClose}
        onComplete={onComplete}
        title="Deposit to Elitra Vault"
        description="Select tokens and amounts to deposit into your cross-chain balance, then confirm the vault deposit."
        chainId={chainId}
        embeddedWalletAddress={embeddedWalletAddress}
        externalWalletAddress={externalWalletAddress}
        supportedChains={supportedChains as number[]}
        airdropTokenSymbol="WBTC"
        getChainConfig={getChainConfig}
        getSupportedTokens={getSupportedTokens}
      />
    </div>
  );
};