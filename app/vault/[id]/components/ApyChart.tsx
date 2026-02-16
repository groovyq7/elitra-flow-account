import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts";
import { formatAPY } from "@/lib/utils/format";
import { useMemo, useState } from "react";

// Utility helpers
function formatDate(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

interface ApyPoint { date: string; apy: number }
interface ApyDataMap { [k: string]: ApyPoint[] }

function generateApyData(initialApy: number): ApyDataMap {
  const growthPerPoint = 0.04; // +0.04 APY per data point
  const now = new Date();

  // 30d: weekly points (5 points)
  const d30: ApyPoint[] = Array.from({ length: 5 }).map((_, i) => ({
    date: formatDate(addDays(now, i * 7)),
    apy: +(initialApy + i * growthPerPoint).toFixed(2),
  }));

  // 6m: monthly points (6 points)
  const m6: ApyPoint[] = Array.from({ length: 6 }).map((_, i) => ({
    date: formatDate(addMonths(now, i)),
    apy: +(initialApy + i * (growthPerPoint * 6)).toFixed(2),
  }));

  // 1y: quarterly (every 3 months) (5 points ~ 0,3,6,9,12)
  const y1: ApyPoint[] = Array.from({ length: 5 }).map((_, i) => ({
    date: formatDate(addMonths(now, i * 3)),
    apy: +(initialApy + i * (growthPerPoint * 12)).toFixed(2),
  }));

  // 3y: yearly (4 points 0,12,24,36 months)
  const y3: ApyPoint[] = Array.from({ length: 4 }).map((_, i) => ({
    date: formatDate(addMonths(now, i * 12)),
    apy: +(initialApy + i * (growthPerPoint * 36)).toFixed(2),
  }));

  return { "30d": d30, "6m": m6, "1y": y1, "3y": y3 };
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
        <p className="text-sm text-gray-600 mb-1">
          {new Date(label).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
        <p className="text-sm font-semibold text-gray-900">
          {`${payload[0].value}%`}
        </p>
      </div>
    );
  }
  return null;
}

export function ApyChart({ initialApy = 6 }: { initialApy?: number }) {
  const [timeframe, setTimeframe] = useState<"30d" | "6m" | "1y" | "3y">("30d");
  const apyData = useMemo(() => generateApyData(initialApy), [initialApy]);
  const data = apyData[timeframe];
  const latest = data[data.length - 1];
  return (
    <div className="h-32 w-full">
      <div className="flex items-center justify-between mb-2 px-4">
        <span className="text-md text-muted-foreground uppercase tracking-wider">APY</span>
        <span className="text-2xl font-bold text-sky-600">{formatAPY(latest.apy)}</span>
      </div>
      <div className="flex gap-2 px-4 mb-2">
        {(["30d", "6m", "1y", "3y"] as const).map((tf) => (
          <button
            key={tf}
            className={`px-2 py-0.5 rounded-full text-xs font-semibold border transition-colors ${timeframe === tf ? "bg-blue-600 text-white border-blue-600" : "bg-white text-blue-600 border-blue-200 hover:bg-blue-50"}`}
            onClick={() => setTimeframe(tf)}
          >
            {tf.toUpperCase()}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            hide
            tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short" })}
          />
          <Tooltip content={<CustomTooltip />} />
          <defs>
            <linearGradient id="apyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="apy" stroke="#0ea5e9" strokeWidth={2} fill="url(#apyGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
