"use client";

import React from "react";
import {
  useSpiceStore,
  type DepositRecord,
} from "@/store/useSpiceStore";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Zap,
  Shield,
  Globe,
} from "lucide-react";

const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const DepositRow: React.FC<{ record: DepositRecord }> = ({ record }) => (
  <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
        <span className="text-xs font-bold text-primary">
          {record.asset.charAt(0)}
        </span>
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">
          {record.amount} {record.asset}
        </p>
        <p className="text-xs text-muted-foreground">
          from {record.sourceChain}
        </p>
      </div>
    </div>
    <span className="text-xs text-muted-foreground whitespace-nowrap">
      {formatTimeAgo(record.timestamp)}
    </span>
  </div>
);

const FeatureItem: React.FC<{
  icon: React.ReactNode;
  text: string;
}> = ({ icon, text }) => (
  <div className="flex items-start gap-2">
    <div className="mt-0.5 text-primary flex-shrink-0">{icon}</div>
    <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
  </div>
);

export const CrossChainAccountPopup: React.FC = () => {
  const {
    crossChainBalance,
    depositHistory,
    openDeposit,
    openWithdraw,
    closeAccountPopup,
  } = useSpiceStore();

  const hasDeposits = depositHistory.length > 0;

  const handleDeposit = () => {
    // Open deposit first, then close popup on next tick to avoid
    // the popup unmounting before the click event completes
    openDeposit();
    setTimeout(() => closeAccountPopup(), 0);
  };

  const handleWithdraw = () => {
    openWithdraw();
    setTimeout(() => closeAccountPopup(), 0);
  };

  return (
    // Outer wrapper provides the positioning context for the arrow caret.
    // overflow-hidden is intentionally NOT on this wrapper — it would clip the
    // arrow which is positioned at -top-[6px] (above the card boundary).
    <div className="relative w-[340px]">
      {/* Arrow caret — sits outside the overflow-hidden card so it isn't clipped */}
      <div className="absolute -top-[6px] right-6 z-10">
        <div className="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[7px] border-b-border" />
        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-background absolute -bottom-[6px] left-1/2 -translate-x-1/2" />
      </div>

      {/* Card — overflow-hidden here for rounded corners, arrow is safely outside */}
      <div className="bg-background border border-border rounded-xl shadow-2xl shadow-black/50 overflow-hidden">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-foreground">
            Elitra Account
          </h3>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-[10px] font-medium text-primary">
              Active
            </span>
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground">
          {crossChainBalance > 0
            ? `$${crossChainBalance.toFixed(2)}`
            : "$0.00"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Elitra Account balance
        </p>
      </div>

      {/* Feature explainer */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <p className="text-xs font-medium text-accent mb-2">How it works</p>
        <div className="space-y-2">
          <FeatureItem
            icon={<Globe className="w-3.5 h-3.5" />}
            text="Fund your Elitra Account from any supported chain — Sepolia, Base Sepolia, or Citrea Testnet."
          />
          <FeatureItem
            icon={<Zap className="w-3.5 h-3.5" />}
            text="Once funded, supply to vaults gas-free and asset-abstracted on Elitra."
          />
          <FeatureItem
            icon={<Shield className="w-3.5 h-3.5" />}
            text="Deposit into yield vaults and manage positions — all without bridging or managing gas on Citrea."
          />
        </div>
      </div>

      {/* Deposit history or empty state */}
      <div className="px-4 py-3">
        {hasDeposits ? (
          <>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Recent Deposits
            </p>
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
              {depositHistory.slice(0, 10).map((record) => (
                <DepositRow key={record.id} record={record} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-2">
              <ArrowDownToLine className="w-5 h-5 text-primary/60" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              No deposits yet
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-[240px] mx-auto">
              Deposit to your Elitra Account to start earning yield.
            </p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-4 flex gap-2">
        <button
          onClick={handleDeposit}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg text-sm transition-colors"
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          Deposit
        </button>
        <button
          onClick={handleWithdraw}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg text-sm transition-colors border border-border"
        >
          <ArrowUpFromLine className="w-3.5 h-3.5" />
          Withdraw
        </button>
      </div>
      </div>{/* end overflow-hidden card */}
    </div>
  );
};
