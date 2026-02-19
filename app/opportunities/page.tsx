"use client";

import { useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Eye,
  BarChart3,
  Coins,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  ArrowDownToLine,
} from "lucide-react";
import { useVaultData } from "@/hooks/use-vault-data";
import { formatPrice } from "../../lib/utils/format";
import { AvailableAssetsTable } from "./components/AvailableAssetsTable";
import { GrowthChart } from "./components/GrowthChart";
import { DepositModal } from "./components/DepositModal";
import { TokenSelectorModal } from "./components/TokenSelectorModal";
import { OpportunitiesList } from "./components/OpportunitiesList";
import { Button } from "@/components/ui/button";
import { TokenInfo, TokenType, Vault } from "@/lib/types";
import { fetchTokenInfos, mergeTokenInfos } from "@/lib/fetchTokenInfos";
import { useAccount, useConfig } from "wagmi";
import { Badge } from "@/components/ui/badge";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { LINKS, OFFICIAL_TOKENS, VAULT_TOKENS } from "@/lib/constants";
import { DepositedAssetsTable } from "./components/DepositedAssetsTable";
import { ElitraAccountTab } from "./components/ElitraAccountTab";
import { Tabs } from "@radix-ui/react-tabs";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getVaultsByChain, getVaultsByChainWithSubgraph } from "@/lib/contracts/vault-registry";
import { getChainConfig } from "@/lib/utils/chains";
import { useEmbeddedWalletAddress } from "@spicenet-io/spiceflow-ui";

import { trackModalOpen } from "@/lib/analytics";
import { useSpiceStore } from "@/store/useSpiceStore";

interface PortfolioData {
  totalBalance: number;
  eligibleToEarn: number;
  estimatedRewards: number;
  estimatedActiveRewards: number;
  monthlyRewards: number;
  depositedAmountUSD: number;
}

