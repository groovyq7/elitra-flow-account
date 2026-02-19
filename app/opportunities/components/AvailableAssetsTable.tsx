import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Info, ArrowDownToLine } from "lucide-react";
import {
  formatAPY,
  formatCurrency,
  formatPrice,
} from "../../../lib/utils/format";
import { useAccount } from "wagmi";
import { trackModalOpen } from "@/lib/analytics";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useSpiceAssets,
  useEmbeddedWalletAddress,
} from "@spicenet-io/spiceflow-ui";
import { getTargetAddresses } from "@/lib/utils/chains";
import { useSpiceStore } from "@/store/useSpiceStore";
import { useSpiceFlowReady } from "@/hooks/usePrivySafe";
import { TokenInfo, Vault } from "@/lib/types";

const SUPPORTED_CHAINS = [11155111, 84532, 421614, 5115];

interface AvailableAssetsTableProps {
  tokenInfos: TokenInfo[];
  availableVaults: Vault[];
  fullWidth?: boolean;
}

/**
 * Shell — guards against calling SDK hooks (useSpiceAssets, useEmbeddedWalletAddress)
 * before the SpiceFlowProvider has mounted.  Renders null until ready.
 */
export function AvailableAssetsTable(props: AvailableAssetsTableProps) {
  const spiceFlowReady = useSpiceFlowReady();
  if (!spiceFlowReady) return null;
  return <AvailableAssetsTableInner {...props} />;
}

