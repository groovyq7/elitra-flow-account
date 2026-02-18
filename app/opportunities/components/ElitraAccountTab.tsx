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
import { Button } from "@/components/ui/button";

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

export function ElitraAccountTab() {
  const {
    crossChainBalance,
    depositHistory,
    openDeposit,
    openWithdraw,
    openSupply,
  } = useSpiceStore();

  const hasDeposits = depositHistory.length > 0;

  return (
    <div className="space-y-6 py-2">
      {/* Balance Section */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">
            Elitra Account Balance
          </p>
          <p className="text-3xl font-bold text-foreground">
            {crossChainBalance > 0
              ? `$${crossChainBalance.toFixed(2)}`
              : "$0.00"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-xs font-medium text-primary">Active</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={openDeposit}
          className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold text-sm flex items-center justify-center gap-2"
        >
          <ArrowDownToLine className="w-4 h-4" />
          Deposit
        </Button>
        <Button
          onClick={openWithdraw}
          variant="outline"
          className="flex-1 font-semibold text-sm flex items-center justify-center gap-2"
        >
          <ArrowUpFromLine className="w-4 h-4" />
          Withdraw
        </Button>
        {crossChainBalance > 0 && (
          <Button
            onClick={() =>
              openSupply({
                // Default to WCBTC — the primary vault deposit token on Citrea Testnet.
                // openSupply() requires a non-null asset or SupplyViaSpiceFlow won't render.
                address: "0x8d0c9d1c17aE5e40ffF9bE350f57840E9E66Cd93",
                symbol: "WCBTC",
                decimals: 18,
              })
            }
            className="flex-1 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Supply to Vault
          </Button>
        )}
      </div>

      {/* How it works */}
      <div className="rounded-lg bg-muted/30 border border-border p-4">
        <p className="text-xs font-medium text-accent mb-3">How it works</p>
        <div className="space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 text-primary flex-shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Step 1: Deposit</span> — Fund your Elitra Account from any supported chain. No Privy wallet needed.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 text-primary flex-shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Step 2: Supply to Vault</span> — Once funded, supply to yield vaults gas-free with a single click.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 text-primary flex-shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Withdraw anytime</span> — Pull funds back to your Elitra Account or external wallet on any chain.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Deposits */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Recent Activity
        </p>
        {hasDeposits ? (
          <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
            {depositHistory.slice(0, 15).map((record) => (
              <DepositRow key={record.id} record={record} />
            ))}
          </div>
        ) : (
          <div className="text-center py-6 rounded-lg bg-muted/20 border border-border">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-2">
              <ArrowDownToLine className="w-5 h-5 text-primary/60" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              No deposits yet
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
              Deposit to your Elitra Account from any chain to start earning yield on your assets.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
