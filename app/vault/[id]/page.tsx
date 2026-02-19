"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount, useConfig } from "wagmi";
import { useVaultDetails } from "@/hooks/use-vault-data";
import { useTotalSupply } from "@/hooks/use-vault-transactions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VaultBreakdownChart } from "@/app/vault/[id]/components/vault-breakdown-chart";
import {
  formatAPY,
  formatPrice,
  formatSharePrice,
  shortenAddress,
} from "@/lib/utils/format";
import { Coins, ArrowLeft } from "lucide-react";
import Image from "next/image";
import { getTokenImage } from "@/lib/utils";
import { ApyChart } from "./components/ApyChart";
import { KeyMetricsCard } from "./components/KeyMetricsCard";
import { DepositModal } from "@/app/opportunities/components/DepositModal";
import { TokenSelectorModal } from "@/app/opportunities/components/TokenSelectorModal";
import { WithdrawModal } from "@/app/opportunities/components/WithdrawModal";
import { Badge } from "@/components/ui/badge";
import { UserPnlInfo, TokenType, Vault } from "@/lib/types";
import { getUserVaultPositionFromSubgraph } from "@/lib/contracts/user-positions";
import { computePositionPnL } from "@/lib/utils/pnl";
import { getTokenBalance, getTokenPrice, getVaultRate } from "@/lib/utils/get-token-balance";
import { getVaultByIdWithSubgraph } from "@/lib/contracts/vault-registry";
import { GrowthChart } from "@/app/opportunities/components/GrowthChart";
import { ArrowDownToLine } from "lucide-react";
import { useSpiceStore } from "@/store/useSpiceStore";
import { useEmbeddedWalletAddress } from "@spicenet-io/spiceflow-ui";

