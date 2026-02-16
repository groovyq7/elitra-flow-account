import { Card } from "@/components/ui/card";
import { formatAPY, formatTVL, formatSharePrice, shortenAddress } from "@/lib/utils/format";

interface VaultStatsCardsProps {
  vault: any;
}

export function VaultStatsCards({ vault }: VaultStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="bg-card border-border p-4 hover:border-primary/20 transition-all duration-300 hover:shadow-md">
        <div className="text-center">
          <div className="text-xl font-bold text-foreground mb-1">
            {formatSharePrice(vault.sharePrice)}
          </div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            Price
          </div>
        </div>
      </Card>
      <Card className="bg-card border-border p-4 hover:border-primary/20 transition-all duration-300 hover:shadow-md">
        <div className="text-center">
          <div className="text-sm font-mono text-foreground mb-1">
            {shortenAddress(vault.id)}
          </div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            Vault Address
          </div>
        </div>
      </Card>
      <Card className="bg-card border-border p-4 hover:border-primary/20 transition-all duration-300 hover:shadow-md">
        <div className="text-center">
          <div className="text-xl font-bold text-foreground mb-1">
            $1M
          </div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            Deposit Cap
          </div>
        </div>
      </Card>
      <Card className="bg-card border-border p-4 hover:border-primary/20 transition-all duration-300 hover:shadow-md">
        <div className="text-center">
          <div className="text-xl font-bold text-foreground mb-1">
            $12,000
          </div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            Yield Generated
          </div>
        </div>
      </Card>
    </div>
  );
}
