"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useAccount, useSwitchChain } from "wagmi";
import { SelectChainModal } from "./SelectChainModal";
import { CrossChainDepositModal } from "./CrossChainDepositModal";
import { AirdropModal } from "./Airdrop";

export interface CrossChainDepositFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (chainId: number) => void;
  supportedChains?: number[];
  /** If provided, skip chain selection and go directly to provider-login/deposit */
  initialChainId?: number;
}

type FlowStep = "select-chain" | "provider-login" | "airdrop" | "deposit";
type SupportedChainId = 11155111 | 84532 | 5115;

export const CrossChainDepositFlow: React.FC<CrossChainDepositFlowProps> = ({
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
  const { address: externalWalletAddress } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const chainSelectedRef = useRef(false);

  const handleChainSelect = useCallback(
    (chainId: number | undefined) => {
      console.log("Chain selected:", chainId);
      chainSelectedRef.current = true;
      setSelectedChainId(chainId as SupportedChainId | undefined);
      setCurrentStep("provider-login");
      loginTriggeredRef.current = false;
      completedRef.current = false;
      setIsLoginInProgress(false);
    },
    []
  );

  const handleClose = useCallback(async () => {
    console.log("Closing SpiceFlow");
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

  const handleSelectChainClose = useCallback(async () => {
    // Add a small delay to allow chain selection callback to set the ref first
    await new Promise(resolve => setTimeout(resolve, 50));
    if (chainSelectedRef.current) {
      chainSelectedRef.current = false;
      return;
    }
    handleClose();
  }, [handleClose]);

  const handleDepositComplete = useCallback(() => {
    console.log("Deposit complete, calling onComplete to transition to vault deposit");
    completedRef.current = true;
    if (onComplete && selectedChainId) {
      onComplete(selectedChainId);
    }
  }, [onComplete, selectedChainId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setCurrentStep(initialChainId ? "provider-login" : "select-chain");
        setSelectedChainId(initialChainId as SupportedChainId | undefined);
        loginTriggeredRef.current = false;
        completedRef.current = false;
        setIsLoginInProgress(false);
      }, 300);
      return () => clearTimeout(timer);
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
        console.log(
          "Already authenticated with wallet, moving to airdrop step"
        );
        setCurrentStep("airdrop");
      } else if (authenticated && !embeddedWalletAddress) {
        // Authenticated but wallet still loading - just wait
        console.log("Authenticated, getting your embedded wallet ready...");
        // Don't trigger login again, don't close - just wait
      } else if (!authenticated && !loginTriggeredRef.current) {
        // Not authenticated, trigger login
        console.log("Not authenticated, triggering login");
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
      console.log("Authentication completed, moving to airdrop step");
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
      if (onComplete && selectedChainId) {
        onComplete(selectedChainId);
      }
    };

    window.addEventListener("airdrop-skipped", handleAirdropSkipped);
    window.addEventListener("cross-chain-deposit-skipped", handleCrossChainDepositSkipped);

    return () => {
      window.removeEventListener("airdrop-skipped", handleAirdropSkipped);
      window.removeEventListener("cross-chain-deposit-skipped", handleCrossChainDepositSkipped);
    };
  }, [onComplete, selectedChainId]);

  // Reset login progress state when authentication status changes
  useEffect(() => {
    if (authenticated && isLoginInProgress) {
      console.log("User authenticated, resetting login progress state");
      setIsLoginInProgress(false);
    }
  }, [authenticated, isLoginInProgress]);

  // Auto-skip airdrop for Citrea chain
  useEffect(() => {
    if (currentStep === "airdrop" && selectedChainId === 5115) {
      console.log("Citrea chain selected, skipping airdrop step");
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
          <div
            style={{
              width: "48px",
              height: "48px",
              border: "4px solid #f3f4f6",
              borderTopColor: "#336AFD",
              borderRadius: "50%",
              margin: "0 auto 16px",
              animation: "spin 1s linear infinite",
            }}
          />
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
          <style
            dangerouslySetInnerHTML={{
              __html: `
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `,
            }}
          />
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
