"use client";

import { useWalletAddress } from "@/components/providers/WalletAddressContext";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSwitchChain } from "wagmi";

import { useSpiceFlowReady } from "@/hooks/usePrivySafe";
import { SelectChainModal } from "./SelectChainModal";
import { CrossChainDepositModal } from "./CrossChainDepositModal";
import { AirdropModal } from "./Airdrop";
import { track, trackModalOpen, trackDepositSuccess } from "@/lib/analytics";

export interface CrossChainDepositFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (chainId: number) => void;
  supportedChains?: number[];
  /** If provided, skip chain selection and go directly to provider-login/deposit */
  initialChainId?: number;
}

type FlowStep = "select-chain" | "provider-login" | "airdrop" | "deposit";
// NOTE: 421614 (Arbitrum Sepolia) appears in SUPPORTED_CHAINS from SpiceDepositModal
// but is intentionally omitted from this union type. When 421614 is selected at
// the SpiceDepositModal entry point it is cast via `as SupportedChainId` and
// passed through — the SDK handles it at runtime without strict typing.
// Arbitrum Sepolia can be added here (and in CrossChainDepositModal / AirdropModal)
// once the airdrop flow has been tested and confirmed to support that chain.
type SupportedChainId = 11155111 | 84532 | 5115;

/**
 * Shell — guards against calling Privy hooks before the SpiceFlowProvider
 * (and its internal PrivyProvider) has mounted.  Renders null until ready.
 */
export const CrossChainDepositFlow: React.FC<CrossChainDepositFlowProps> = (
  props
) => {
  const spiceFlowReady = useSpiceFlowReady();
  if (!props.isOpen || !spiceFlowReady) return null;
  return <CrossChainDepositFlowInner {...props} />;
};

