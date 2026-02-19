"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function WalletConnectButton() {
  return (
    <ConnectButton
      chainStatus="none"
      label="Connect"
      showBalance={false}
    />
  );
}
