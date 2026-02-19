import { Card } from "@/components/ui/card";
import { formatSharePrice, shortenAddress } from "@/lib/utils/format";
import type { Vault } from "@/lib/types";

interface VaultStatsCardsProps {
  vault: Vault;
}

export function VaultStatsCards({ vault }: VaultStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="bg-card border-border p-4 hover:border-primary/20 transition-all duration-300 hover:shadow-md">
        <div className="text-center">
          <div className="text-xl font-bold text-foreground mb-1">
            {formatSharePrice(vault.rate ? Number(vault.rate) / 1e18 : 1)}
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
          {/*
            Deposit Cap: The Vault type does not currently include a `depositCap` field.
            This data must come from the on-chain Teller contract (getTellerDepositCap or similar).
            To populate this: read the cap via `readContract` on the Teller ABI and pass it as a
            prop, or extend the Vault type with `depositCap?: bigint` populated during enrichment.
          */}
          <div className="text-xl font-bold text-foreground mb-1">
            –
          </div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            Deposit Cap
          </div>
        </div>
      </Card>
      <Card className="bg-card border-border p-4 hover:border-primary/20 transition-all duration-300 hover:shadow-md">
        <div className="text-center">
          {/*
            Yield Generated: Not directly available in the Vault type.
            Could be approximated as: (totalAssetDepositedRaw - totalAssetWithdrawnRaw)
            minus current TVL, but this requires subgraph data and accurate token pricing.
            To populate this: compute from vault.totalAssetDepositedRaw,
            vault.totalAssetWithdrawnRaw and the current TVL when subgraph data is available.
          */}
          <div className="text-xl font-bold text-foreground mb-1">
            –
          </div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            Yield Generated
          </div>
        </div>
      </Card>
    </div>
  );
}
