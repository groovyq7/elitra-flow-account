"use client";

import { useState } from "react";
import Link from "next/link";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useParams } from "next/navigation";
import { useAccount, useConfig } from "wagmi";
import { useVaultDetails } from "@/hooks/use-vault-data";
import { useTotalSupply } from "@/hooks/use-vault-transactions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VaultBreakdownChart } from "@/app/vault/[id]/components/vault-breakdown-chart";
import { VaultStatsCards } from "@/app/vault/[id]/components/VaultStatsCards";
import {
  formatAPY,
  formatPrice,
} from "@/lib/utils/format";
import { Coins, ArrowLeft, AlertTriangle } from "lucide-react";
import Image from "next/image";
import { getTokenImage } from "@/lib/utils";
import { KeyMetricsCard } from "./components/KeyMetricsCard";
import { DepositModal } from "@/app/opportunities/components/DepositModal";
import { TokenSelectorModal } from "@/app/opportunities/components/TokenSelectorModal";
import { WithdrawModal } from "@/app/opportunities/components/WithdrawModal";
import { TokenType } from "@/lib/types";
import { GrowthChart } from "@/app/opportunities/components/GrowthChart";
import { ArrowDownToLine } from "lucide-react";
import { useSpiceStore } from "@/store/useSpiceStore";
import { useEmbeddedWalletAddress } from "@spicenet-io/spiceflow-ui";
import { useVaultPageData } from "@/hooks/useVaultPageData";

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

  // ── Legacy modal state (kept for DepositModal / WithdrawModal / TokenSelectorModal) ──
  const [isModalOpen, setIsModalOpen] = useState(false);
  // modalType controls which modal to show; setModalType reserved for future withdraw flow
  const [modalType, _setModalType] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenType | undefined>();

  // ── Calculator state ────────────────────────────────────────────────────
  const [investmentAmount, setInvestmentAmount] = useState("1000");
  const [returns, setReturns] = useState({ annual: 0, monthly: 0, fiveYear: 0 });

  // ── Chart state ─────────────────────────────────────────────────────────
  const [chartTimeframe, setChartTimeframe] = useState<"30d" | "6m" | "1y" | "3y">("3y");

  // ── Vault data (basic) ──────────────────────────────────────────────────
  const { data: vault, isLoading: vaultLoading } = useVaultDetails(vaultId);
  const vaultChain =
    vault?.chainId ? chains.find((c) => c.id === vault.chainId) || chain : chain;

  const { totalSupply: _totalSupply, formattedTotalSupply } = useTotalSupply(vaultId);

  // ── All derived/async data via hook ────────────────────────────────────
  const {
    vaultData,
    vaultTvl,
    tokenPrice,
    tokenRate,
    userBalance,
    userShareBalance,
    userPositionPnlInfo,
    subgraphAvailable,
  } = useVaultPageData({
    vault,
    vaultChain,
    address,
    embeddedWalletAddress,
    isConnected,
    formattedTotalSupply,
  });

  // ── Calculator logic ────────────────────────────────────────────────────
  const calculateReturns = (amount: string, apy: number) => {
    const principal = Number.parseFloat(amount) || 0;
    const annualReturn = (principal * apy) / 100;
    const monthlyReturn = annualReturn / 12;
    const fiveYearGrowth = principal * Math.pow(1 + apy / 100, 5) - principal;
    return { annual: annualReturn, monthly: monthlyReturn, fiveYear: fiveYearGrowth };
  };

  const calculateInvestment = () => {
    const r = vault
      ? calculateReturns(
          investmentAmount,
          Number(vaultData?.apy || vault.apy) || 0
        )
      : { annual: 0, monthly: 0, fiveYear: 0 };
    setReturns(r);
  };

  // ── Loading / not-found states ──────────────────────────────────────────
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
    <ErrorBoundary>
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
                    src={getTokenImage(vault.token0.symbol)! || "/placeholder.svg"}
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
                  {vaultData && Number(vaultData.apy) > 0
                    ? `${formatAPY(vaultData.apy)}`
                    : `${vault.apy}%`}
                </div>
                <div className="text-sm text-muted-foreground uppercase tracking-wider">
                  Current APY
                </div>
              </div>
            </div>
          </div>

          {/* Subgraph unavailable notice — shown when the indexer endpoint is down */}
          {subgraphAvailable === false && (
            <div className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Historical data unavailable — showing cached vault data. Live APY and analytics may be delayed.</span>
            </div>
          )}

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
                    </div>
                  </div>

                  {(() => {
                    const pnlColor = "text-muted-foreground";

                    if (
                      !userPositionPnlInfo?.depositedUSD &&
                      !userPositionPnlInfo?.underlyingValueUSD &&
                      (userShareBalance?.formatted ?? 0) === 0
                    ) {
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
                                Number(userPositionPnlInfo?.underlyingValue) > 0
                                  ? Number(userPositionPnlInfo?.underlyingValue) *
                                      (tokenPrice ?? 0)
                                  : (userShareBalance?.formatted ?? 0) *
                                      (tokenPrice ?? 0)
                              )}
                            </span>
                            <span className="text-sm text-foreground">
                              {formatPrice(
                                Number(userPositionPnlInfo?.underlyingValue) > 0
                                  ? userPositionPnlInfo?.underlyingValue
                                  : (userShareBalance?.formatted ?? 0)
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
                        onClick={() => openDeposit()}
                      >
                        Deposit
                      </Button>
                      {crossChainBalance > 0 && (
                        <Button
                          className="rounded-md text-white text-xs font-semibold bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 transition-all duration-200 flex items-center gap-1"
                          onClick={() => {
                            openSupply({
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
                        onClick={() => openWithdraw()}
                      >
                        Withdraw
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>

              <KeyMetricsCard
                apy={
                  vaultData && Number(vaultData.apy) > 0
                    ? `${formatAPY(vaultData.apy)}`
                    : `${vault.apy}%`
                }
                tvl={vaultTvl ? Number(vaultTvl) : 0}
                launchDate={vault.launchDate}
                risk="low"
                assets={vault.token0.name}
                protocols={vault?.breakdown || []}
              />
            </div>
          </div>

          {/* Vault stats: share price, vault address, deposit cap, yield generated */}
          <div className="mt-8">
            <VaultStatsCards vault={vault} />
          </div>

          <div className="space-y-8 mt-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GrowthChart
                show
                initialBalance={
                  Number(userPositionPnlInfo?.underlyingValueUSD) > 0 ||
                  Number(userShareBalance?.formatted) > 0
                    ? Number(userPositionPnlInfo?.underlyingValueUSD) ||
                      Number(userShareBalance?.formatted ?? 0) * (tokenPrice ?? 0)
                    : Number(Number(userBalance?.formatted ?? 0) * (tokenPrice ?? 0))
                }
                totalAPY={vaultData ? Number(vaultData?.apy) : Number(vault.apy || 6)}
                chartTimeframe={chartTimeframe}
                setChartTimeframe={setChartTimeframe}
                fullWidth={false}
                isActive={
                  Number(userPositionPnlInfo?.underlyingValue) > 0 ||
                  Number(userShareBalance?.formatted ?? 0) > 0
                }
              />

              {/* Start Investing section */}
              <Card className="bg-card border-border p-8">
                <div className="grid grid-cols-1 gap-8 items-end">
                  <div className="space-y-6">
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-foreground mb-2">
                        Start Investing
                      </h2>
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
                      onClick={calculateInvestment}
                    >
                      Calculate Returns
                    </Button>
                  </div>

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
                totalTvl={vaultTvl ? Number(vaultTvl) : 0}
                apy={
                  vaultData
                    ? Number(Number(vaultData?.apy).toFixed(2))
                    : vault && Number(vault.apy)
                }
              />
            )}

            {/* Deposit/Withdraw Modal (legacy, only shown when isModalOpen) */}
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
    </ErrorBoundary>
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
