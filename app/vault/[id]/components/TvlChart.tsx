import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from "recharts";
import { formatTVL } from "@/lib/utils/format";

const mockTvlData = [
  { date: "2024-01-15", tvl: 850000 },
  { date: "2024-02-15", tvl: 920000 },
  { date: "2024-03-15", tvl: 1100000 },
  { date: "2024-04-15", tvl: 1250000 },
  { date: "2024-05-15", tvl: 1400000 },
  { date: "2024-06-15", tvl: 1320000 },
];

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
          {`$${payload[0].value.toLocaleString()}`}
        </p>
      </div>
    );
  }
  return null;
}

export function TvlChart() {
  return (
    <div className="h-32 w-full">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground uppercase tracking-wider">TVL</span>
        <span className="text-2xl font-bold text-sky-600">{formatTVL(mockTvlData[mockTvlData.length-1].tvl)}</span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={mockTvlData}>
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short" })}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="tvl" fill="#0ea5e9" radius={[2, 2, 0, 0]} opacity={0.8} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
