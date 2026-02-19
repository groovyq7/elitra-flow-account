"use client";

import React, { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSpiceStore } from "@/store/useSpiceStore";
import { CrossChainAccountPopup } from "./CrossChainAccountPopup";
import { formatCurrency } from "@/lib/utils/format";

export const CrossChainAccountBadge: React.FC = () => {
  const {
    crossChainBalance,
    isAccountPopupOpen,
    toggleAccountPopup,
    closeAccountPopup,
  } = useSpiceStore();
  const badgeRef = useRef<HTMLButtonElement>(null);
  const [popupPosition, setPopupPosition] = useState({ top: 0, right: 0 });
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (!isAccountPopupOpen) return;

    const handleUpdate = () => {
      if (badgeRef.current) {
        const rect = badgeRef.current.getBoundingClientRect();
        setPopupPosition({
          top: rect.bottom + 8,
          right: window.innerWidth - rect.right,
        });
      }
    };

    handleUpdate();
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);

    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [isAccountPopupOpen]);

  // Click-outside to close
  useEffect(() => {
    if (!isAccountPopupOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (badgeRef.current?.contains(target)) return;
      const popupEl = document.getElementById("cross-chain-account-popup");
      if (popupEl?.contains(target)) return;
      closeAccountPopup();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAccountPopupOpen, closeAccountPopup]);

  // ESC key to close
  useEffect(() => {
    if (!isAccountPopupOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAccountPopup();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isAccountPopupOpen, closeAccountPopup]);

  // Lock body scroll while popup is open
  useEffect(() => {
    if (!isAccountPopupOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isAccountPopupOpen]);

  const hasBalance = crossChainBalance > 0;

  return (
    <>
      <button
        ref={badgeRef}
        onClick={toggleAccountPopup}
        aria-label={`Elitra Account${hasBalance ? ` — balance ${formatCurrency(crossChainBalance)}` : ""} — ${isAccountPopupOpen ? "close" : "open"} account panel`}
        aria-expanded={isAccountPopupOpen}
        aria-haspopup="true"
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium
          transition-all duration-200 border
          ${
            isAccountPopupOpen
              ? "bg-primary/20 border-primary/50 text-primary"
              : hasBalance
              ? "bg-primary/10 border-primary/30 text-foreground hover:bg-primary/20 hover:border-primary/40"
              : "bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          }
        `}
      >
        {/* Elitra icon — layered circles */}
        <div className="relative w-4 h-4 flex-shrink-0">
          <div
            className={`absolute inset-0 rounded-full ${
              hasBalance ? "bg-primary/40" : "bg-muted-foreground/30"
            }`}
          />
          <div
            className={`absolute inset-[3px] rounded-full ${
              hasBalance ? "bg-primary" : "bg-muted-foreground/60"
            }`}
          />
          {hasBalance && (
            <div className="absolute inset-[3px] rounded-full bg-primary animate-ping opacity-30" />
          )}
        </div>

        {/* Label + balance */}
        <span className="whitespace-nowrap">
          Elitra Account
          {hasBalance ? ` · ${formatCurrency(crossChainBalance)}` : ""}
        </span>

        {/* Expand caret */}
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${
            isAccountPopupOpen ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Popup via portal */}
      {isAccountPopupOpen && isMounted &&
        createPortal(
          <div
            id="cross-chain-account-popup"
            className="fixed z-[9999]"
            style={{
              top: popupPosition.top,
              right: popupPosition.right,
            }}
          >
            <CrossChainAccountPopup />
          </div>,
          document.body
        )}
    </>
  );
};
