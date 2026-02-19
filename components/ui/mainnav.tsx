"use client";

import Image from "next/image";
import { WalletConnectButton } from "../wallet/wallet-connect-button";
import { ChainStatus } from "../wallet/chain-status";
import { Badge } from "./badge";
import { formatTVL } from "@/lib/utils/format";
import { useVaultList } from "@/hooks/use-vault-data";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useConfig } from "wagmi";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { Copy } from "lucide-react";
import {
  getTokenPrice,
  getTokenSupply,
  getVaultRate,
} from "@/lib/utils/get-token-balance";
import { Button } from "./button";
import { toast } from "@/hooks/use-toast";
import { CrossChainAccountBadge } from "../SpiceFlow/CrossChainAccountBadge";
import { useSpiceFlowReady } from "@/hooks/usePrivySafe";

/**
 * Privy-dependent nav items — only rendered after SpiceFlowProvider
 * has mounted its internal PrivyProvider (avoids SSR warnings).
 */
function PrivyNavItems() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = wallets.find((w) => w.connectorType === "embedded");
  const embeddedWalletAddress = embeddedWallet?.address;

  return (
    <>
      {authenticated && embeddedWalletAddress && (
        <div className="relative group">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5 text-xs font-medium"
            onClick={() => {
              navigator.clipboard.writeText(embeddedWalletAddress);
              toast({
                title: "Embedded Wallet Address copied!",
              });
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy Embedded Wallet Address
          </Button>
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-50">
            Copy this address and paste it into the portal task submission to mark your task completion.
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900" />
          </div>
        </div>
      )}
    </>
  );
}

export default function MainNav() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const isSpiceFlowReady = useSpiceFlowReady();

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setIsDarkMode(isDark);
  }, []);

  const { data: vaults } = useVaultList();
  const chain = useConfig().getClient().chain;
  const [isTvlLoading, setIsTvlLoading] = useState(true);
  const isHome = false;

  const [vaultData, setVaultData] = useState<
    { id: string; tvl: number; rate: number; price: number }[]
  >([]);

  useEffect(() => {
    let cancelled = false;

    async function getVaultsTVL() {
      if (!vaults || vaults.length === 0) return;
      setIsTvlLoading(true);
      try {
        const _vaultData = await Promise.all(
          vaults.map(async (vault) => {
            const supply = await getTokenSupply(vault.id || "", chain);
            const rate = await getVaultRate(vault.symbol, chain);
            const price = await getTokenPrice(vault.token0?.symbol || "");
            const tvl =
              Number(supply.formatted) *
              Number(rate.rate) *
              Number(price.price);
            return {
              id: vault.id,
              tvl: tvl,
              rate: Number(rate.rate),
              price: Number(price.price),
            };
          })
        );
        if (!cancelled) setVaultData(_vaultData);
      } catch {
        // Error silently ignored (TVL fetch is best-effort)
      } finally {
        if (!cancelled) setIsTvlLoading(false);
      }
    }
    // initial fetch
    getVaultsTVL();
    // poll every 60s
    const intervalId = setInterval(() => {
      getVaultsTVL();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [vaults, chain?.id]);




  return (
    <nav
      className={`${isHome
          ? "bg-transparent absolute w-full"
          : "bg-background border-b border-border"
        } py-3`}
    >
      <div className="lg:container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <div className="flex items-center">
                <Image
                  key={isDarkMode ? "dark-logo" : "light-logo"}
                  src={"/images/elitra-logo.png"}
                  alt="Elitra"
                  width={40}
                  height={40}
                  className="h-10 w-auto"
                />
              </div>
            </Link>

            <div className="hidden md:flex items-center space-x-6">
              {/* <Link
                href="/opportunities"
                className={`text-md font-medium transition-colors hover:text-primary font-bold ${
                  pathname === "/opportunities" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                App
              </Link> */}
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex-1 flex justify-center hidden md:flex">
              <div className="text-gray-600 p-2 px-3 text-sm font-semibold rounded-sm flex gap-2 items-center shadow-lg">
                TOTAL TVL:{" "}
                {isTvlLoading ? (
                  <div className="w-12 h-4 bg-gray-200 animate-pulse" />
                ) : (
                  formatTVL(vaultData.reduce((acc, v) => acc + v.tvl, 0))
                )}
                {chain?.testnet && (
                  <Badge
                    variant="default"
                    className="ml-2 bg-gray-100 text-gray-800"
                  >
                    Testnet
                  </Badge>
                )}
              </div>
            </div>

            <CrossChainAccountBadge />

            {isSpiceFlowReady && <PrivyNavItems />}

            <ChainStatus />
            <WalletConnectButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
