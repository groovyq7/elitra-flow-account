import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, PieChart, Calendar, ShieldAlert, Coins, ExternalLink } from "lucide-react";
import { formatTVL } from "@/lib/utils/format";
import { VaultBreakdown } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";

interface KeyMetricsCardProps {
  apy: string | number;
  tvl: string | number;
  risk: string;
  launchDate: string;
  assets: string;
  protocols: VaultBreakdown[];
}

export function KeyMetricsCard({
  apy,
  tvl,
  launchDate,
  risk,
  assets,
  protocols,
}: KeyMetricsCardProps) {
  return (
    <Card className="p-6 flex flex-col justify-center gap-2 min-w-[220px] hover:border-primary/20 transition-all duration-300 hover:shadow-lg">
      <div className="flex justify-between items-center text-sm mb-1">
        <span className="flex items-center gap-2 text-muted-foreground">
          <TrendingUp className="w-4 h-4 text-gray-600" /> APY
        </span>
        <span className="font-bold">{apy}</span>
      </div>
      <div className="flex justify-between items-center text-sm mb-1">
        <span className="flex items-center gap-2 text-muted-foreground">
          <PieChart className="w-4 h-4 text-gray-600" /> TVL
        </span>
        <span className="font-bold">{formatTVL(Number(tvl))}</span>
      </div>
      <div className="flex justify-between items-center text-sm mb-1">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="w-4 h-4 text-gray-600" /> Launch
        </span>
        <span className="font-bold">{launchDate}</span>
      </div>
      <div className="flex justify-between items-center gap-2 mb-1">
        <span className="flex items-center gap-2 text-muted-foreground text-sm">
          <ShieldAlert className="w-4 h-4 text-gray-600 inline-block" />
           Risk
        </span>
        <span className="inline-flex items-center gap-2 px-3 rounded-full border border-green-500 text-green-700 font-bold text-sm bg-transparent">
          {risk}
        </span>
      </div>

      <div className="flex justify-between items-center gap-2 mb-1">
        <span className="flex items-center gap-2 text-muted-foreground text-sm">
          <Coins className="w-4 h-4 text-gray-600 inline-block" />
          Assets
        </span>
        <Badge
          variant="secondary"
          className="rounded-full px-3 py-1 text-xs font-semibold"
        >
          {assets}
        </Badge>
      </div>
      <Separator className="my-1" />

      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">Protocols</span>
        <div className="flex flex-col gap-1 items-end">
          {protocols.map((p) => (
            <Link href={p.url || "#"} target="_blank" className="flex w-fit gap-2 items-center justify-end px-2 py-1 hover:bg-muted rounded-lg" key={p.protocol}>
              <ExternalLink className="w-4 h-4 text-gray-800" />
              <span className="font-semibold text-right text-foreground text-sm mt-1">
                {p.protocol}
              </span>

              <img
                src={p.logo || "/placeholder.svg"}
                alt={p.protocol}
                className="w-5 h-5 rounded-full"
              />
            </Link>
          ))}
        </div>
      </div>
    </Card>
  );
}
