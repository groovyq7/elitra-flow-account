import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { formatCurrency } from "../../../lib/utils/format";
import React, { useMemo } from "react";
import { trackChartTimeframeSelected } from '@/lib/analytics'
import { generateCurvedChartData, generateHoldingComparisonData } from "@/lib/utils/chart-data";

export function GrowthChart({
  initialBalance,
  totalAPY,
  chartTimeframe,
  setChartTimeframe,
  show,
  fullWidth = false,
  isActive = true,
}: {
  initialBalance: number;
  totalAPY: number;
  chartTimeframe: "30d" | "6m" | "1y" | "3y";
  setChartTimeframe: (v: "30d" | "6m" | "1y" | "3y") => void;
  show: boolean;
  fullWidth?: boolean;
  isActive?: boolean;
}) {
  const chartData = useMemo(() => {
      const stakingData = generateCurvedChartData(
        new Date().toISOString().slice(0, 10),
        12,
        initialBalance,
        totalAPY,
        "weekly"
      );
  
      const holdingData = generateHoldingComparisonData(
        stakingData,
        initialBalance
      );
  
      // Combine into the format your chart expects
      return stakingData.map((staking, index) => ({
        date: staking.date,
        holding: holdingData[index].value,
        staking: staking.value,
      }));
    }, [initialBalance, totalAPY]);
  
    const chartData6m = useMemo(() => {
      const stakingData = generateCurvedChartData(
        new Date().toISOString().slice(0, 10),
        26,
        initialBalance,
        totalAPY,
        "weekly"
      );
  
      const holdingData = generateHoldingComparisonData(
        stakingData,
        initialBalance
      );
  
      return stakingData.map((staking, index) => ({
        date: staking.date,
        holding: holdingData[index].value,
        staking: staking.value,
      }));
    }, [initialBalance, totalAPY]);
  
    const chartData1y = useMemo(() => {
      const stakingData = generateCurvedChartData(
        new Date().toISOString().slice(0, 10),
        52,
        initialBalance,
        totalAPY,
        "weekly"
      );
  
      const holdingData = generateHoldingComparisonData(
        stakingData,
        initialBalance
      );
  
      return stakingData.map((staking, index) => ({
        date: staking.date,
        holding: holdingData[index].value,
        staking: staking.value,
      }));
    }, [initialBalance, totalAPY]);
  
    const chartData3y = useMemo(() => {
      // For 3 years, use monthly data to avoid too many points
      const stakingData = generateCurvedChartData(
        new Date().toISOString().slice(0, 10),
        36,
        initialBalance,
        totalAPY,
        "monthly"
      );
  
      const holdingData = generateHoldingComparisonData(
        stakingData,
        initialBalance
      );
  
      return stakingData.map((staking, index) => ({
        date: staking.date,
        holding: holdingData[index].value,
        staking: staking.value,
      }));
    }, [initialBalance, totalAPY]);

  if (!show) return null;

  return (
  <Card className={`bg-white border border-gray-200 shadow-md h-full ${fullWidth ? "w-full" : ""}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <BarChart3 className="w-5 h-5 text-gray-500" />
            Growth
          </CardTitle>
          <Tabs
            value={chartTimeframe}
            onValueChange={(value) => {
              const tf = value as '30d' | '6m' | '1y' | '3y'
              trackChartTimeframeSelected(tf)
              setChartTimeframe(tf)
            }}
          >
            <TabsList className="bg-gray-100 border border-gray-200">
              <TabsTrigger value="30d">30d</TabsTrigger>
              <TabsTrigger value="6m">6m</TabsTrigger>
              <TabsTrigger value="1y">1y</TabsTrigger>
              <TabsTrigger value="3y">3y</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={
                chartTimeframe === "30d"
                  ? chartData
                  : chartTimeframe === "6m"
                  ? chartData6m
                  : chartTimeframe === "1y"
                  ? chartData1y
                  : chartData3y
              }
            >
              <defs>
                {/* <linearGradient
                  id="holdingGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="#3b82f6"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="#3b82f6"
                    stopOpacity={0}
                  />
                </linearGradient> */}
                <linearGradient
                  id="stakingGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="#06b6d4"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="#06b6d4"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={false}
              />
              <YAxis hide />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const holding = payload.find(
                      (p) => p.dataKey === "holding"
                    );
                    const staking = payload.find(
                      (p) => p.dataKey === "staking"
                    );
                    return (
                      <div className="bg-white p-3 border rounded-lg shadow-lg">
                        <p className="text-sm font-medium text-gray-900">
                          {label
                            ? new Date(label).toLocaleDateString(
                                "en-US",
                                {
                                  month: "long",
                                  day: "numeric",
                                  year: "numeric",
                                }
                              )
                            : ""}
                        </p>
                        <div className="flex flex-col gap-1 mt-2">
                          {/* <span className="text-xs text-blue-600 font-semibold">
                            Holding: {" "}
                            {holding
                              ? formatCurrency(holding.value)
                              : "-"}
                          </span> */}
                          <span className="text-xs text-cyan-600 font-semibold">
                            {isActive ? 'Active' : 'Inactive'}: {" "}
                            {staking
                              ? formatCurrency(staking.value)
                              : "-"}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* <Area
                type="monotone"
                dataKey="holding"
                stroke="#3b82f6"
                fill="url(#holdingGradient)"
                strokeWidth={2}
                dot={false}
              /> */}
              <Area
                type="monotone"
                dataKey="staking"
                stroke="#06b6d4"
                fill="url(#stakingGradient)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
