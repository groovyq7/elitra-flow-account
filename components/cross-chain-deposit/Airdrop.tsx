'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import { getChainConfig, getSupportedTokens } from '@/lib/utils/chains';

const AirdropModalUI = dynamic(
    () => import("@spicenet-io/spiceflow-ui").then((mod) => mod.AirdropModal),
    { ssr: false }
);

interface AirdropModalProps {
    isOpen: boolean;
    onClose: () => void;
    chainId: 11155111 | 84532 | undefined;
    externalWalletAddress: string;
}

export const AirdropModal: React.FC<AirdropModalProps> = ({
    isOpen,
    onClose,
    chainId,
    externalWalletAddress,
}) => {

    if (!isOpen || !chainId) return null;

    return (
        <AirdropModalUI
            isOpen={isOpen}
            onClose={onClose}
            chainId={chainId}
            airdropTag="elitra"
            walletAddress={externalWalletAddress}
            airdropTokens={["WBTC"]}
            getChainConfig={getChainConfig}
            getSupportedTokens={getSupportedTokens}
        />
    );
};