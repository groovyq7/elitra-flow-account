"use client";

import React from "react";
import dynamic from "next/dynamic";

// Lazy-load to avoid SSR issues with SDK components
const DepositFlow = dynamic(
  () => import("./DepositFlow").then((m) => ({ default: m.DepositFlow })),
  { ssr: false }
);

const WithdrawFlow = dynamic(
  () => import("./WithdrawFlow").then((m) => ({ default: m.WithdrawFlow })),
  { ssr: false }
);

const SupplyViaSpiceFlow = dynamic(
  () =>
    import("./SupplyViaSpiceFlow").then((m) => ({
      default: m.SupplyViaSpiceFlow,
    })),
  { ssr: false }
);

/**
 * Error boundary that catches SDK component crashes and renders nothing
 * instead of taking down the entire app. Logs the error for debugging.
 */
class SdkErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[SdkErrorBoundary] SDK component crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export const GlobalModals: React.FC = () => {
  return (
    <>
      <SdkErrorBoundary>
        <DepositFlow />
      </SdkErrorBoundary>
      <SdkErrorBoundary>
        <WithdrawFlow />
      </SdkErrorBoundary>
      <SdkErrorBoundary>
        <SupplyViaSpiceFlow />
      </SdkErrorBoundary>
    </>
  );
};