/** Inner component — safe to call SpiceFlow SDK hooks here. */
function AvailableAssetsTableInner({
  tokenInfos,
  availableVaults,
  fullWidth = false,
}: AvailableAssetsTableProps) {
  const { isConnected } = useAccount();
  const { openDeposit, openSupply, crossChainBalance } = useSpiceStore();

  // Defer wallet-dependent UI until after hydration to prevent SSR mismatch
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { setHasMounted(true); }, []);
  const clientConnected = hasMounted && isConnected;

  // Use the SDK hook — reflects live Privy state without sessionStorage race conditions
  const embeddedWalletAddress = useEmbeddedWalletAddress();
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const { assets, loading: assetsLoading, refetch } = useSpiceAssets({
    address: embeddedWalletAddress,
    supportedChains: SUPPORTED_CHAINS,
    enabled: !!embeddedWalletAddress,
    refetchInterval: 60000,
  });

  useEffect(() => {
    const handleBalanceChange = () => {
      setTimeout(() => {
        refetch?.();
      }, 500);
    };

    window.addEventListener('cross-chain-deposit-completed', handleBalanceChange);
    window.addEventListener('deposit-completed', handleBalanceChange);
    window.addEventListener('withdraw-completed', handleBalanceChange);
    return () => {
      window.removeEventListener('cross-chain-deposit-completed', handleBalanceChange);
      window.removeEventListener('deposit-completed', handleBalanceChange);
      window.removeEventListener('withdraw-completed', handleBalanceChange);
    };
  }, [refetch]);

  const getCrossChainBalance = (tokenSymbol: string) => {
    // Also get target addresses for WCBTC if tokenSymbol is CBTC
    let targetAddresses = getTargetAddresses(tokenSymbol);
    if (tokenSymbol === "CBTC") {
      targetAddresses = [...targetAddresses, ...getTargetAddresses("WCBTC")];
    }

    return assets
      .filter((asset) => targetAddresses.includes(asset.address.toLowerCase()))
      .reduce((sum, asset) => sum + asset.balanceFormatted, 0) || 0;
  };

  return (
    <div className="overflow-auto">
      <div
        className={
          fullWidth
            ? "overflow-auto w-full max-h-100"
            : "overflow-auto max-h-100"
        }
      >
        <table
          className={`min-w-[780px] text-sm ${fullWidth ? "lg:min-w-full" : "xl:min-w-full"
            }`}
        >
          <thead>
            <tr className="text-xs text-muted-foreground border-b">
              <th className="py-2 px-2 font-medium text-left">Asset</th>
              <th className="py-2 px-2 font-medium text-right">Available</th>
              <th className="py-2 px-2 font-medium text-right">APY</th>
              <th className="py-2 px-2 font-medium text-right">
                Est. Yearly Reward
              </th>
              <th className="py-2 px-2 font-medium text-right"></th>
            </tr>
          </thead>
          <tbody>
            {!clientConnected && (
              <tr>
                <td
                  colSpan={5}
                  className="font-medium py-4 text-left text-xs text-muted-foreground"
                >
                  Please connect your wallet to estimate.
                </td>
              </tr>
            )}
            {tokenInfos
              .filter((token) => token.symbol?.toUpperCase().includes("WBTC") || token.symbol?.toUpperCase().includes("BTC"))
              .map((token) => {
                const vault = availableVaults.find(
                  (v: Vault) =>
                    v.token0?.symbol === token.symbol ||
                    v.token1?.symbol === token.symbol
                );
                return (
                  <tr key={token.symbol} className="border-b last:border-0">
                    <td className="py-2 px-2 flex items-center gap-2">
                      <Image
                        src={token.icon || "/placeholder.svg"}
                        alt={token.symbol}
                        width={28}
                        height={28}
                        className="rounded-full"
                      />
                      <span className="font-semibold">{token.symbol}</span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <div className="font-medium flex items-center justify-end gap-1">
                        {formatPrice(token.available + getCrossChainBalance(token.symbol))} {token.symbol}
                        <DropdownMenu open={openDropdownId === token.symbol} onOpenChange={(open) => setOpenDropdownId(open ? token.symbol : null)}>
                          <DropdownMenuTrigger asChild>
                            <button
                              onMouseEnter={() => setOpenDropdownId(token.symbol)}
                              onMouseLeave={() => setOpenDropdownId(null)}
                              aria-label={`Balance breakdown for ${token.symbol}`}
                              className="hover:bg-gray-100 rounded p-0.5 transition-colors">
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-52"
                            onMouseEnter={() => setOpenDropdownId(token.symbol)}
                            onMouseLeave={() => setOpenDropdownId(null)}>
                            <div className="px-3 py-2 text-xs space-y-1.5">
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Elitra Account:</span>
                                <span className="font-medium">
                                  {assetsLoading && assets.length === 0
                                    ? "..."
                                    : formatPrice(getCrossChainBalance(token.symbol))}{" "}
                                  {token.symbol}
                                </span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Citrea:</span>
                                <span className="font-medium">
                                  {formatPrice(token.available)} {token.symbol}
                                </span>
                              </div>
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(token.availableUSD + getCrossChainBalance(token.symbol) * token.price)}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className="font-semibold text-blue-600">
                        {formatAPY(token.apy)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <div className="font-medium">
                        {formatCurrency(token.yearlyRewardUSD)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatPrice(token.yearlyReward)} {token.symbol}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right">
                      {vault && clientConnected && (
                        <div className="font-medium flex gap-2 items-center justify-end">
                          <Button
                            className="rounded-md text-white text-xs font-semibold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 transition-all duration-200 flex items-center gap-1"
                            onClick={() => {
                              openDeposit();
                              trackModalOpen("deposit_to_account", {
                                source: "available_table",
                                token: token.symbol,
                              });
                            }}
                          >
                            Deposit
                          </Button>

                          {crossChainBalance > 0 && (
                            <Button
                              className="rounded-md text-white text-xs font-semibold bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 transition-all duration-200 flex items-center gap-1"
                              onClick={() => {
                                // Prefer wrapped ERC-20 address (e.g. WCBTC) over
                                // native token address (zeroAddress for CBTC)
                                const depositAddress =
                                  token.token.wrapped?.address ??
                                  token.token.wrappedAddress ??
                                  token.token.address;
                                const depositSymbol =
                                  token.token.wrapped?.symbol ?? token.symbol;
                                const depositDecimals =
                                  token.token.wrapped?.decimals ?? token.token.decimals;
                                openSupply({
                                  address: depositAddress,
                                  symbol: depositSymbol,
                                  decimals: depositDecimals,
                                });
                                trackModalOpen("gasless_supply", {
                                  source: "available_table",
                                  token: token.symbol,
                                });
                              }}
                            >
                              <ArrowDownToLine className="h-3 w-3" />
                              Supply
                            </Button>
                          )}

                          <Link
                            href={`/vault/${vault.id}`}
                            className="bg-gray-100 hover:bg-gray-200 rounded-md p-2 px-3"
                          >
                            View
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
