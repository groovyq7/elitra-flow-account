"use client";

import React, { useCallback, useState, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { useSpiceStore } from "@/store/useSpiceStore";
import { NATIVE_CHAIN_ID, WCBTC_ADDRESS } from "@/lib/spiceflowConfig";

// Auto-close delay after successful deposit so user sees the SDK success banner
const AUTO_CLOSE_DELAY_MS = 3000;

// Allowed tokens for SpiceDeposit — users can deposit these from external wallets
const ALLOWED_DEPOSIT_TOKENS = ["usdc", "eth", "wbtc"];

interface SdkDepositProps {
  isOpen: boolean;
  onClose: () => void;
  onDepositAmountChange?: (amount: string) => void;
  allowedTokens?: string[];
  destinationChainId?: number;
  destinationTokenAddress?: `0x${string}`;
  postDepositInstruction?: (bridgedAmount: string) => Promise<void>;
  postDepositInstructionLabel?: string;
  externalWalletAddress?: `0x${string}`;
}

export const DepositFlow: React.FC = () => {
  const { isDepositOpen, closeDeposit, addDeposit } = useSpiceStore();
  const { address: walletAddress } = useAccount();

  const [SdkDeposit, setSdkDeposit] = useState<React.ComponentType<SdkDepositProps> | null>(
    null
  );

  // ---------- Refs ----------
  const lastDepositAmountRef = useRef<string>("");
  const lastDepositAssetRef = useRef<string>("USDC");
  const lastBridgedAmountRef = useRef<string>("");
  const depositSucceededRef = useRef(false);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref that exposes markSuccess to the postDepositInstruction callback.
  // This is the PRIMARY success signal — the SDK calls postDepositInstruction
  // only when the deposit has actually been submitted on-chain, making it more
  // reliable than DOM observers or custom events.
  const markSuccessRef = useRef<((source: string) => void) | null>(null);

  // ---------- Core close handlers ----------

  const handleClose = useCallback(() => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    closeDeposit();
    lastDepositAmountRef.current = "";
    lastDepositAssetRef.current = "USDC";
    lastBridgedAmountRef.current = "";
    depositSucceededRef.current = false;
  }, [closeDeposit]);

  const handleSdkClose = useCallback(() => {
    handleClose();
  }, [handleClose]);

  // ---------- Effects ----------

  // Lazy-load SpiceDeposit from the SDK at runtime
  useEffect(() => {
    let cancelled = false;
    import("@spicenet-io/spiceflow-ui")
      .then((sdk) => {
        if (cancelled) return;
        const Comp =
          (sdk as { SpiceDeposit?: React.ComponentType<SdkDepositProps> }).SpiceDeposit ??
          ((sdk as { default?: { SpiceDeposit?: React.ComponentType<SdkDepositProps> } }).default?.SpiceDeposit) ??
          null;
        if (Comp) setSdkDeposit(() => Comp);
      })
      .catch((err) => {
        if (!cancelled) console.error("[DepositFlow] Failed to load SpiceFlow SDK:", err);
      });
    return () => { cancelled = true; };
  }, []);

  // Cleanup auto-close timer on unmount (wallet disconnect, etc.)
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, []);

  // ESC key to close
  useEffect(() => {
    if (!isDepositOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isDepositOpen, handleClose]);

  // Multi-signal deposit success detection
  useEffect(() => {
    if (!isDepositOpen) return;

    const markSuccess = (source: string) => {
      if (depositSucceededRef.current) return;
      depositSucceededRef.current = true;

      const amount = lastDepositAmountRef.current;
      if (amount && parseFloat(amount) > 0) {
        try {
          const asset = lastDepositAssetRef.current || "USDC";
          const bridgedUsdc = lastBridgedAmountRef.current;

          const isStablecoin =
            asset === "USDC" || asset === "USD" || asset === "USDT";
          const usdValue =
            !isStablecoin &&
            bridgedUsdc &&
            parseFloat(bridgedUsdc) > 0
              ? bridgedUsdc
              : amount;

          addDeposit({
            id: `dep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            asset,
            amount,
            usdValue,
            sourceChain: "Elitra Account",
            timestamp: Date.now(),
          });
        } catch (err) {
          console.warn("[DepositFlow] Failed to record deposit:", err);
        }
      }

      // Auto-close after delay so user sees the success banner
      autoCloseTimerRef.current = setTimeout(() => {
        handleClose();
      }, AUTO_CLOSE_DELAY_MS);
    };

    // Expose markSuccess via ref so the postDepositInstruction callback (primary
    // success signal) can call it without violating hook rules.
    markSuccessRef.current = markSuccess;

    // Signal 1: tx-complete CustomEvent (7702/swap paths)
    const handleTxComplete = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === "deposit") markSuccess("tx-complete event");
    };

    // Signal 2: deposit-completed CustomEvent (7702 path)
    const handleDepositCompleted = () =>
      markSuccess("deposit-completed event");

    // Signal 3: cross-chain-deposit-completed CustomEvent (emitted by SDK)
    const handleCrossChainCompleted = () =>
      markSuccess("cross-chain-deposit-completed event");

    // Signal 4: MutationObserver for SDK success banner
    const successPattern = /DEPOSIT\s+TO\s+\w+\s+SUCCESSFUL/i;
    const observer = new MutationObserver((mutations) => {
      if (depositSucceededRef.current) return;
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue;
          if (successPattern.test(node.textContent || "")) {
            markSuccess("DOM MutationObserver (SUCCESSFUL banner)");
            return;
          }
        }
      }
    });

    window.addEventListener("tx-complete", handleTxComplete);
    window.addEventListener("deposit-completed", handleDepositCompleted);
    window.addEventListener(
      "cross-chain-deposit-completed",
      handleCrossChainCompleted
    );
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      // Clear the ref on cleanup so stale markSuccess isn't called after unmount
      markSuccessRef.current = null;
      window.removeEventListener("tx-complete", handleTxComplete);
      window.removeEventListener("deposit-completed", handleDepositCompleted);
      window.removeEventListener(
        "cross-chain-deposit-completed",
        handleCrossChainCompleted
      );
      observer.disconnect();
    };
  }, [isDepositOpen, addDeposit, handleClose]);

  // Detect selected source asset via DOM observation
  useEffect(() => {
    if (!isDepositOpen) return;

    const detectAsset = () => {
      const depositRoot = document.querySelector(
        "[class*='spice'], [class*='Spice'], [class*='deposit'], [class*='Deposit']"
      );
      const searchRoot = depositRoot || document.body;

      // Check data attributes first
      const dataToken = searchRoot.querySelector(
        "[data-token], [data-asset], [data-symbol]"
      );
      if (dataToken) {
        const symbol = (
          dataToken.getAttribute("data-token") ||
          dataToken.getAttribute("data-asset") ||
          dataToken.getAttribute("data-symbol") ||
          ""
        ).toUpperCase();
        if (symbol === "ETH" || symbol === "ETHER") {
          lastDepositAssetRef.current = "ETH";
          return;
        }
        if (symbol === "USDC") {
          lastDepositAssetRef.current = "USDC";
          return;
        }
        if (symbol === "WBTC" || symbol === "BTC") {
          lastDepositAssetRef.current = "WBTC";
          return;
        }
      }

      // Scan interactive/badge elements for token text
      const tokenElements = searchRoot.querySelectorAll(
        'button, span, [class*="token"], [class*="badge"], [class*="symbol"], [class*="selected"]'
      );
      for (const el of Array.from(tokenElements)) {
        const text = (el.textContent || "").trim().toUpperCase();
        if (text === "ETH" || text === "ETHER") {
          lastDepositAssetRef.current = "ETH";
          return;
        }
        if (text === "USDC") {
          lastDepositAssetRef.current = "USDC";
          return;
        }
        if (text === "WBTC") {
          lastDepositAssetRef.current = "WBTC";
          return;
        }
      }
    };

    const observer = new MutationObserver(() => detectAsset());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [isDepositOpen]);

  // ---------- Callbacks ----------

  const handleDepositAmountChange = useCallback((amount: string) => {
    lastDepositAmountRef.current = amount;
  }, []);

  // Primary success signal — SDK calls this after a successful deposit.
  // It both records the bridged amount AND triggers markSuccess so the balance
  // is updated even if none of the fallback custom events / DOM observers fire.
  const handlePostDeposit = useCallback(async (bridgedAmount: string) => {
    lastBridgedAmountRef.current = bridgedAmount;
    // Fire markSuccess through the ref (safe to call async from callback)
    markSuccessRef.current?.("postDepositInstruction callback");
  }, []);

  // ---------- Render ----------

  if (!isDepositOpen) return null;

  if (SdkDeposit) {
    return (
      <SdkDeposit
        isOpen={true}
        onClose={handleSdkClose}
        onDepositAmountChange={handleDepositAmountChange}
        allowedTokens={ALLOWED_DEPOSIT_TOKENS}
        destinationChainId={NATIVE_CHAIN_ID}
        destinationTokenAddress={WCBTC_ADDRESS}
        postDepositInstruction={handlePostDeposit}
        postDepositInstructionLabel="Deposit to Elitra Account"
        externalWalletAddress={walletAddress}
      />
    );
  }

  // Fallback when SDK component is unavailable
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background rounded-2xl p-6 w-full max-w-md mx-4 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">Deposit</h2>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground"
          >
            &#x2715;
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          SpiceFlow SDK deposit component is not loaded. Make sure{" "}
          <code className="text-xs bg-muted px-1 rounded">
            @spicenet-io/spiceflow-ui
          </code>{" "}
          is installed.
        </p>
      </div>
    </div>
  );
};
