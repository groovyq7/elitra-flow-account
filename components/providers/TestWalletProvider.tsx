"use client";

/**
 * TestWalletProvider — used in automated testing only.
 * When NEXT_PUBLIC_USE_TEST_WALLET=true, auto-connects with the test wallet
 * so Playwright tests don't need to interact with MetaMask.
 *
 * Never included in production builds.
 */
import { useEffect } from "react";
import { useConnect } from "wagmi";

export function TestWalletAutoConnect() {
  const { connect, connectors } = useConnect();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_USE_TEST_WALLET !== "true") return;

    // Find the mock connector and auto-connect
    const mockConnector = connectors.find((c) => c.id === "mock");
    if (mockConnector) {
      connect({ connector: mockConnector });
    }
  }, [connect, connectors]);

  return null;
}
