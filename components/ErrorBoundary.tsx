"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Generic React Error Boundary.
 * Catches render-phase errors in the subtree and shows a fallback UI
 * instead of crashing the entire page.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <RiskyComponent />
 *   </ErrorBoundary>
 *
 * Custom fallback:
 *   <ErrorBoundary fallback={<p>Custom message</p>}>
 *     <RiskyComponent />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Render error caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center"
        >
          <p className="text-lg font-semibold text-foreground mb-2">
            Something went wrong.
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            An unexpected error occurred. Please refresh to try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Refresh page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
