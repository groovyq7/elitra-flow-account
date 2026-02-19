"use client";

import { useEffect, useState } from "react";
import type { Chain } from "viem";
import { UserPnlInfo, Vault } from "@/lib/types";
import { getUserVaultPositionFromSubgraph } from "@/lib/contracts/user-positions";
import { computePositionPnL } from "@/lib/utils/pnl";
import {
  getTokenBalance,
  getTokenPrice,
  getVaultRate,
} from "@/lib/utils/get-token-balance";
import { getVaultByIdWithSubgraph } from "@/lib/contracts/vault-registry";

interface UseVaultPageDataProps {
  /** The vault object returned by useVaultDetails. May be undefined while loading. */
  vault: Vault | undefined;
  /** The chain the vault lives on. */
  vaultChain: Chain;
  /** External wallet address (wagmi). */
  address: `0x${string}` | undefined;
  /** Embedded (SpiceFlow) wallet address. */
  embeddedWalletAddress: string | undefined | null;
  /** Whether any wallet is connected. */
  isConnected: boolean;
  /** Formatted total supply string from useTotalSupply. */
  formattedTotalSupply: string | undefined;
}

export interface UseVaultPageDataResult {
  /** Vault data enriched with live APY from the subgraph. */
  vaultData: Vault | undefined;
  /** Vault TVL in USD. */
  vaultTvl: number | undefined;
  /** Underlying token price in USD. */
  tokenPrice: number | undefined;
  /** Share ↔ underlying exchange rate. */
  tokenRate: number | undefined;
  /** Combined external + embedded wallet underlying token balance. */
  userBalance: { formatted: number } | undefined;
  /** Combined external + embedded wallet share balance. */
  userShareBalance: { formatted: number } | undefined;
  /** Combined PnL information for the user's position. */
  userPositionPnlInfo: UserPnlInfo | undefined;
}