export default function OpportunitiesPage() {
  const { vaults } = useVaultData();
  const chain = useConfig().getClient().chain;
  const { address, isConnected } = useAccount();

  // Defer wallet-dependent UI until after hydration to prevent SSR mismatch.
  // wagmi may restore a connected session on the client, but the server always
  // renders as disconnected, causing a hydration error without this guard.
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { setHasMounted(true); }, []);
  const clientConnected = hasMounted && isConnected;

  const [tokenInfos, setTokenInfos] = useState<TokenInfo[]>([]);
  const [vaultTokenInfos, setVaultTokenInfos] = useState<TokenInfo[]>([]);
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [selectedTab, setSelectedTab] = useState<"available" | "deposited" | "account">(
    "available"
  );

  const [chartTimeframe, setChartTimeframe] = useState<
    "30d" | "6m" | "1y" | "3y"
  >("3y");

  const embeddedWalletAddress = useEmbeddedWalletAddress();
  const { openDeposit, openSupply, openWithdraw, crossChainBalance } = useSpiceStore();

  // Calculate total APY from tokenInfos (weighted average)
  const calculateTotalAPY = (tokenInfos: TokenInfo[]) => {
    if (!tokenInfos || tokenInfos.length === 0) return 0;

    const totalValue = tokenInfos.reduce(
      (sum, token) => sum + token.availableUSD,
      0
    );
    if (totalValue === 0) return 0;

    return tokenInfos.reduce((sum, token) => {
      const weight = token.availableUSD / totalValue;
      return sum + token.apy * weight;
    }, 0);
  };

  // Inside your component, add this memoized chart data:
  const totalAPY = useMemo(() => calculateTotalAPY(tokenInfos), [tokenInfos]);
  const initialBalance =
    ((portfolioData?.depositedAmountUSD ?? 0) > 0
      ? (portfolioData?.depositedAmountUSD ?? 0)
      : (portfolioData?.totalBalance ?? 0)) || 1000;

  const [showPortfolioOverview, setShowPortfolioOverview] = useState(true);
  const [showGrowthChart, setShowGrowthChart] = useState(true);
  const [portfolioCollapsed, setPortfolioCollapsed] = useState(true);

  // Deposit/Withdraw modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"deposit">("deposit");
  const [amount, setAmount] = useState("");
  const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false);

  const citreaVaults = useMemo(() => getVaultsByChain(5115), []);
  const availableVaults =
    vaults && vaults.length > 0 ? vaults : (citreaVaults as Vault[]);
  const [vaultsData, setVaultsData] = useState<Vault[] | undefined>();
  const citreaChain = useMemo(() => getChainConfig(5115)?.viemChain, []);

  // Build unique tokens array from availableVaults
  const depositTokens = useMemo(
    () =>
      Array.from(
        new Map(
          availableVaults
            .flatMap((vault) => [vault.token0, vault.token1])
            .filter(Boolean)
            .map((token) => [token!.address, token])
        ).values()
      ).filter(Boolean),
    [availableVaults]
  );

  const withdrawTokens = useMemo(
    () =>
      availableVaults
        ? availableVaults.map((vault) => ({
            address: vault.id,
            symbol: `e${vault.token0.symbol}`,
            decimals: vault.token0.decimals,
            name: vault.name,
          }))
        : [],
    [availableVaults]
  );

  // Always use a valid token object as initial state
  const defaultToken =
    modalType === "deposit"
      ? depositTokens[0] || {
        symbol: "USDC",
        address: "0xusdc",
        decimals: 6,
        name: "USD Coin",
      }
      : withdrawTokens[0] || {
        symbol: "ElitraUSDC",
        address: "0xusdc",
        decimals: 6,
        name: "Elitra USD Coin",
      };
  const [selectedToken, setSelectedToken] = useState<TokenType>(defaultToken);

  useEffect(() => {
    if (embeddedWalletAddress) {
      sessionStorage.setItem('embeddedWalletAddress', embeddedWalletAddress);
    }
  }, [embeddedWalletAddress]);

  useEffect(() => {
    let cancelled = false;

    const getTokenInfos = async () => {
      if (!depositTokens.length || !address || !chain) {
        setTokenInfos([]);
        setPortfolioData(null);
        return;
      }

      const currentTokens = OFFICIAL_TOKENS[chain.id] || [];
      const citreaTokens = OFFICIAL_TOKENS[5115] || [];
      const tokensByChain = chain.id === 5115
        ? [{ tokens: currentTokens, chain }]
        : [
          { tokens: currentTokens, chain },
          ...(citreaChain ? [{ tokens: citreaTokens, chain: citreaChain }] : []),
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
              fetchTokenInfos(tokens, embeddedWalletAddress as `0x${string}`, tokenChain, vaultsData)
            )
          ).then((results) => results.flat())
          : Promise.resolve([]),
      ]);

      // Merge the token infos from both wallets
      const combinedTokenInfoData = mergeTokenInfos(externalTokenInfos, embeddedTokenInfos);

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

        const _portfolioData = {
          totalBalance: combinedTokenInfoData.reduce(
            (sum, token) => sum + token.availableUSD,
            0
          ),
          eligibleToEarn: combinedTokenInfoData.reduce(
            (sum, token) =>
              depositTokens
                .flatMap((t) => t?.address)
                .includes(token.token.address)
                ? sum + token.availableUSD
                : sum,
            0
          ),
          estimatedRewards: combinedTokenInfoData.reduce(
            (sum, token) =>
              depositTokens
                .flatMap((t) => t?.address)
                .includes(token.token.address)
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
              depositTokens
                .flatMap((t) => t?.address)
                .includes(token.token.address)
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
    };

    // Run once on mount
    getTokenInfos();

    // Run when user comes back to the tab
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
  ]);

  useEffect(() => {
    if (depositTokens.length > 0 && selectedToken.address === "0xusdc") {
      const token = modalType === "deposit" ? depositTokens[0] : withdrawTokens[0];
      if (token) setSelectedToken(token);
    }
  }, [depositTokens, withdrawTokens]);

  useEffect(() => {
    let cancelled = false;
    const getVaultInfos = async () => {
      const _vaults = await getVaultsByChainWithSubgraph(5115);

      if (!cancelled) {
        setVaultsData(_vaults);
      }
    };

    getVaultInfos();
    return () => {
      cancelled = true;
    };
  }, [chain, isModalOpen]);

  return (
    <ErrorBoundary>
    <div className="lg:container w-full lg:mx-auto px-4 py-8 space-y-8 bg-transparent">
      {/* Portfolio Overview */}
      <div className="space-y-8">
        {/* Portfolio Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          {/* Combined Total Balance & Eligible to Earn */}
          <Card
            className={`bg-white border border-gray-200 shadow-sm col-span-1 lg:col-span-2 py-10 ${portfolioCollapsed ? " gap-0 " : " gap-6 "
              }`}
          >
            <CardHeader className="flex lg:flex-row flex-col items-stretch lg:items-center lg:justify-between gap-3 pb-2 flex-1">
              <CardTitle className="text-base font-semibold text-gray-900 flex flex-1 gap-2 items-center justify-between">
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() =>
                      setShowPortfolioOverview(!showPortfolioOverview)
                    }
                    className="hidden md:flex items-center rounded-lg hover:bg-muted/50 transition-colors cursor-pointer p-2"
                    title="Toggle Available Assets List Overview"
                  >
                    <Eye
                      className={`text-gray-600 ${showPortfolioOverview ? "opacity-100" : "opacity-50"
                        }`}
                      size={20}
                    />
                  </button>
                  <span>Active Assets</span>
                  {chain?.testnet && (
                    <Badge variant="outline" className="">
                      Testnet
                    </Badge>
                  )}
                  <button
                    onClick={() => setPortfolioCollapsed((c) => !c)}
                    className="flex items-center rounded-md hover:bg-muted/50 transition-colors p-1"
                    aria-label={
                      portfolioCollapsed ? "Expand section" : "Collapse section"
                    }
                    aria-expanded={!portfolioCollapsed}
                    title={portfolioCollapsed ? "Expand" : "Collapse"}
                  >
                    {portfolioCollapsed ? (
                      <ChevronDown size={18} className="text-gray-600" />
                    ) : (
                      <ChevronUp size={18} className="text-gray-600" />
                    )}
                  </button>
                </div>
                {portfolioData && (
                  <div className="text-xl md:text-2xl font-bold text-black">
                    ${formatPrice(portfolioData.depositedAmountUSD)}
                  </div>
                )}
              </CardTitle>
              {clientConnected ? (
                portfolioData ? (
                  portfolioData.eligibleToEarn ||
                    portfolioData.depositedAmountUSD ? (
                    <div className="flex gap-2 items-center">
                      <Button
                        className="rounded-md text-white text-xs font-semibold bg-gradient-to-r from-blue-600 to-blue-500 group-hover:from-blue-700 group-hover:to-blue-600 transition-all duration-200"
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
                            const token0 = depositTokens[0] as TokenType | undefined;
                            if (token0) {
                              // Prefer wrapped ERC-20 address (e.g. WCBTC) over
                              // native address (zeroAddress for CBTC)
                              openSupply({
                                address:
                                  token0.wrapped?.address ??
                                  token0.wrappedAddress ??
                                  token0.address,
                                symbol:
                                  token0.wrapped?.symbol ?? token0.symbol,
                                decimals:
                                  token0.wrapped?.decimals ?? token0.decimals,
                              });
                            }
                          }}
                        >
                          <ArrowDownToLine className="h-3 w-3" />
                          Supply to Vault
                        </Button>
                      )}
                      <Button
                        className="rounded-md text-white text-xs font-semibold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 transition-all duration-200"
                        onClick={() => {
                          openWithdraw();
                        }}
                      >
                        Withdraw
                      </Button>
                    </div>
                  ) : (
                    <div className="flex">
                      <Link
                        href={LINKS.get}
                        target="_blank"
                        className="bg-primary hover:bg-primary/80 text-white text-sm font-semibold py-2 px-4 rounded-md flex items-center gap-2 mb-2"
                      >
                        Get Testnet Assets
                        <ExternalLink size={18} />
                      </Link>
                    </div>
                  )
                ) : (
                  <div className="h-6 w-20 bg-gray-200 rounded animate-pulse" />
                )
              ) : (
                <ConnectButton label="Connect Wallet" />
              )}
            </CardHeader>
            <CardContent
              className={`transition-all duration-300 origin-top ${portfolioCollapsed
                ? "max-h-0 opacity-0 overflow-hidden p-0"
                : "opacity-100"
                }`}
            >
              {portfolioData ? (
                <div className="flex justify-between items-center">
                  <div className="text-md font-semibold">Total Assets</div>
                  {portfolioData.eligibleToEarn ||
                    portfolioData.depositedAmountUSD ? (
                    <div className="text-xl font-bold text-black mb-1">
                      $
                      {formatPrice(
                        portfolioData.eligibleToEarn +
                        portfolioData.depositedAmountUSD
                      )}
                    </div>
                  ) : (
                    <div className="flex">
                      <Link
                        href={LINKS.get}
                        target="_blank"
                        className="bg-primary hover:bg-primary/80 text-white text-sm font-semibold py-2 px-4 rounded-md flex items-center gap-2 mb-2"
                      >
                        Get Testnet Assets
                        <ExternalLink size={18} />
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-8 w-40 bg-gray-200 rounded animate-pulse mb-1" />
              )}
              {portfolioData ? (
                <div className="flex justify-between items-center">
                  <div className="text-md text-gray-700 font-semibold">
                    Active Assets
                  </div>
                  <div className="text-md font-semibold text-gray-700 mb-1">
                    ${formatPrice(portfolioData.depositedAmountUSD)}
                  </div>
                </div>
              ) : (
                <div className="h-8 w-40 bg-gray-200 rounded animate-pulse mb-1" />
              )}

              {portfolioData ? (
                <div className="flex justify-between items-center">
                  <span className="text-md text-muted-foreground">
                    Eligible to Earn
                  </span>
                  <div className="text-base">
                    ${formatPrice(portfolioData.eligibleToEarn)}
                  </div>
                </div>
              ) : (
                <div className="h-6 w-25 bg-gray-200 rounded animate-pulse" />
              )}
            </CardContent>
          </Card>

          {/* Only Annual Rewards + Chart Toggle */}
          <Card
            className={`bg-white border border-gray-200 shadow-sm col-span-1 py-10 ${portfolioCollapsed ? " gap-0 " : " gap-6 "
              }`}
          >
            <CardHeader className="flex flex-row items-center gap-3">
              <button
                onClick={() => setShowGrowthChart(!showGrowthChart)}
                className="hidden md:flex items-center rounded-lg hover:bg-muted/50 transition-colors cursor-pointer p-2"
                title="Toggle Growth Chart"
              >
                <BarChart3
                  className={`text-gray-600 ${showGrowthChart ? "opacity-100" : "opacity-50"
                    }`}
                  size={18}
                />
              </button>
              <CardTitle
                className={`text-base transition-all duration-500 font-semibold text-gray-900 flex gap-2 items-center justify-between flex-1 ${!portfolioCollapsed ? "py-0" : "py-3"
                  }`}
              >
                Est. 1Y Rewards
                {portfolioData ? (
                  <div className="text-lg text-gray-700 font-semibold">
                    ${formatPrice(portfolioData.estimatedActiveRewards, 2)}
                  </div>
                ) : (
                  <div className="h-6 w-20 bg-gray-200 rounded animate-pulse" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent
              className={`transition-all duration-300 origin-top ${portfolioCollapsed
                ? "max-h-0 opacity-0 overflow-hidden p-0"
                : "opacity-100"
                }`}
            >
              {portfolioData ? (
                <div className="flex justify-between items-center">
                  <div className="text-md font-semibold">
                    Total Potential Rewards
                  </div>
                  <div className="text-md font-bold text-black mb-1">
                    $
                    {formatPrice(
                      portfolioData.estimatedRewards +
                      portfolioData.estimatedActiveRewards
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-6 w-30 bg-gray-200 rounded animate-pulse" />
              )}

              {portfolioData ? (
                <div className="flex justify-between items-center">
                  <div className="text-base text-gray-700 font-semibold">
                    Active Rewards
                  </div>
                  <div className="text-base text-gray-700 font-semibold">
                    ${formatPrice(portfolioData.estimatedActiveRewards, 2)}
                  </div>
                </div>
              ) : (
                <div className="h-6 w-30 bg-gray-200 rounded animate-pulse mt-2" />
              )}
              {portfolioData ? (
                <div className="flex justify-between items-center border-t pt-2 mt-2">
                  <div className="text-md">Eligible Rewards</div>
                  <div className="text-md text-black mb-1">
                    ${formatPrice(portfolioData.estimatedRewards, 2)}
                  </div>
                </div>
              ) : (
                <div className="h-6 w-30 bg-gray-200 rounded animate-pulse mt-2" />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Responsive grid for Available Assets and Growth Chart */}
        <div
          className={`grid gap-6 transition-all duration-500
            ${showPortfolioOverview && showGrowthChart
              ? "grid-cols-1 lg:grid-cols-3"
              : "grid-cols-1"
            }
          `}
        >
          {/* Available Assets Section */}
          <div
            className={`transition-all duration-500
              ${showPortfolioOverview
                ? showGrowthChart
                  ? "col-span-1 lg:col-span-2 opacity-100 scale-100 pointer-events-auto"
                  : "col-span-1 opacity-100 scale-100 pointer-events-auto"
                : "opacity-0 scale-95 pointer-events-none h-0 overflow-hidden"
              }
            `}
          >
            <Card
              className={`bg-white border border-gray-200 shadow-sm h-full transition-all duration-500`}
            >
              <CardHeader>
                <div className="flex items-center gap-3 justify-between">
                  <CardTitle className="flex items-center gap-2 text-foreground pt-2">
                    <Coins className="w-5 h-5 text-gray-500" />
                    Assets
                  </CardTitle>

                  <Tabs
                    value={selectedTab}
                    onValueChange={(value) => setSelectedTab(value as "available" | "deposited" | "account")}
                  >
                    <TabsList className="bg-gray-100 border border-gray-200">
                      <TabsTrigger value="available">Available</TabsTrigger>
                      <TabsTrigger value="deposited">Deposited</TabsTrigger>
                      <TabsTrigger value="account">Elitra Account</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent className={showGrowthChart ? "" : "p-0"}>
                <div className={showGrowthChart ? "" : "p-6"}>
                  {selectedTab === "available" && (
                    <AvailableAssetsTable
                      tokenInfos={Array.isArray(tokenInfos) ? tokenInfos : []}
                      availableVaults={availableVaults}
                      fullWidth={!showGrowthChart}
                      setModalType={setModalType}
                      setSelectedToken={setSelectedToken}
                      setIsModalOpen={setIsModalOpen}
                    />
                  )}

                  {selectedTab === "deposited" && (
                    <DepositedAssetsTable
                      tokenInfos={
                        Array.isArray(vaultTokenInfos) ? vaultTokenInfos : []
                      }
                      availableVaults={availableVaults}
                      fullWidth={!showGrowthChart}
                      setModalType={setModalType}
                      setSelectedToken={setSelectedToken}
                      setIsModalOpen={setIsModalOpen}
                    />
                  )}

                  {selectedTab === "account" && (
                    <ElitraAccountTab />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          {/* Growth Chart Section */}
          <div
            className={`relative transition-all duration-500
              ${showGrowthChart
                ? showPortfolioOverview
                  ? "opacity-100 scale-100 pointer-events-auto"
                  : "col-span-1 opacity-100 scale-100 pointer-events-auto"
                : "opacity-0 scale-95 pointer-events-none h-0 overflow-hidden"
              }
            `}
          >
            <div
              className={
                clientConnected && (portfolioData?.totalBalance ?? 0) > 0
                  ? ""
                  : "filter blur-sm pointer-events-none select-none"
              }
            >
              <GrowthChart
                show={showGrowthChart}
                chartTimeframe={chartTimeframe}
                setChartTimeframe={setChartTimeframe}
                initialBalance={initialBalance}
                totalAPY={totalAPY}
                fullWidth={!showPortfolioOverview}
                isActive={(portfolioData?.depositedAmountUSD ?? 0) > 0}
              />
            </div>
            {(!clientConnected || portfolioData?.totalBalance === 0) && (
              <div className="absolute border border-gray-200 shadow-md rounded-lg inset-0 flex flex-col items-center justify-center bg-white/0 backdrop-blur-sm z-10">
                <span className="mb-4 text-xs text-muted-foreground px-3 text-center font-medium">
                  {clientConnected ? `Deposit assets ` : `Connect your wallet `} to
                  view growth projections chart
                </span>
                {clientConnected ? (
                  <Link
                    href={LINKS.get}
                    target="_blank"
                    className="bg-primary hover:bg-primary/80 text-white text-sm font-semibold py-2 px-4 rounded-md flex items-center gap-2"
                  >
                    Get Testnet Assets
                    <ExternalLink size={18} />
                  </Link>
                ) : (
                  <ConnectButton label="Connect Wallet" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Opportunities Section */}
      <OpportunitiesList
        availableVaults={
          vaultsData && vaultsData.length > 0
            ? (vaultsData as Vault[]).filter(
              (vault: Vault, index: number, self: Vault[]) =>
                index === self.findIndex((v: Vault) => v.id === vault.id)
            )
            : ([] as Vault[])
        }
      />

      {/* Direct Citrea Deposit Modal (fallback for Citrea-only deposits) */}
      {isModalOpen && modalType === "deposit" && (
        <DepositModal
          open={isModalOpen && modalType === "deposit"}
          onOpenChange={setIsModalOpen}
          amount={amount}
          setAmount={setAmount}
          selectedToken={selectedToken}
          setSelectedToken={setSelectedToken}
          apy={
            tokenInfos.find((t) => t.token.address === selectedToken.address)
              ?.apy as number
          }
          isTokenSelectorOpen={isTokenSelectorOpen}
          setIsTokenSelectorOpen={setIsTokenSelectorOpen}
        />
      )}

      {/* Token Selector Modal */}
      <TokenSelectorModal
        open={isTokenSelectorOpen}
        onOpenChange={setIsTokenSelectorOpen}
        selectedToken={selectedToken}
        setSelectedToken={setSelectedToken}
        tokens={
          (modalType === "deposit" ? depositTokens : withdrawTokens).filter(
            (t): t is TokenType => Boolean(t)
          ) as TokenType[]
        }
      />
    </div>
    </ErrorBoundary>
  );
}
