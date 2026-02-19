"use client";

/**
 * WalletAddressSync — reads the connected wallet address from the OUTER
 * wagmi context (RainbowKit) and syncs it into the Zustand store.
 *
 * Must be rendered OUTSIDE SpiceFlowProvider, because SpiceFlowProvider
 * installs Privy's inner WagmiProvider. Any useAccount() call inside
 * SpiceFlowProvider reads from Privy's context (no RainbowKit wallet).
 *
 * Components inside SpiceFlowProvider (e.g. DepositFlow) read the address
 * from the store via useSpiceStore((s) => s.connectedAddress) instead of
 * calling useAccount() directly.
 */

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { useSpiceStore } from "@/store/useSpiceStore";

export function WalletAddressSync() {
  const { address } = useAccount();
  const setConnectedAddress = useSpiceStore((s) => s.setConnectedAddress);

  useEffect(() => {
    setConnectedAddress(address);
  }, [address, setConnectedAddress]);

  return null;
}
