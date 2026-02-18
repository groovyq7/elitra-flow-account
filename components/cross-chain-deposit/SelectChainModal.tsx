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
}) => {
  const handleChainSelect = (chainIdStr: string) => {
    const chainId = parseInt(chainIdStr, 10);
    console.log('Chain selected from library:', chainId);
    onChainSelect?.(chainId);
  };

  if (!isOpen) return null;

  return (
    <SelectChainModalUI
      isOpen={isOpen}
      onClose={onClose}
      onChainSelect={handleChainSelect}
      supportedChains={supportedChains}
      closeOnSelect={false}
    />
  );
};