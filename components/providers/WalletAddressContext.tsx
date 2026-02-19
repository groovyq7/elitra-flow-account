"use client";

/**
 * WalletAddressContext — provides the connected wallet address from the OUTER
 * wagmi context (RainbowKit) to components deep inside SpiceFlowProvider.
 *
 * SpiceFlowProvider installs Privy's inner WagmiProvider, which shadows the
 * outer WagmiProvider for any useAccount() calls inside it. This context
 * is provided OUTSIDE SpiceFlowProvider and consumed INSIDE it, bypassing
 * the inner wagmi context entirely.
 *
 * Usage inside SpiceFlowProvider:
 *   const walletAddress = useWalletAddress();
 */

import React, { createContext, useContext } from "react";
import { useAccount } from "wagmi";

const WalletAddressContext = createContext<`0x${string}` | undefined>(undefined);

/**
 * Provide wallet address from the outer (RainbowKit) wagmi context.
 * Must be rendered OUTSIDE SpiceFlowProvider.
 */
export function WalletAddressProvider({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();
  return (
    <WalletAddressContext.Provider value={address}>
      {children}
    </WalletAddressContext.Provider>
  );
}

/**
 * Read the connected wallet address. Works correctly even when called
 * from inside SpiceFlowProvider (which has its own inner WagmiProvider).
 */
export function useWalletAddress(): `0x${string}` | undefined {
  return useContext(WalletAddressContext);
}
