import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { getTokenImage } from "@/lib/utils";
import {
  formatAPY,
  formatCurrency,
  formatPercentage,
  formatPrice,
} from "@/lib/utils/format";
import React, { useEffect, useState } from "react";
import {
  getTokenPrice,
  getTokenSupply,
  getVaultRate,
} from "@/lib/utils/get-token-balance";
import { useConfig } from "wagmi";
import { Vault } from "@/lib/types";
import { zeroAddress } from "viem";

interface OpportunitiesListProps {
  availableVaults: Vault[];
}

export const OpportunitiesList: React.FC<OpportunitiesListProps> = ({
  availableVaults,
}) => {
  const chain = useConfig().getClient().chain;
  const [vaultData, setVaultData] = useState<
    { id: string; tvl: number; rate: number; price: number }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    async function getVaultsTVL() {
      const _vaultData = await Promise.all(
        availableVaults.map(async (vault) => {
          const supply = await getTokenSupply(vault.id || "", chain);
          const rate = await getVaultRate(vault.symbol, chain);
          const price = await getTokenPrice(vault.token0?.symbol || "");
          const tvl =
            Number(supply.formatted) * Number(rate.rate) * Number(price.price);
          return {
            id: vault.id,
            tvl: tvl,
            rate: Number(rate.rate),
            price: Number(price.price),
          };
        })
      );
      if (!cancelled) setVaultData(_vaultData);
    }
    getVaultsTVL();
    return () => { cancelled = true; };
  }, [availableVaults, chain]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          Live Yields
        </h3>
        <Badge variant="outline" className="text-sm border-border">
          {availableVaults.filter((v) => !v.symbol?.toUpperCase().includes("NUSD")).length} Available
        </Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {availableVaults
          .filter((vault) => !vault.symbol?.toUpperCase().includes("NUSD"))
          .map((vault) => (
          <Card
            key={`${vault.id}-${vault.token0?.symbol}`}
            className="hover:shadow-md transition-shadow duration-300 bg-white border border-gray-200 flex flex-col justify-between"
          >
            <CardHeader className="space-y-3 pb-0">
              <div className="flex items-center gap-3">
                <Image
                  src={
                    getTokenImage(vault.token0?.symbol || "") ||
                    "/placeholder.png"
                  }
                  alt={vault.token0?.symbol || vault.name}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
                <div>
                  <CardTitle className="text-lg text-foreground">
                    {vault.name}
                  </CardTitle>
                  <div className="flex gap-1 mt-1">
                    {vault.token0 && (
                      <Badge variant="secondary" className="text-xs">
                        {vault.token0.symbol}
                      </Badge>
                    )}
                    {vault.token1 && (
                      <Badge variant="secondary" className="text-xs">
                        {vault.token1.symbol}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Current APY
                </span>
                <span className="text-lg font-bold text-blue-600">
                  {formatAPY(Number(vault.apy))}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {vault?.shortDescription || vault?.strategyDescription || "This vault provides optimized yield strategies for your assets."}
              </p>
              
            </CardContent>
            <CardFooter className="w-full gap-3 flex flex-col items-start">
              <div className="text-sm">
                <span className="text-muted-foreground">TVL:</span>
                <span className="ml-1 font-medium text-foreground">
                  $
                  {formatPrice(
                    vaultData.find((item) => item.id === vault.id)?.tvl || 0
                  )}
                </span>
              </div>
              <Link href={`/vault/${vault.id}`} className="w-full">
                <Button className="w-full cursor-pointer" variant="secondary">
                  See Details
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};
