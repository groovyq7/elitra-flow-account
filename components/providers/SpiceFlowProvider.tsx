"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useState } from "react";
import "@spicenet-io/spiceflow-ui/styles.css";

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
    return <>{children}</>;
  }

  return (
    <SpiceFlowProviderBase
      provider="privy"
      privyAppId={"cmli6tyqk0599js0c62h22u4e"}
      supportedChainIds={[11155111, 421614, 84532, 5115]}
    >
      {children}
    </SpiceFlowProviderBase>
  );
}