export default function VaultDetailsPage() {
  const params = useParams();
  const chain = useConfig().getClient().chain;
  const vaultId = params.id as string;
  // Use the SDK hook instead of sessionStorage — this correctly reflects the
  // live Privy embedded wallet state without requiring the opportunities page
  // to have been visited first.
  const embeddedWalletAddress = useEmbeddedWalletAddress();
  const { address, isConnected } = useAccount();
  const { chains } = useConfig();
  const { openDeposit, openSupply, openWithdraw, crossChainBalance } = useSpiceStore();
  // isModalOpen / modalType are kept for the legacy DepositModal / WithdrawModal
  // that are conditionally rendered below (never shown because openDeposit /
  // openWithdraw go through the SpiceFlow global modals, but kept to avoid
  // breaking the TokenSelectorModal prop chain).
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false);
  const { data: vault, isLoading: vaultLoading } = useVaultDetails(vaultId);
  const vaultChain = vault?.chainId ? chains.find(c => c.id === vault.chainId) || chain : chain;

  const [selectedToken, setSelectedToken] = useState<TokenType | undefined>();
  const [tokenPrice, setTokenPrice] = useState<number | undefined>();
  const [tokenRate, setTokenRate] = useState<number | undefined>();
  const [vaultTvl, setVaultTvl] = useState<number | undefined>();
  const [vaultData, setVaultData] = useState<Vault | undefined>();
  const [userBalance, setUserBalance] = useState<{ formatted: number } | undefined>();

  const { totalSupply, formattedTotalSupply } = useTotalSupply(vaultId);
  const [investmentAmount, setInvestmentAmount] = useState("1000");
  const [returns, setReturns] = useState({ annual: 0, monthly: 0, fiveYear: 0 });
  const [userShareBalance, setUserShareBalance] = useState<{ formatted: number } | undefined>();

  const [chartTimeframe, setChartTimeframe] = useState<
    "30d" | "6m" | "1y" | "3y"
  >("3y");

  const calculateReturns = (amount: string, apy: number) => {
    const principal = Number.parseFloat(amount) || 0;
    const annualReturn = (principal * apy) / 100;
    const monthlyReturn = annualReturn / 12;
    const fiveYearGrowth = principal * Math.pow(1 + apy / 100, 5) - principal;

    return {
      annual: annualReturn,
      monthly: monthlyReturn,
      fiveYear: fiveYearGrowth,
    };
  };

  const calculateInvestment = () => {
    const returns = vault
      ? calculateReturns(investmentAmount, Number(vaultData?.apy || vault.apy) || 0)
      : { annual: 0, monthly: 0, fiveYear: 0 };
    setReturns(returns);
  }

  const [userPositionPnlInfo, setUserPositionPnlInfo] = useState<UserPnlInfo>();
  // Bump counter to force PnL re-fetch on deposit/withdraw events
  const [pnlRefreshKey, setPnlRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function getUserPnl() {
      if (!isConnected || !vault || !vault?.id) return;

      const rateData = await getVaultRate(vault?.symbol, vaultChain);
      const price = await getTokenPrice(vault?.token0.symbol);
      if (cancelled) return;

      // Fetch for external wallet
      let externalPnl = { pnl: 0, pnlUSD: 0, deposited: 0, depositedUSD: 0, underlyingValue: 0, underlyingValueUSD: 0 };
      let externalBalance = { balance: BigInt(0), decimals: 18, formatted: "0" };
      let externalShareBalance = { formatted: 0 };

      if (address) {
        const { data } = await getUserVaultPositionFromSubgraph(address.toLowerCase(), vault?.id);
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
          pnlUSD: Number(userPnlData.unrealizedPnL) < 0 ? 0 : Number(userPnlData.unrealizedPnL) * price.price,
          deposited: Number(userPnlData.costBasis),
          depositedUSD: Number(userPnlData.costBasis) * price.price,
          underlyingValue: Number(userPnlData.underlyingValue),
          underlyingValueUSD: Number(userPnlData.underlyingValue) * price.price,
        };
        externalBalance = await getTokenBalance(vault.token0.address, address, vaultChain);
        if (cancelled) return;
        const externalShareBalanceData = await getTokenBalance(vault.id, address, vaultChain);
        if (cancelled) return;
        externalShareBalance = { formatted: Number(externalShareBalanceData.formatted) };
      }

      let embeddedPnl = { pnl: 0, pnlUSD: 0, deposited: 0, depositedUSD: 0, underlyingValue: 0, underlyingValueUSD: 0 };
      let embeddedBalance = { balance: BigInt(0), decimals: 18, formatted: "0" };
      let embeddedShareBalance = { formatted: 0 };

      if (embeddedWalletAddress) {
        const { data } = await getUserVaultPositionFromSubgraph(embeddedWalletAddress.toLowerCase(), vault?.id);
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
          pnlUSD: Number(userPnlData.unrealizedPnL) < 0 ? 0 : Number(userPnlData.unrealizedPnL) * price.price,
          deposited: Number(userPnlData.costBasis),
          depositedUSD: Number(userPnlData.costBasis) * price.price,
          underlyingValue: Number(userPnlData.underlyingValue),
          underlyingValueUSD: Number(userPnlData.underlyingValue) * price.price,
        };
        embeddedBalance = await getTokenBalance(vault.token0.address, embeddedWalletAddress as `0x${string}`, vaultChain);
        if (cancelled) return;
        const embeddedShareBalanceData = await getTokenBalance(vault.id, embeddedWalletAddress as `0x${string}`, vaultChain);
        if (cancelled) return;

        embeddedShareBalance = { formatted: Number(embeddedShareBalanceData.formatted) };
      }

      const combinedPnl = {
        pnl: externalPnl.pnl + embeddedPnl.pnl,
        pnlUSD: externalPnl.pnlUSD + embeddedPnl.pnlUSD,
        deposited: Number(externalPnl.deposited) + Number(embeddedPnl.deposited),
        depositedUSD: externalPnl.depositedUSD + embeddedPnl.depositedUSD,
        underlyingValue: Number(externalPnl.underlyingValue) + Number(embeddedPnl.underlyingValue),
        underlyingValueUSD: externalPnl.underlyingValueUSD + embeddedPnl.underlyingValueUSD,
      };

      if (!cancelled) {
        setUserBalance({ formatted: Number(externalBalance.formatted) + Number(embeddedBalance.formatted) });
        setUserShareBalance({ formatted: Number(externalShareBalance.formatted) + Number(embeddedShareBalance.formatted) });
        setUserPositionPnlInfo(combinedPnl);
        setTokenPrice(price.price);
        setTokenRate(Number(rateData.rate));
      }
    }
    getUserPnl();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, embeddedWalletAddress, vault?.id, pnlRefreshKey]);

  // Refresh PnL after a successful deposit or withdraw via the SpiceFlow modals
  useEffect(() => {
    const refresh = () => {
      // Bump pnlRefreshKey to re-trigger the getUserPnl effect above.
      // A simple state clone wouldn't work because the effect deps wouldn't change.
      setPnlRefreshKey((k) => k + 1);
    };
    window.addEventListener("vault-deposit-complete", refresh);
    window.addEventListener("crosschain-withdraw-complete", refresh);
    return () => {
      window.removeEventListener("vault-deposit-complete", refresh);
      window.removeEventListener("crosschain-withdraw-complete", refresh);
    };
  }, []);

  useEffect(() => {
    if (!formattedTotalSupply || !tokenRate || !tokenPrice) return;
    setVaultTvl(Number(formattedTotalSupply) * Number(tokenRate) * Number(tokenPrice) || 0);
  }, [formattedTotalSupply, tokenRate, tokenPrice]);

  useEffect(() => {
    if (!vault) return;
    let cancelled = false;

    async function getVaultInfo() {
      if (!vault) return;
      const _vaultInfo = await getVaultByIdWithSubgraph(vault.id, vaultChain.id);
      if (!cancelled) setVaultData(_vaultInfo);
    }
    getVaultInfo();
    return () => { cancelled = true; };
  }, [vault, vaultChain.id]);

  if (vaultLoading) {
    return <VaultDetailsSkeleton />;
  }

  if (!vault) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Vault Not Found
          </h1>
          <p className="text-muted-foreground mb-4">
            The requested vault could not be found.
          </p>
          <Button asChild>
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href={"/"}>
                <ArrowLeft className="h-8 w-8 text-muted-foreground" />
              </Link>
              {getTokenImage(vault.token0.symbol) ? (
                <Image
                  src={
                    getTokenImage(vault.token0.symbol)! || "/placeholder.svg"
                  }
                  alt={vault.token0.symbol}
                  width={52}
                  height={52}
                  className="w-12 h-12 rounded-full"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border-2 border-primary/20">
                  <span className="text-2xl font-bold text-primary">
                    {vault.token0.symbol.charAt(0)}
                  </span>
                </div>
              )}
              <h1 className="text-3xl font-bold text-foreground uppercase tracking-wide">
                {vault.name}
              </h1>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">
                {vaultData && Number(vaultData.apy) > 0 ? `${formatAPY(vaultData.apy)}` : `${vault.apy}%`}
              </div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider">
                Current APY
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8 mt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Position Card */}
            <Card className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl p-6 border border-primary/20 hover:border-primary/30 transition-all duration-300">
              <div className="flex flex-col gap-6 w-full">
                <div className="flex items-start justify-between flex-row gap-4">
                  <div className="flex items-center gap-3">
                    <Coins className="w-6 h-6 text-primary" />
                    <h3 className="text-lg md:text-2xl font-bold text-foreground uppercase tracking-wide">
                      Position
                    </h3>
                    {/* {userAssetValue > 0 && (
                  <Badge variant="outline" className="text-blue-500 font-bold">
                    Active
                  </Badge>
                )} */}
                  </div>
                </div>

                {(() => {

                  const pnlColor = "text-muted-foreground";
                  // pnlUSD > 0
                  //   ? "text-green-500"
                  //   : pnlUSD < 0
                  //   ? "text-red-500"
                  //   : "text-muted-foreground";

                  if (!userPositionPnlInfo?.depositedUSD && !userPositionPnlInfo?.underlyingValueUSD && (userShareBalance?.formatted ?? 0) === 0) {
                    return (
                      <div className="text-sm text-muted-foreground">
                        You have no position in this vault yet. Deposit to get
                        started.
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 gap-6">
                      <div className="flex flex-row items-center justify-between gap-1">
                        <span className="text-lg px-2 font-semibold uppercase">
                          Balance
                        </span>
                        <div className="flex text-right flex-col">
                          <span className="text-lg font-semibold text-foreground">
                            $
                            {formatPrice(
                              Number(userPositionPnlInfo?.underlyingValue) > 0 ? Number(userPositionPnlInfo?.underlyingValue) * (tokenPrice ?? 0) : (userShareBalance?.formatted ?? 0) * (tokenPrice ?? 0)
                            )}
                          </span>
                          <span className="text-sm text-foreground">
                            {formatPrice(
                              Number(userPositionPnlInfo?.underlyingValue) > 0 ? userPositionPnlInfo?.underlyingValue : (userShareBalance?.formatted ?? 0)
                            )}{" "}
                            {vault.token0.symbol}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-row items-center justify-between gap-1">
                        <span className="text-lg px-2 font-semibold uppercase">
                          P&L
                        </span>
                        <div className="flex text-right flex-col">
                          <span className={`text-lg font-semibold ${pnlColor}`}>
                            ${formatPrice(userPositionPnlInfo?.pnlUSD || 0)}
                            {/* {depositedUSD > 0 && (
                            <span className="ml-2 text-xs font-medium">
                              {pnlPercent.toFixed(2)}%
                            </span>
                          )} */}
                          </span>
                          <span className="text-sm text-foreground">
                            {formatPrice(userPositionPnlInfo?.pnl || 0)}{" "}
                            {vault.token0.symbol}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex gap-2">
                  <div className="flex gap-3">
                    <Button
                      className="rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                      onClick={() => {
                        openDeposit();
                      }}
                    >
                      Deposit
                    </Button>
                    {crossChainBalance > 0 && (
                      <Button
                        className="rounded-md text-white text-xs font-semibold bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 transition-all duration-200 flex items-center gap-1"
                        onClick={() => {
                          openSupply({
                            // Prefer the wrapped ERC-20 address (e.g. WCBTC) over
                            // the native token address (zeroAddress for CBTC)
                            address:
                              vault.token0.wrapped?.address ??
                              vault.token0.wrappedAddress ??
                              vault.token0.address,
                            symbol:
                              vault.token0.wrapped?.symbol ?? vault.token0.symbol,
                            decimals:
                              vault.token0.wrapped?.decimals ?? vault.token0.decimals,
                          });
                        }}
                      >
                        <ArrowDownToLine className="h-3 w-3" />
                        Supply to Vault
                      </Button>
                    )}
                    <Button
                      className="rounded-md bg-gray-200 text-gray-800 text-xs font-semibold hover:bg-gray-300 transition-colors"
                      onClick={() => {
                        openWithdraw();
                      }}
                    >
                      Withdraw
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            <KeyMetricsCard
              apy={vaultData && Number(vaultData.apy) > 0 ? `${formatAPY(vaultData.apy)}` : `${vault.apy}%`}
              tvl={vaultTvl ? Number(vaultTvl) : 0}
              launchDate={vault.launchDate}
              risk="low"
              assets={vault.token0.name}
              protocols={vault?.breakdown || []}
            />
          </div>
        </div>

        <div className="space-y-8 mt-8">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GrowthChart
              show
              initialBalance={
                Number(userPositionPnlInfo?.underlyingValueUSD) > 0 || Number(userShareBalance?.formatted) > 0
                  ? Number(userPositionPnlInfo?.underlyingValueUSD) || Number(userShareBalance?.formatted ?? 0) * (tokenPrice ?? 0)
                  : Number(Number(userBalance?.formatted ?? 0) * (tokenPrice ?? 0))
              }
              totalAPY={vaultData ? Number(vaultData?.apy) : Number(vault.apy || 6)}
              chartTimeframe={chartTimeframe}
              setChartTimeframe={setChartTimeframe}
              fullWidth={false}
              isActive={Number(userPositionPnlInfo?.underlyingValue) > 0 || Number(userShareBalance?.formatted ?? 0) > 0}
            />
            {/* <Card className="bg-card border-border pb-20 pt-8 px-4 hover:border-primary/20 transition-all duration-300 hover:shadow-lg">
               <ApyChart initialApy={vaultData ? Number(vaultData?.apy) : 6} />
             </Card> */}
            {/* Start Investing section */}
            <Card className="bg-card border-border p-8">
              <div className="grid grid-cols-1 gap-8 items-end">
                {/* Left side - Investment Input */}
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      Start Investing
                    </h2>
                    {/* <p className="text-muted-foreground">
                    Begin earning returns with this vault
                  </p> */}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Investment Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground text-lg">
                        $
                      </span>
                      <Input
                        inputMode="decimal"
                        pattern="^[0-9]*[.,]?[0-9]*$"
                        value={investmentAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || /^\d*\.?\d*$/.test(val)) {
                            setInvestmentAmount(val);
                          }
                        }}
                        className="pl-8 h-14 text-lg font-medium border-2 border-border focus:border-primary"
                        placeholder="1000"
                      />
                    </div>
                  </div>

                  <Button
                    className="w-full h-14 text-lg font-bold neon-button"
                    onClick={
                      calculateInvestment
                    }
                  >
                    Calculate Returns
                  </Button>
                </div>

                {/* Right side - Projected Returns */}
                <div className="space-y-4">
                  <h3 className="text-xl text-foreground mb-2">
                    Projected Returns
                  </h3>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">
                        Annual Return (est.)
                      </span>
                      <span className="text-lg font-bold text-green-500">
                        ${formatPrice(returns.annual, 2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">
                        Monthly Return (est.)
                      </span>
                      <span className="text-lg font-bold text-green-500">
                        ${formatPrice(returns.monthly, 2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">
                        5-Year Growth (est.)
                      </span>
                      <span className="text-lg font-bold text-green-500">
                        ${formatPrice(returns.fiveYear, 2)}
                      </span>
                    </div>
                  </div>

                </div>
              </div>
            </Card>
          </div>

          {vault.breakdown && vault.breakdown.length > 0 && (
            <VaultBreakdownChart
              vault={vault}
              totalSupply={Number(formattedTotalSupply)}
              rate={tokenRate ?? 0}
              price={tokenPrice ?? 0}
              breakdown={vault.breakdown}
              strategy={vault?.strategyDescription || ""}
              totalTvl={
                vaultTvl ? Number(vaultTvl) : 0
              }
              apy={vaultData ? Number(Number(vaultData?.apy).toFixed(2)) : vault && Number(vault.apy)}
            />
          )}

          {/* Deposit/Withdraw Modal */}
          {isModalOpen && modalType === "deposit" && selectedToken && (
            <DepositModal
              open={isModalOpen && modalType === "deposit"}
              onOpenChange={setIsModalOpen}
              apy={vaultData ? Number(vaultData?.apy) : vault && Number(vault.apy)}
              amount={amount}
              setAmount={setAmount}
              selectedToken={selectedToken}
              setSelectedToken={setSelectedToken}
              isTokenSelectorOpen={isTokenSelectorOpen}
              setIsTokenSelectorOpen={setIsTokenSelectorOpen}
            />
          )}

          {/* Deposit/Withdraw Modal */}
          {isModalOpen && modalType === "withdraw" && selectedToken && (
            <WithdrawModal
              open={isModalOpen && modalType === "withdraw"}
              onOpenChange={setIsModalOpen}
              amount={amount}
              setAmount={setAmount}
              selectedToken={selectedToken}
              setSelectedToken={setSelectedToken}
              isTokenSelectorOpen={isTokenSelectorOpen}
              setIsTokenSelectorOpen={setIsTokenSelectorOpen}
            />
          )}

          {/* Token Selector Modal */}
          {selectedToken && (
            <TokenSelectorModal
              open={isTokenSelectorOpen}
              onOpenChange={setIsTokenSelectorOpen}
              selectedToken={selectedToken}
              setSelectedToken={setSelectedToken}
              tokens={
                modalType === "deposit"
                  ? [vault.token0]
                  : [
                    {
                      symbol: vault.symbol,
                      address: vault.id,
                      decimals: vault.decimals,
                      name: vault.name,
                    },
                  ]
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function VaultDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex-1 flex justify-center">
              <div className="bg-primary text-primary-foreground border-0 px-6 py-2 text-sm font-semibold rounded-full">
                Loading Vault...
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-8">
          <div className="space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-1/4"></div>
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-48 bg-muted rounded"></div>
              <div className="h-32 bg-muted rounded"></div>
            </div>
            <div className="h-96 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
