'use client';
import React from 'react';
import dynamic from 'next/dynamic';

const SelectChainModalUI = dynamic(
  () => import("@spicenet-io/spiceflow-ui").then((mod) => mod.SelectChainModal),
  { ssr: false }
);

interface SelectChainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChainSelect?: (chainId: number | undefined) => void;
  supportedChains?: number[];
  closeOnSelect?: boolean;
}

export const SelectChainModal: React.FC<SelectChainModalProps> = ({
  isOpen,
  onClose,
  onChainSelect,
  supportedChains = [11155111, 421614, 84532, 5115],
  closeOnSelect = false,
}) => {
  const handleChainSelect = (chainIdStr: string) => {
    const chainId = parseInt(chainIdStr, 10);
    // Guard against NaN (e.g. SDK passes unexpected value)
    onChainSelect?.(isNaN(chainId) ? undefined : chainId);
  };

  if (!isOpen) return null;

  return (
    <SelectChainModalUI
      isOpen={isOpen}
      onClose={onClose}
      onChainSelect={handleChainSelect}
      supportedChains={supportedChains}
      closeOnSelect={closeOnSelect}
    />
  );
};