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
 * Automatically resets after 5 seconds so the modal can be reopened.
 */
class SdkErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[SdkErrorBoundary] SDK component crashed:", error, info.componentStack);
    // Auto-reset after 5 seconds so the user can retry
    this.resetTimer = setTimeout(() => {
      this.setState({ hasError: false });
    }, 5000);
  }

  componentWillUnmount() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
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
