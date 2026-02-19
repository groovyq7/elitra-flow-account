"use client";

import { useEffect, useState } from "react";
import type { Chain } from "viem";
import { TokenInfo, TokenType, Vault } from "@/lib/types";
import { fetchTokenInfos, mergeTokenInfos } from "@/lib/fetchTokenInfos";
import { OFFICIAL_TOKENS, VAULT_TOKENS } from "@/lib/constants";

export interface PortfolioData {
  totalBalance: number;
  eligibleToEarn: number;
  estimatedRewards: number;
  estimatedActiveRewards: number;
  monthlyRewards: number;
  depositedAmountUSD: number;
}

interface UsePortfolioDataProps {
  /** Tokens available for deposit, used to determine "eligible to earn". */
  depositTokens: (TokenType | null | undefined)[];
  /** Connected external wallet address. */
  address: `0x${string}` | undefined;
  /** Embedded (SpiceFlow) wallet address. */
  embeddedWalletAddress: string | undefined | null;
  /** Currently connected chain. */
  chain: Chain | undefined;
  /** Citrea viem chain (fallback / secondary chain). */
  citreaChain: Chain | undefined;
  /**
   * Vault data from subgraph.  Passed in from the page so the effect can
   * re-run when `vaultsData` changes (e.g. after a deposit / withdrawal).
   */
  vaultsData: Vault[] | undefined;
  /**
   * When the deposit modal closes the page should refresh balances.
   * Including `isModalOpen` in deps achieves this — same behaviour as the
   * original page component.
   */
  isModalOpen: boolean;
}

export interface UsePortfolioDataResult {
  tokenInfos: TokenInfo[];
  vaultTokenInfos: TokenInfo[];
  portfolioData: PortfolioData | null;
  isLoading: boolean;
}

export function usePortfolioData({
  depositTokens,
  address,
  embeddedWalletAddress,
  chain,
  citreaChain,
  vaultsData,
  isModalOpen,
}: UsePortfolioDataProps): UsePortfolioDataResult {
  const [tokenInfos, setTokenInfos] = useState<TokenInfo[]>([]);
  const [vaultTokenInfos, setVaultTokenInfos] = useState<TokenInfo[]>([]);
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const getTokenInfos = async () => {
      if (!depositTokens.length || !address || !chain) {
        setTokenInfos([]);
        setPortfolioData(null);
        return;
      }

      setIsLoading(true);
      try {
        const currentTokens = OFFICIAL_TOKENS[chain.id] || [];
        const citreaTokens = OFFICIAL_TOKENS[5115] || [];
        const tokensByChain =
          chain.id === 5115
            ? [{ tokens: currentTokens, chain }]
            : [
                { tokens: currentTokens, chain },
                ...(citreaChain
                  ? [{ tokens: citreaTokens, chain: citreaChain }]
                  : []),
              ];

        const [externalTokenInfos, embeddedTokenInfos] = await Promise.all([
          Promise.all(
            tokensByChain.map(({ tokens, chain: tokenChain }) =>
              fetchTokenInfos(tokens, address, tokenChain, vaultsData)
            )
          ).then((results) => results.flat()),
          embeddedWalletAddress
            ? Promise.all(
                tokensByChain.map(({ tokens, chain: tokenChain }) =>
                  fetchTokenInfos(
                    tokens,
                    embeddedWalletAddress as `0x${string}`,
                    tokenChain,
                    vaultsData
                  )
                )
              ).then((results) => results.flat())
            : Promise.resolve([]),
        ]);

        // Merge the token infos from both wallets
        const combinedTokenInfoData = mergeTokenInfos(
          externalTokenInfos,
          embeddedTokenInfos
        );

        // Fetch vault token infos for BOTH wallets (external + embedded)
        const vaultTokens = VAULT_TOKENS[5115] || [];
        const vaultChain = citreaChain || chain;
        const [externalVaultData, embeddedVaultData] = await Promise.all([
          fetchTokenInfos(vaultTokens, address, vaultChain, vaultsData),
          embeddedWalletAddress
            ? fetchTokenInfos(
                vaultTokens,
                embeddedWalletAddress as `0x${string}`,
                vaultChain,
                vaultsData
              )
            : Promise.resolve([]),
        ]);

        // Merge the vault token infos from both wallets
        const combinedVaultTokenInfoData = mergeTokenInfos(
          externalVaultData,
          embeddedVaultData
        );

        if (!cancelled) {
          setTokenInfos(combinedTokenInfoData);
          setVaultTokenInfos(combinedVaultTokenInfoData);

          const depositAddresses = depositTokens
            .flatMap((t) => t?.address)
            .filter(Boolean);

          const _portfolioData: PortfolioData = {
            totalBalance: combinedTokenInfoData.reduce(
              (sum, token) => sum + token.availableUSD,
              0
            ),
            eligibleToEarn: combinedTokenInfoData.reduce(
              (sum, token) =>
                depositAddresses.includes(token.token.address)
                  ? sum + token.availableUSD
                  : sum,
              0
            ),
            estimatedRewards: combinedTokenInfoData.reduce(
              (sum, token) =>
                depositAddresses.includes(token.token.address)
                  ? sum + token.yearlyRewardUSD
                  : sum,
              0
            ),
            estimatedActiveRewards: combinedVaultTokenInfoData.reduce(
              (sum, token) => sum + token.yearlyRewardUSD,
              0
            ),
            monthlyRewards: combinedTokenInfoData.reduce(
              (sum, token) =>
                depositAddresses.includes(token.token.address)
                  ? sum + token.yearlyRewardUSD / 12
                  : sum,
              0
            ),
            depositedAmountUSD: combinedVaultTokenInfoData.reduce(
              (sum, token) => sum + token.availableUSD,
              0
            ),
          };

          setPortfolioData(_portfolioData);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    // Run once on mount / when deps change
    getTokenInfos();

    // Re-run when user comes back to the tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        getTokenInfos();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    depositTokens,
    address,
    embeddedWalletAddress,
    chain,
    isModalOpen,
    vaultsData,
    citreaChain,
  ]);

  return { tokenInfos, vaultTokenInfos, portfolioData, isLoading };
}
