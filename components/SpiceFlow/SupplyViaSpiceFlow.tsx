"use client";

/**
 * SupplyViaSpiceFlow — Gasless EIP-7702 Teller.deposit() flow
 *
 * Atomically approves + deposits a token into an Elitra BoringVault via the
 * Spicenet TX Submission API. The solver pays gas on behalf of the user.
 *
 * Call flow (2 calls in one ChainBatch):
 *   1. ERC20.approve(tellerAddress, depositAmount)
 *   2. Teller.deposit(depositAsset, depositAmount, minimumMint=0)
 *
 * Driven by useSpiceStore: isSupplyOpen / supplyAsset / closeSupply.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { encodeFunctionData, parseUnits, type Address, type Hex } from "viem";
import {
  useGaslessTransaction,
  type Call,
  type GaslessProgress,
  type GaslessStep,
} from "@/hooks/useGaslessTransaction";
import { useSpiceStore } from "@/store/useSpiceStore";
import { getAddresses } from "@/lib/constants";
import { NATIVE_CHAIN_ID } from "@/lib/spiceflowConfig";
import { ERC20_ABI } from "@/lib/contracts/vault-abi";
import {
  ArrowDownToLine,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
} from "lucide-react";

// Minimal Teller deposit ABI — only what we need for encodeFunctionData
const TELLER_DEPOSIT_ABI = [
  {
    type: "function" as const,
    name: "deposit",
    inputs: [
      { name: "depositAsset", type: "address" as const },
      { name: "depositAmount", type: "uint256" as const },
      { name: "minimumMint", type: "uint256" as const },
    ],
    outputs: [{ name: "shares", type: "uint256" as const }],
    stateMutability: "payable" as const,
  },
] as const;

// Step labels for the UI
const STEP_LABELS: Record<GaslessStep, string> = {
  idle: "Ready",
  building: "Building transaction...",
  "signing-delegation": "Approve delegation in wallet...",
  "signing-intent": "Sign intent in wallet...",
  submitting: "Submitting to relayer...",
  executing: "Executing on Citrea...",
  success: "Supply successful!",
  error: "Transaction failed",
};

export const SupplyViaSpiceFlow: React.FC = () => {
  const {
    isSupplyOpen,
    supplyAsset,
    closeSupply,
    addSupply,
    deductBalance,
    crossChainBalance,
  } = useSpiceStore();

  const { executeGasless, hasEmbeddedWallet } = useGaslessTransaction();

  // Form state
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<GaslessStep>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [txHash, setTxHash] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  // Auto-close timer
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isSupplyOpen) {
      setAmount("");
      setStep("idle");
      setStatusMessage("");
      setTxHash(undefined);
      setError(undefined);
    }
    return () => {
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
  }, [isSupplyOpen]);

  const onProgress = useCallback((progress: GaslessProgress) => {
    setStep(progress.step);
    setStatusMessage(progress.message);
    if (progress.txHash) setTxHash(progress.txHash);
    if (progress.error) setError(progress.error);
  }, []);

  const handleSupply = useCallback(async () => {
    if (!supplyAsset || !amount || step !== "idle") return;

    // Immediately transition away from "idle" to prevent double-click race
    // (two clicks can both read step==="idle" before React re-renders)
    setStep("building");

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount greater than 0.");
      setStep("idle");
      return;
    }

    // Validate against cross-chain balance (USD-equivalent check)
    // This is a soft check — the actual token balance on-chain is the real constraint
    if (crossChainBalance <= 0) {
      setError("No balance in your Elitra Account. Deposit funds first.");
      setStep("idle");
      return;
    }

    // Look up Teller address for this asset
    const addresses = getAddresses(NATIVE_CHAIN_ID, supplyAsset.symbol);
    if (!addresses) {
      setError(`No vault found for ${supplyAsset.symbol} on chain ${NATIVE_CHAIN_ID}.`);
      setStep("idle");
      return;
    }

    const tellerAddress = addresses.tellerAddress as Address;
    const assetAddress = supplyAsset.address as Address;
    const amountInWei = parseUnits(amount, supplyAsset.decimals);

    // Build the atomic call array:
    // Call 1: ERC20.approve(tellerAddress, exact amount)
    // Call 2: Teller.deposit(depositAsset, depositAmount, minimumMint=0)
    const calls: Call[] = [
      {
        to: assetAddress,
        value: 0n,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [tellerAddress, amountInWei],
        }),
      },
      {
        to: tellerAddress,
        value: 0n,
        data: encodeFunctionData({
          abi: TELLER_DEPOSIT_ABI,
          functionName: "deposit",
          args: [assetAddress, amountInWei, 0n],
        }),
      },
    ];

    try {
      await executeGasless(calls, assetAddress, amountInWei, onProgress);

      // Record supply in store and deduct from cross-chain balance
      addSupply({
        id: `supply-${Date.now()}`,
        assetAddress: supplyAsset.address,
        assetSymbol: supplyAsset.symbol,
        amount: amount,
        timestamp: Date.now(),
      });
      deductBalance(parsedAmount);

      // Auto-close after 3 seconds on success
      autoCloseRef.current = setTimeout(() => {
        closeSupply();
      }, 3000);
    } catch (err: unknown) {
      // Error already handled by onProgress callback
      const errMsg = err instanceof Error ? err.message : "Transaction failed";
      console.error("[SupplyViaSpiceFlow] Supply failed:", errMsg);
    }
  }, [
    supplyAsset,
    amount,
    step,
    crossChainBalance,
    executeGasless,
    onProgress,
    addSupply,
    deductBalance,
    closeSupply,
  ]);

  const handleClose = useCallback(() => {
    // Don't allow close mid-signing (could leave partial state)
    if (step === "signing-delegation" || step === "signing-intent") return;
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    closeSupply();
  }, [step, closeSupply]);

  if (!isSupplyOpen || !supplyAsset) return null;

  const isProcessing =
    step !== "idle" && step !== "success" && step !== "error";
  const isSuccess = step === "success";
  const isError = step === "error";

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Supply {supplyAsset.symbol}
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={
              step === "signing-delegation" || step === "signing-intent"
            }
            className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Success state */}
          {isSuccess && (
            <div className="text-center py-6">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-semibold text-foreground mb-1">
                Supply Successful!
              </p>
              <p className="text-sm text-muted-foreground">
                {amount} {supplyAsset.symbol} supplied to vault
              </p>
              {txHash && (
                <p className="text-xs text-muted-foreground mt-2 break-all">
                  TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </p>
              )}
            </div>
          )}

          {/* Error state */}
          {isError && (
            <div className="text-center py-6">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-lg font-semibold text-foreground mb-1">
                Supply Failed
              </p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                {error || "An unexpected error occurred."}
              </p>
              <button
                onClick={() => {
                  setStep("idle");
                  setError(undefined);
                  setStatusMessage("");
                  setTxHash(undefined);
                }}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg text-sm hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Processing state */}
          {isProcessing && (
            <div className="text-center py-6">
              <Loader2 className="w-10 h-10 text-primary mx-auto mb-3 animate-spin" />
              <p className="text-sm font-medium text-foreground mb-1">
                {STEP_LABELS[step]}
              </p>
              <p className="text-xs text-muted-foreground">
                {statusMessage || "Please wait..."}
              </p>
              {txHash && (
                <p className="text-xs text-muted-foreground mt-2 break-all">
                  TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </p>
              )}
            </div>
          )}

          {/* Idle — input form */}
          {step === "idle" && (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Amount
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        setAmount(val);
                        setError(undefined);
                      }
                    }}
                    placeholder="0.00"
                    className="w-full px-4 py-3 pr-20 bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-lg"
                    autoFocus
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    {supplyAsset.symbol}
                  </span>
                </div>
                {error && (
                  <p className="text-xs text-red-500 mt-1.5">{error}</p>
                )}
              </div>

              {/* Info row */}
              <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                <span>Elitra Account Balance</span>
                <span className="font-medium">
                  ${crossChainBalance.toFixed(2)}
                </span>
              </div>

              {/* Gasless badge */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span>Gasless — no CBTC needed for gas</span>
              </div>

              {!hasEmbeddedWallet && (
                <p className="text-xs text-amber-500">
                  No embedded wallet detected. Please log in via Privy first.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer — only show supply button in idle state */}
        {step === "idle" && (
          <div className="px-6 pb-5">
            <button
              onClick={handleSupply}
              disabled={
                !amount ||
                parseFloat(amount) <= 0 ||
                isNaN(parseFloat(amount || "0")) ||
                !hasEmbeddedWallet
              }
              className="w-full py-3 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-semibold rounded-lg text-sm transition-colors"
            >
              Supply {supplyAsset.symbol} to Vault
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
