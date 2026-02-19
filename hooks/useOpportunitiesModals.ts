"use client";

import { useEffect, useState } from "react";
import { TokenType } from "@/lib/types";

interface UseOpportunitiesModalsProps {
  depositTokens: (TokenType | null | undefined)[];
  withdrawTokens: TokenType[];
}

export interface OpportunitiesModalsState {
  // Deposit/Withdraw modal state
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  modalType: "deposit";
  setModalType: (type: "deposit") => void;
  amount: string;
  setAmount: (amount: string) => void;
  // Token selector modal state
  isTokenSelectorOpen: boolean;
  setIsTokenSelectorOpen: (open: boolean) => void;
  // Selected token state
  selectedToken: TokenType;
  setSelectedToken: (token: TokenType) => void;
}

const DEFAULT_DEPOSIT_TOKEN: TokenType = {
  symbol: "USDC",
  address: "0xusdc",
  decimals: 6,
  name: "USD Coin",
};

const DEFAULT_WITHDRAW_TOKEN: TokenType = {
  symbol: "ElitraUSDC",
  address: "0xusdc",
  decimals: 6,
  name: "Elitra USD Coin",
};

export function useOpportunitiesModals({
  depositTokens,
  withdrawTokens,
}: UseOpportunitiesModalsProps): OpportunitiesModalsState {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"deposit">("deposit");
  const [amount, setAmount] = useState("");
  const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false);

  const defaultToken =
    modalType === "deposit"
      ? (depositTokens[0] as TokenType | undefined) || DEFAULT_DEPOSIT_TOKEN
      : withdrawTokens[0] || DEFAULT_WITHDRAW_TOKEN;

  const [selectedToken, setSelectedToken] = useState<TokenType>(defaultToken);

  // When token lists change, update selectedToken if it is still at the
  // placeholder address (i.e. no real token was selected yet).
  useEffect(() => {
    if (depositTokens.length > 0 && selectedToken.address === "0xusdc") {
      const token =
        modalType === "deposit" ? depositTokens[0] : withdrawTokens[0];
      if (token) setSelectedToken(token as TokenType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositTokens, withdrawTokens]);
  // Note: selectedToken and modalType are intentionally omitted — this effect
  // should only run when token lists change (to pick a default), not on every
  // modalType change.

  return {
    isModalOpen,
    setIsModalOpen,
    modalType,
    setModalType,
    amount,
    setAmount,
    isTokenSelectorOpen,
    setIsTokenSelectorOpen,
    selectedToken,
    setSelectedToken,
  };
}
