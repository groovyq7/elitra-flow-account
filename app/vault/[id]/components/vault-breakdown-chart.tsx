"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProtocolData, Vault, VaultBreakdown } from "@/lib/types";
import { formatAPY, shortenAddress } from "@/lib/utils/format";
import { fetchProtocolBreakdown } from "@/lib/utils/fetch-protocol-breakdown";
import { Badge } from "../../../../components/ui/badge";
import { Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useAccount, useConfig } from "wagmi";
import { getTokenBalance } from "@/lib/utils/get-token-balance";

interface VaultBreakdownChartProps {
  breakdown: VaultBreakdown[];
  totalTvl: number;
  totalSupply: number;
  rate: number;
  price: number;
  vault: Vault;
  strategy: string;
  apy: number;
}

const COLORS = [
  "#3B82F6", // Blue - matches primary color
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Violet
  "#06B6D4", // Cyan
  "#F97316", // Orange
  "#84CC16", // Lime
];

export function VaultBreakdownChart({
  vault,
  breakdown,
  totalSupply,
  rate,
  price,
  totalTvl,
  strategy,
  apy,
}: VaultBreakdownChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chain = useConfig().getClient().chain;
  const { address: userAddress } = useAccount();
  const [breakdownData, setBreakdownData] = useState<ProtocolData[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const chartData = breakdown.map((item, index) => ({
    ...item,
    value: item.percentage,
    color: COLORS[index % COLORS.length],
    tvl: (totalTvl * item.percentage) / 100,
  }));

  interface BreakdownTooltipProps {
    active?: boolean;
    payload?: Array<{ payload: { protocol: string; percentage: number; tvl: number } }>;
  }

  const CustomTooltip = ({ active, payload }: BreakdownTooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const idx = chartData.findIndex((d) => d.protocol === data.protocol);
      const apiApy = (breakdownData?.[idx] as { apy?: number } | undefined)?.apy;
      const displayApy = apiApy === 0 || apiApy == null ? apy : apiApy;
      return (
        <div className="bg-card border border-border rounded-lg p-4 shadow-xl backdrop-blur-sm">
          <p className="font-semibold text-card-foreground text-base">{data.protocol}</p>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-medium">{data.percentage}%</span> •{" "}
            <span className="font-medium">${data.tvl.toLocaleString()}</span>
          </p>
          {loading ? (
            <div className="h-3 w-24 bg-muted rounded animate-pulse mt-2" />
          ) : (
            <p className="text-sm text-primary font-medium mt-1">{formatAPY(displayApy)} APY</p>
          )}
        </div>
      );
    }
    return null;
  };

  useEffect(() => {
    let cancelled = false;
    async function getProtocolData() {
      if (!breakdown || !chain || !vault) return;
      try {
        setLoading(true);
        const tokenAddr =
          vault.token0?.wrapped?.address ??
          vault.token0?.wrappedAddress ??
          vault.token0?.address;
        const data = await fetchProtocolBreakdown(breakdown, tokenAddr);
        if (!cancelled) setBreakdownData(data);
      } catch (e) {
        if (!cancelled) setBreakdownData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    getProtocolData();
    return () => { cancelled = true; };
  }, [breakdown, chain, vault]);

  return (
    <Card>
      <CardHeader className="flex md:flex-row flex-col gap-3 justify-between">
        <div className="flex flex-col gap-3">
          <CardTitle>Vault Allocation Breakdown</CardTitle>
          <CardDescription>
            Distribution across protocols and strategies
          </CardDescription>
        </div>
        <div className="flex items-center justify-center">
          {
            // copy vault address
            vault && chain.blockExplorers?.default?.url && (
              <Link
                href={`${chain.blockExplorers.default.url}/address/${vault.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Badge className="p-2 px-3" variant="outline">
                  Vault Address {shortenAddress(vault.id)}{" "}
                  <ExternalLink className="inline" />
                </Badge>
              </Link>
            )
          }
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm text-muted-foreground">
          {strategy}
        </CardDescription>

        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={2}
                dataKey="value"
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    stroke={activeIndex === index ? "#ffffff" : "transparent"}
                    strokeWidth={activeIndex === index ? 2 : 0}
                    style={{
                      filter:
                        activeIndex === index
                          ? "drop-shadow(0 4px 12px rgba(0,0,0,0.3))"
                          : "none",
                      transform:
                        activeIndex === index ? "scale(1.05)" : "scale(1)",
                      transformOrigin: "center",
                      transition: "all 0.2s ease-in-out",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 space-y-2">
          {breakdown.map((item, index) => {
            const apiApy = (breakdownData?.[index] as any)?.apy as number | undefined;
            const displayApy = apiApy === 0 || apiApy == null ? apy : apiApy;
            return (
            <div
              key={item.protocol}
              className={`flex items-center justify-between p-4 rounded-lg transition-all duration-200 cursor-pointer ${
                activeIndex === index
                  ? "bg-muted border-2 shadow-md transform scale-[1.02]"
                  : "bg-muted/50 border-2 border-transparent hover:bg-muted/70"
              }`}
              style={{
                borderColor:
                  activeIndex === index
                    ? COLORS[index % COLORS.length]
                    : "transparent",
              }}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 rounded-full transition-all duration-200 ${
                    activeIndex === index ? "scale-125 shadow-lg" : ""
                  }`}
                  style={{
                    backgroundColor: COLORS[index % COLORS.length],
                    boxShadow:
                      activeIndex === index
                        ? `0 0 12px ${COLORS[index % COLORS.length]}40`
                        : "none",
                  }}
                />
                <div>
                  <p
                    className={`font-medium text-sm transition-colors duration-200 ${
                      activeIndex === index
                        ? "text-foreground"
                        : "text-foreground/90"
                    }`}
                  >
                    {item.protocol}
                  </p>
                  {loading ? (
                    <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                  ) : (
                    <p className="text-xs text-muted-foreground">{formatAPY(displayApy)} APY</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <p
                  className={`font-semibold text-lg transition-colors duration-200 ${
                    activeIndex === index
                      ? "text-foreground"
                      : "text-foreground/90"
                  }`}
                >
                  {item.percentage}%
                </p>
                {/* <p className="text-xs text-muted-foreground">
                  ${((totalTvl * item.percentage) / 100).toLocaleString()}
                </p> */}
                <Link
                  href={item.url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-4 text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
            </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  );
}
