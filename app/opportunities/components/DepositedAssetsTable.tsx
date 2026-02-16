import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  setModalType: (type: "deposit" | "spicedeposit" | "spicewithdraw-collateral" | "spicewithdraw-external") => void;
  setIsModalOpen: (isOpen: boolean) => void;
}) {
  const { isConnected, address } = useAccount();
  const chain = useConfig().getClient().chain;
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
    console.log("Token infos updated:", tokenInfos);
    async function getUserPnl() {
      if (!isConnected || !address) return;

      const pnl: Record<string, UserPnlInfo> = {};
      for (const token of tokenInfos) {
        const { data } = await getUserVaultPositionFromSubgraph(
          address,
          token.token.address
        );

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

        const rateData = await getVaultRate(token.token.symbol, chain);

        const userPnlData = computePositionPnL({
          shareBalance: data?.currentShareBalance || BigInt(0),
          costBasis: data?.costBasis || BigInt(0),
          realizedPnL: data?.realizedPnL || BigInt(0),
          rate: rateData.rateRaw || BigInt(0),
          assetDecimals: 18,
        });
        console.log(`Computed PnL for ${token.token.symbol}:`, userPnlData);
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
  }, [isConnected, address, tokenInfos]);

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
            {!isConnected && (
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button className="rounded-md text-white text-xs font-semibold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 transition-all duration-200 flex items-center gap-1">
                              Withdraw
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem
                              onClick={() => {
                                setModalType("spicewithdraw-collateral");
                                setSelectedToken(token.token);
                                setIsModalOpen(true);
                                trackModalOpen("spicewithdraw", {
                                  source: "deposited_table",
                                  token: token.symbol,
                                  to: "collateral",
                                });
                              }}
                              className="cursor-pointer py-2.5 px-4 text-sm"
                            >
                              Keep on Elitra
                            </DropdownMenuItem>
                            {/* <DropdownMenuItem
                              onClick={() => {
                                setModalType("spicewithdraw-external");
                                setSelectedToken(token.token);
                                setIsModalOpen(true);
                                trackModalOpen("spicewithdraw", {
                                  source: "deposited_table",
                                  token: token.symbol,
                                  to: "external",
                                });
                              }}
                              className="cursor-pointer py-2.5 px-4 text-sm"
                            >
                              To external wallet
                            </DropdownMenuItem> */}
                          </DropdownMenuContent>
                        </DropdownMenu>

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