/** Inner component — safe to call Privy hooks here. */
const CrossChainDepositFlowInner: React.FC<CrossChainDepositFlowProps> = ({
  isOpen,
  onClose,
  onComplete,
  supportedChains = [11155111, 84532, 5115],
  initialChainId,
}) => {
  // If initialChainId is provided, skip chain selection
  const [currentStep, setCurrentStep] = useState<FlowStep>(
    initialChainId ? "provider-login" : "select-chain"
  );
  const [selectedChainId, setSelectedChainId] = useState<
    SupportedChainId | undefined
  >(initialChainId as SupportedChainId | undefined);
  const [isLoginInProgress, setIsLoginInProgress] = useState(false);
  const loginTriggeredRef = useRef(false);
  const completedRef = useRef(false);

  // Use Privy hooks
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = wallets.find((w) => w.connectorType === "embedded");
  const embeddedWalletAddress = embeddedWallet?.address;

  // Get external wallet address from wagmi
  const externalWalletAddress = useWalletAddress();
  const { switchChainAsync } = useSwitchChain();

  const chainSelectedRef = useRef(false);

  const handleChainSelect = useCallback(
    (chainId: number | undefined) => {
      chainSelectedRef.current = true;
      if (chainId != null) track('cross_chain_chain_selected', { chainId });
      setSelectedChainId(chainId as SupportedChainId | undefined);
      setCurrentStep("provider-login");
      loginTriggeredRef.current = false;
      completedRef.current = false;
      setIsLoginInProgress(false);
    },
    []
  );

  const handleClose = useCallback(async () => {
    loginTriggeredRef.current = false;
    completedRef.current = false;
    setIsLoginInProgress(false);

    try {
      await switchChainAsync({ chainId: 5115 });
    } catch (error) {
      console.error("Failed to switch back to Citrea:", error);
    }

    onClose();
  }, [onClose, switchChainAsync]);

  const handleSelectChainClose = useCallback(() => {
    // Use a microtask instead of a 50ms setTimeout to avoid the race condition.
    // onChainSelect fires synchronously before onClose, but we use queueMicrotask
    // to let the synchronous chain-selection callback complete first.
    queueMicrotask(() => {
      if (chainSelectedRef.current) {
        chainSelectedRef.current = false;
        return;
      }
      handleClose();
    });
  }, [handleClose]);

  const handleDepositComplete = useCallback(async () => {
    completedRef.current = true;
    trackDepositSuccess({ type: 'cross_chain_deposit', chainId: selectedChainId });
    // Switch back to Citrea after the cross-chain deposit succeeds so the user
    // is on the correct chain for subsequent vault interactions.
    try {
      await switchChainAsync({ chainId: 5115 });
    } catch (error) {
      console.error("Failed to switch back to Citrea after deposit:", error);
    }
    if (onComplete && selectedChainId) {
      onComplete(selectedChainId);
    }
  }, [onComplete, selectedChainId, switchChainAsync]);

  // Reset state when modal opens to ensure clean state on every open.
  // Previously a 300ms delayed reset on close, which races with rapid close→reopen.
  useEffect(() => {
    if (isOpen) {
      trackModalOpen('deposit_to_account');
      setCurrentStep(initialChainId ? "provider-login" : "select-chain");
      setSelectedChainId(initialChainId as SupportedChainId | undefined);
      loginTriggeredRef.current = false;
      completedRef.current = false;
      setIsLoginInProgress(false);
      return;
    }
  }, [isOpen, initialChainId]);

  // Auto-trigger Privy login when on provider-login step
  useEffect(() => {
    if (
      isOpen &&
      currentStep === "provider-login" &&
      ready &&
      !loginTriggeredRef.current &&
      !completedRef.current
    ) {
      if (authenticated && embeddedWalletAddress) {
        // Already have everything, move to airdrop step
        setCurrentStep("airdrop");
      } else if (authenticated && !embeddedWalletAddress) {
        // Authenticated but wallet still loading - just wait
        // Don't trigger login again, don't close - just wait
      } else if (!authenticated && !loginTriggeredRef.current) {
        // Not authenticated, trigger login
        loginTriggeredRef.current = true;
        setIsLoginInProgress(true);
        login();
      }
    }
  }, [isOpen, currentStep, ready, authenticated, embeddedWalletAddress, login]);

  // Detect when authentication completes
  useEffect(() => {
    if (
      isOpen &&
      currentStep === "provider-login" &&
      authenticated &&
      embeddedWalletAddress &&
      !completedRef.current
    ) {
      setIsLoginInProgress(false);
      const timer = setTimeout(() => {
        setCurrentStep("airdrop");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, currentStep, authenticated, embeddedWalletAddress]);

  useEffect(() => {
    const handleAirdropSkipped = () => {
      setCurrentStep("deposit");
    };

    const handleCrossChainDepositSkipped = () => {
      completedRef.current = true;
      // Switch back to Citrea when the deposit step is skipped (e.g. user already
      // has sufficient balance) so the wallet is on the right chain afterwards.
      switchChainAsync({ chainId: 5115 })
        .catch((error) => {
          console.error("Failed to switch back to Citrea after skip:", error);
        })
        .finally(() => {
          if (onComplete && selectedChainId) {
            onComplete(selectedChainId);
          }
        });
    };

    window.addEventListener("airdrop-skipped", handleAirdropSkipped);
    window.addEventListener("cross-chain-deposit-skipped", handleCrossChainDepositSkipped);

    return () => {
      window.removeEventListener("airdrop-skipped", handleAirdropSkipped);
      window.removeEventListener("cross-chain-deposit-skipped", handleCrossChainDepositSkipped);
    };
  }, [onComplete, selectedChainId, switchChainAsync]);

  // Reset login progress state when authentication status changes
  useEffect(() => {
    if (authenticated && isLoginInProgress) {
      setIsLoginInProgress(false);
    }
  }, [authenticated, isLoginInProgress]);

  // Auto-skip airdrop for Citrea chain
  useEffect(() => {
    if (currentStep === "airdrop" && selectedChainId === 5115) {
      setCurrentStep("deposit");
    }
  }, [currentStep, selectedChainId]);

  if (!isOpen) return null;

  // Step 1: Select Chain
  if (currentStep === "select-chain") {
    return (
      <SelectChainModal
        isOpen={true}
        onClose={handleSelectChainClose}
        onChainSelect={handleChainSelect}
        supportedChains={supportedChains as SupportedChainId[]}
      />
    );
  }

  // Step 2: Provider Login
  if (currentStep === "provider-login") {
    // Don't render our overlay while Privy login modal is active (not authenticated yet)
    // This prevents our UI from blocking Privy's modal
    if (!authenticated) {
      // Return null to let Privy's modal appear without interference
      return null;
    }

    // Only show our loading UI when authenticated but waiting for embedded wallet
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 50,
        }}
      >
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "32px",
            textAlign: "center",
            maxWidth: "400px",
            position: "relative",
          }}
        >
          <div className="w-12 h-12 border-4 border-gray-100 border-t-[#336AFD] rounded-full animate-spin mx-auto mb-4" />
          <h3
            style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}
          >
            {embeddedWalletAddress ? "Setting up..." : "Creating your wallet..."}
          </h3>
          <p style={{ color: "#6b7280", fontSize: "14px" }}>
            {embeddedWalletAddress
              ? "Preparing your account"
              : "This may take a few seconds"}
          </p>
        </div>
      </div>
    );
  }

  // Step 3: Airdrop
  if (currentStep === "airdrop") {
    if (!externalWalletAddress) {
      return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div className="bg-white rounded-xl p-8 text-center max-w-md mx-4">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-[#336AFD] rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
            <p className="text-gray-500 text-sm mb-4">
              Please connect your external wallet (MetaMask, etc.) to continue.
            </p>
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    // Only show airdrop for supported chains (not Citrea)
    if (selectedChainId && selectedChainId !== 5115) {
      return (
        <AirdropModal
          isOpen={true}
          onClose={handleClose}
          chainId={selectedChainId as 11155111 | 84532}
          externalWalletAddress={externalWalletAddress}
        />
      );
    }
    
    // For Citrea or no chain selected, show loading while we transition
    // The useEffect below will handle the actual state change
    return null;
  }

  // Step 4: Deposit
  if (currentStep === "deposit") {
    // Show loading if waiting for wallet addresses
    if (!externalWalletAddress || !embeddedWalletAddress) {
      return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div className="bg-white rounded-xl p-8 text-center max-w-md mx-4">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-[#336AFD] rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {!externalWalletAddress ? "Connect Your Wallet" : "Loading..."}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {!externalWalletAddress
                ? "Please connect your external wallet (MetaMask, etc.) to continue."
                : "Setting up your embedded wallet..."}
            </p>
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    if (selectedChainId) {
      return (
        <CrossChainDepositModal
          isOpen={true}
          onClose={handleClose}
          onComplete={handleDepositComplete}
          chainId={selectedChainId}
          embeddedWalletAddress={embeddedWalletAddress}
          externalWalletAddress={externalWalletAddress}
          supportedChains={supportedChains}
        />
      );
    }
  }

  return null;
};

export default CrossChainDepositFlow;
