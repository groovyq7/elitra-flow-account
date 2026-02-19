"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useState } from "react";
import "@spicenet-io/spiceflow-ui/styles.css";
import { SpiceFlowReadyContext } from "@/hooks/usePrivySafe";
import {
  SPICEFLOW_MODE,
  NATIVE_CHAIN_ID,
  SUPPORTED_CHAIN_IDS,
} from "@/lib/spiceflowConfig";

const SpiceFlowProviderBase = dynamic(
  () =>
    import("@spicenet-io/spiceflow-ui").then((mod) => mod.SpiceFlowProvider),
  { ssr: false },
);

export function SpiceFlowProvider({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <SpiceFlowReadyContext.Provider value={false}>
        {children}
      </SpiceFlowReadyContext.Provider>
    );
  }

  return (
    <SpiceFlowProviderBase
      provider="privy"
      privyAppId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmlsy3eup004z0cjskfxwce8n"}
      supportedChainIds={[...SUPPORTED_CHAIN_IDS]}
      mode={SPICEFLOW_MODE}
      nativeChainId={NATIVE_CHAIN_ID}
    >
      <SpiceFlowReadyContext.Provider value={true}>
        {children}
      </SpiceFlowReadyContext.Provider>
    </SpiceFlowProviderBase>
  );
}
