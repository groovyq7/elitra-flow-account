"use client";

import type React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "@/lib/wagmi";
import { useEffect, useState } from "react";
import {
  RainbowKitProvider,
  lightTheme,
} from "@rainbow-me/rainbowkit";
import { citreaTestnet } from "viem/chains";
import { useAccount, useChainId } from 'wagmi'
import { identifyUser, resetUser, trackChainChanged, trackWalletConnected, trackWalletDisconnected } from '@/lib/analytics'
import { useSpiceStore } from '@/store/useSpiceStore'

export function WagmiProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());

  // Note: useAccount/useChainId must be used inside WagmiProvider context,
  // so we render a child tracker component below that runs these hooks.

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={lightTheme({
              accentColor: "#00b8ff",
              accentColorForeground: "white",
              borderRadius: "large",
              fontStack: "rounded",
              overlayBlur: "small",
            })}
          initialChain={citreaTestnet}
          modalSize="compact"
        >
          <WagmiAnalyticsTracker />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function WagmiAnalyticsTracker() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const resetStore = useSpiceStore((s) => s.resetStore)

  useEffect(() => {
    if (isConnected && address) {
      identifyUser(address, { chainId })
      trackWalletConnected(address, { chainId })
    } else {
      resetUser()
      trackWalletDisconnected()
      // Clear persisted cross-chain balance and history so a different wallet
      // connecting afterwards starts with a clean slate.
      resetStore()
    }
  }, [isConnected, address, chainId, resetStore])

  useEffect(() => {
    if (chainId != null) trackChainChanged(chainId)
  }, [chainId])

  return null
}