export function useVaultPageData({
  vault,
  vaultChain,
  address,
  embeddedWalletAddress,
  isConnected,
  formattedTotalSupply,
}: UseVaultPageDataProps): UseVaultPageDataResult {
  // ─── Subgraph-enriched vault data (live APY) ────────────────────────────
  const [vaultData, setVaultData] = useState<Vault | undefined>();

  useEffect(() => {
    if (!vault) return;
    let cancelled = false;

    async function getVaultInfo() {
      if (!vault) return;
      const _vaultInfo = await getVaultByIdWithSubgraph(vault.id, vaultChain.id);
      if (!cancelled) setVaultData(_vaultInfo);
    }
    getVaultInfo();
    return () => {
      cancelled = true;
    };
  }, [vault, vaultChain.id]);

  // ─── Price / rate / user position ────────────────────────────────────────
  const [tokenPrice, setTokenPrice] = useState<number | undefined>();
  const [tokenRate, setTokenRate] = useState<number | undefined>();
  const [userBalance, setUserBalance] = useState<{ formatted: number } | undefined>();
  const [userShareBalance, setUserShareBalance] = useState<{ formatted: number } | undefined>();
  const [userPositionPnlInfo, setUserPositionPnlInfo] = useState<UserPnlInfo | undefined>();
  // Bump to force a PnL re-fetch when a deposit/withdraw completes.
  const [pnlRefreshKey, setPnlRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function getUserPnl() {
      if (!isConnected || !vault || !vault.id) return;

      const rateData = await getVaultRate(vault.symbol, vaultChain);
      const price = await getTokenPrice(vault.token0.symbol);
      if (cancelled) return;

      // ── External wallet ────────────────────────────────────────────────
      let externalPnl = {
        pnl: 0,
        pnlUSD: 0,
        deposited: 0,
        depositedUSD: 0,
        underlyingValue: 0,
        underlyingValueUSD: 0,
      };
      let externalBalance = { balance: BigInt(0), decimals: 18, formatted: "0" };
      let externalShareBalance = { formatted: 0 };

      if (address) {
        const { data } = await getUserVaultPositionFromSubgraph(
          address.toLowerCase(),
          vault.id
        );
        if (cancelled) return;
        const userPnlData = computePositionPnL({
          shareBalance: data?.currentShareBalance || BigInt(0),
          costBasis: data?.costBasis || BigInt(0),
          realizedPnL: data?.realizedPnL || BigInt(0),
          rate: rateData.rateRaw || BigInt(0),
          assetDecimals: 18,
        });
        externalPnl = {
          pnl: Number(userPnlData.unrealizedPnL),
          pnlUSD:
            Number(userPnlData.unrealizedPnL) < 0
              ? 0
              : Number(userPnlData.unrealizedPnL) * price.price,
          deposited: Number(userPnlData.costBasis),
          depositedUSD: Number(userPnlData.costBasis) * price.price,
          underlyingValue: Number(userPnlData.underlyingValue),
          underlyingValueUSD: Number(userPnlData.underlyingValue) * price.price,
        };
        externalBalance = await getTokenBalance(
          vault.token0.address,
          address,
          vaultChain
        );
        if (cancelled) return;
        const externalShareBalanceData = await getTokenBalance(
          vault.id,
          address,
          vaultChain
        );
        if (cancelled) return;
        externalShareBalance = {
          formatted: Number(externalShareBalanceData.formatted),
        };
      }

      // ── Embedded wallet ────────────────────────────────────────────────
      let embeddedPnl = {
        pnl: 0,
        pnlUSD: 0,
        deposited: 0,
        depositedUSD: 0,
        underlyingValue: 0,
        underlyingValueUSD: 0,
      };
      let embeddedBalance = { balance: BigInt(0), decimals: 18, formatted: "0" };
      let embeddedShareBalance = { formatted: 0 };

      if (embeddedWalletAddress) {
        const { data } = await getUserVaultPositionFromSubgraph(
          embeddedWalletAddress.toLowerCase(),
          vault.id
        );
        if (cancelled) return;
        const userPnlData = computePositionPnL({
          shareBalance: data?.currentShareBalance || BigInt(0),
          costBasis: data?.costBasis || BigInt(0),
          realizedPnL: data?.realizedPnL || BigInt(0),
          rate: rateData.rateRaw || BigInt(0),
          assetDecimals: 18,
        });
        embeddedPnl = {
          pnl: Number(userPnlData.unrealizedPnL),
          pnlUSD:
            Number(userPnlData.unrealizedPnL) < 0
              ? 0
              : Number(userPnlData.unrealizedPnL) * price.price,
          deposited: Number(userPnlData.costBasis),
          depositedUSD: Number(userPnlData.costBasis) * price.price,
          underlyingValue: Number(userPnlData.underlyingValue),
          underlyingValueUSD: Number(userPnlData.underlyingValue) * price.price,
        };
        embeddedBalance = await getTokenBalance(
          vault.token0.address,
          embeddedWalletAddress as `0x${string}`,
          vaultChain
        );
        if (cancelled) return;
        const embeddedShareBalanceData = await getTokenBalance(
          vault.id,
          embeddedWalletAddress as `0x${string}`,
          vaultChain
        );
        if (cancelled) return;
        embeddedShareBalance = {
          formatted: Number(embeddedShareBalanceData.formatted),
        };
      }

      // ── Combine ─────────────────────────────────────────────────────────
      const combinedPnl: UserPnlInfo = {
        pnl: externalPnl.pnl + embeddedPnl.pnl,
        pnlUSD: externalPnl.pnlUSD + embeddedPnl.pnlUSD,
        deposited: Number(externalPnl.deposited) + Number(embeddedPnl.deposited),
        depositedUSD: externalPnl.depositedUSD + embeddedPnl.depositedUSD,
        underlyingValue:
          Number(externalPnl.underlyingValue) +
          Number(embeddedPnl.underlyingValue),
        underlyingValueUSD:
          externalPnl.underlyingValueUSD + embeddedPnl.underlyingValueUSD,
      };

      if (!cancelled) {
        setUserBalance({
          formatted:
            Number(externalBalance.formatted) + Number(embeddedBalance.formatted),
        });
        setUserShareBalance({
          formatted:
            Number(externalShareBalance.formatted) +
            Number(embeddedShareBalance.formatted),
        });
        setUserPositionPnlInfo(combinedPnl);
        setTokenPrice(price.price);
        setTokenRate(Number(rateData.rate));
      }
    }

    getUserPnl();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, embeddedWalletAddress, vault?.id, pnlRefreshKey]);

  // Listen for deposit / withdraw completion events and bump the refresh key.
  useEffect(() => {
    const refresh = () => setPnlRefreshKey((k) => k + 1);
    window.addEventListener("vault-deposit-complete", refresh);
    window.addEventListener("crosschain-withdraw-complete", refresh);
    return () => {
      window.removeEventListener("vault-deposit-complete", refresh);
      window.removeEventListener("crosschain-withdraw-complete", refresh);
    };
  }, []);

  // ─── TVL ─────────────────────────────────────────────────────────────────
  const [vaultTvl, setVaultTvl] = useState<number | undefined>();

  useEffect(() => {
    if (!formattedTotalSupply || !tokenRate || !tokenPrice) return;
    setVaultTvl(
      Number(formattedTotalSupply) * Number(tokenRate) * Number(tokenPrice) || 0
    );
  }, [formattedTotalSupply, tokenRate, tokenPrice]);

  return {
    vaultData,
    vaultTvl,
    tokenPrice,
    tokenRate,
    userBalance,
    userShareBalance,
    userPositionPnlInfo,
  };
}
