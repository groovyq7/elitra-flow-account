import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  formatAPY,
  formatCurrency,
  formatPrice,
} from "../../../lib/utils/format";
import { useAccount, useConfig } from "wagmi";
import { useEffect, useState } from "react";
import { getUserVaultPositionFromSubgraph } from "@/lib/contracts/user-positions";
import { computePositionPnL } from "@/lib/utils/pnl";
import { getTokenPrice, getVaultRate } from "@/lib/utils/get-token-balance";
import { UserPnlInfo } from "@/lib/types";
import { trackModalOpen } from "@/lib/analytics";
import { useSpiceStore } from "@/store/useSpiceStore";

export function DepositedAssetsTable({
  tokenInfos,
  availableVaults,
  fullWidth = false,
  setSelectedToken,
  setModalType,
  setIsModalOpen,
}: {
  tokenInfos: any[];
  availableVaults: any[];
  fullWidth?: boolean;
  setSelectedToken: (token: any) => void;
  setModalType: (type: "deposit") => void;
  setIsModalOpen: (isOpen: boolean) => void;
}) {
  const { isConnected, address } = useAccount();
  const chain = useConfig().getClient().chain;
  const { openWithdraw } = useSpiceStore();

  // Defer wallet-dependent UI until after hydration to prevent SSR mismatch
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { setHasMounted(true); }, []);
  const clientConnected = hasMounted && isConnected;

  const [userPositionPnlInfo, setUserPositionPnlInfo] =
    useState<Record<string, UserPnlInfo>>();

  const [embeddedWalletAddress, setEmbeddedWalletAddress] = useState<string | undefined>(undefined);

  useEffect(() => {
    const stored = sessionStorage.getItem('embeddedWalletAddress');
    if (stored) {
      setEmbeddedWalletAddress(stored);
    }
  }, []);

  useEffect(() => {
    async function getUserPnl() {
      if (!isConnected || !address) return;

      const pnl: Record<string, UserPnlInfo> = {};
      for (const token of tokenInfos) {
        const [externalData, embeddedData] = await Promise.all([
          getUserVaultPositionFromSubgraph(address, token.token.address),
          embeddedWalletAddress
            ? getUserVaultPositionFromSubgraph(
              embeddedWalletAddress,
              token.token.address
            )
            : Promise.resolve({ data: null }),
        ]);

        const combinedShareBalance =
          (externalData?.data?.currentShareBalance || BigInt(0)) +
          (embeddedData?.data?.currentShareBalance || BigInt(0));
        const combinedCostBasis =
          (externalData?.data?.costBasis || BigInt(0)) +
          (embeddedData?.data?.costBasis || BigInt(0));
        const combinedRealizedPnL =
          (externalData?.data?.realizedPnL || BigInt(0)) +
          (embeddedData?.data?.realizedPnL || BigInt(0));

        const rateData = await getVaultRate(token.token.symbol, chain);

        const userPnlData = computePositionPnL({
          shareBalance: combinedShareBalance,
          costBasis: combinedCostBasis,
          realizedPnL: combinedRealizedPnL,
          rate: rateData.rateRaw || BigInt(0),
          assetDecimals: 18,
        });
        const price = await getTokenPrice(token.token.symbol);
        pnl[token.token.symbol] = {
          pnl: formatPrice(Number(userPnlData.unrealizedPnL)),
          pnlUSD: formatPrice(
            Number(userPnlData.unrealizedPnL) < 0
              ? 0
              : Number(userPnlData.unrealizedPnL) * price.price
          ),
          deposited: userPnlData.costBasis,
          depositedUSD: formatPrice(
            Number(userPnlData.costBasis) * price.price
          ),
          underlyingValue: userPnlData.underlyingValue,
          underlyingValueUSD: formatPrice(
            Number(userPnlData.underlyingValue) * price.price
          ),
        };
      }
      setUserPositionPnlInfo(pnl);
    }
    getUserPnl();
  }, [isConnected, address, embeddedWalletAddress, tokenInfos]);

  return (
    <div className="overflow-auto">
      <div
        className={
          fullWidth
            ? "overflow-auto w-full max-h-100"
            : "overflow-auto max-h-100"
        }
      >
        <table className={"min-w-[780px] lg:min-w-full text-sm"}>
          <thead>
            <tr className="text-xs text-muted-foreground border-b">
              <th className="py-2 px-2 font-medium text-left">Asset</th>
              <th className="py-2 px-2 font-medium text-right">Balance</th>
              <th className="py-2 px-2 font-medium text-right">APY</th>
              <th className="py-2 px-2 font-medium text-right">P&L (USD)</th>
              <th className="py-2 px-2 font-medium text-right"></th>
              <th className="py-2 px-2 font-medium text-right"></th>
            </tr>
          </thead>
          <tbody>
            {!clientConnected && (
              <tr>
                <td colSpan={5} className="py-4 text-left">
                  Please connect your wallet to estimate.
                </td>
              </tr>
            )}
            {tokenInfos
              .filter((token) => token.symbol?.toUpperCase().includes("WBTC") || token.symbol?.toUpperCase().includes("BTC") || token.symbol?.toUpperCase().includes("CBTC"))
              .map((token) => {
                const vault = availableVaults.find(
                  (v: any) => v.id === token.token.address
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
                      <div className="font-medium">
                        {formatPrice(token.available)} {token.symbol}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(token.availableUSD)}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className="font-semibold text-blue-600">
                        {formatAPY(token.apy)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className="font-semibold text-gray-700">
                        $
                        {userPositionPnlInfo &&
                          userPositionPnlInfo[token.token.symbol]
                          ? formatPrice(
                            userPositionPnlInfo[token.token.symbol].pnlUSD
                          )
                          : "0.00"}{" "}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <div className="font-medium flex gap-2 items-center justify-end">
                        <Button
                          className="rounded-md text-white text-xs font-semibold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 transition-all duration-200"
                          onClick={() => {
                            openWithdraw();
                            trackModalOpen("spicewithdraw", {
                              source: "deposited_table",
                              token: token.symbol,
                              to: "collateral",
                            });
                          }}
                        >
                          Withdraw
                        </Button>

                        <Link
                          href={`/vault/${token?.token.address}`}
                          className="bg-gray-100 hover:bg-gray-200 rounded-md p-2 px-3"
                        >
                          View
                        </Link>
                      </div>
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
