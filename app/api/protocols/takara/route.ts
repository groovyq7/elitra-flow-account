import { NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/utils/simple-api-cache";
import { createPublicClient, http } from "viem";
import { sei } from "viem/chains";
import takaraMarketAbi from "../../../../lib/abis/TakaraMarketState.json";

const RPC_URL = process.env.RPC_URL || "https://evm-rpc.sei-apis.com";
const TAKARA_ADDRESS = "0x323917A279B209754B32Ab57a817c64ECfE2AF40";

const client = createPublicClient({
  chain: sei,
  transport: http(RPC_URL),
});

const BLOCKS_PER_YEAR = 63073838 / 2;

export type TakaraVaultResult = {
  vaultId: string;
  apy: number;
  yieldScore: number;
  liquidityScore: number;
  protocol: string;
  risk: "low" | "moderate" | "high";
};

// Minimal APY calculation
function calculateApy(
  ratePerBlock: bigint,
  blocksPerYear: bigint,
  decimals: number = 18
): number {
  const rate = Number(ratePerBlock) / 10 ** decimals;
  const blocks = Number(blocksPerYear);
  return (Math.pow(1 + rate, blocks) - 1) * 100;
}

// Minimal liquidity score
function calculateLiquidityScore(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  market: any, // ABI-decoded market struct — viem returns unknown shape
  utilizationRate: number,
  price: string
): number {
  let score = 0;
  score += utilizationRate * 50;
  if (!price || price === "0") score += 30;
  const symbol = market.symbol?.toLowerCase() || "";
  const isStablecoin = ["usdc", "usdt", "dai", "frax", "busd"].some(
    (stable) => symbol.includes(stable)
  );
  if (!isStablecoin) score += 20;
  const ltv = Number(market.ltv) / 10000;
  score += ltv * 20;
  // Normalize between 0 and 120
  return Math.max(0, Math.min(score, 120));
}

// Minimal yield score
function calculateYieldScore(
  supplyApy: number,
  borrowApy: number,
  utilizationRate: number
): number {
  let score = 0;
  score += Math.min(supplyApy, 100) * 0.3;
  score += Math.min(borrowApy, 200) * 0.15;
  const spread = borrowApy - supplyApy;
  if (spread < 2) score += 20;
  if (utilizationRate > 0.8 && borrowApy > 30) score += 20;
  // Normalize between 0 and 100
  return Math.max(0, Math.min(score, 100));
}

function getRiskStatus(
  score: number,
  type: "liquidity" | "yield"
): "low" | "moderate" | "high" {
  if (type === "liquidity") {
    if (score <= 40) return "low";
    if (score <= 80) return "moderate";
    return "high";
  } else {
    if (score <= 33) return "low";
    if (score <= 66) return "moderate";
    return "high";
  }
}

/**
 * Core Takara data-fetching logic. Exported so the /api/apy route can call it
 * directly (server-to-server function call) instead of making an HTTP self-request.
 */
export async function fetchTakaraData(
  filterVaultId: string | null
): Promise<TakaraVaultResult | TakaraVaultResult[]> {
  const cacheKey = `takara:${filterVaultId || "all"}`;
  const cached = getCached(cacheKey);
  if (cached) return cached as TakaraVaultResult | TakaraVaultResult[];

  const takaraMarkets = await client.readContract({
    address: TAKARA_ADDRESS as `0x${string}`,
    abi: takaraMarketAbi,
    functionName: "getActiveMarketsInfo",
  });

  const results: TakaraVaultResult[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const market of takaraMarkets as any[]) { // ABI-decoded tuple array — no generated type available
    const underlying =
      (market.underlying as string | undefined)?.toLowerCase() || "";

    // If filtering by vaultId, skip non-matching markets early
    if (filterVaultId && underlying !== filterVaultId) continue;

    const supplyApy = calculateApy(
      BigInt(market.supplyRatePerBlock),
      BigInt(BLOCKS_PER_YEAR),
      18
    );
    const borrowApy = calculateApy(
      BigInt(market.borrowRatePerBlock),
      BigInt(BLOCKS_PER_YEAR),
      18
    );
    const totalSupply = market.totalSupply
      ? market.totalSupply.toString()
      : "0";
    const totalBorrows = market.totalBorrows
      ? market.totalBorrows.toString()
      : "0";
    const utilizationRate =
      Number(totalSupply) > 0
        ? Number(totalBorrows) / Number(totalSupply)
        : 0;
    const price = market.price?.toString() ?? "0";

    const liquidityScore = calculateLiquidityScore(
      market,
      utilizationRate,
      price
    );
    const yieldScore = calculateYieldScore(
      supplyApy,
      borrowApy,
      utilizationRate
    );

    // Best practice: use the higher risk status
    const riskStatus = (() => {
      const liquidityRisk = getRiskStatus(liquidityScore, "liquidity");
      const yieldRisk = getRiskStatus(yieldScore, "yield");
      if (liquidityRisk === "high" || yieldRisk === "high") return "high";
      if (liquidityRisk === "moderate" || yieldRisk === "moderate")
        return "moderate";
      return "low";
    })();

    results.push({
      vaultId: market.underlying,
      apy: supplyApy,
      yieldScore,
      liquidityScore,
      risk: riskStatus,
      protocol: "takara",
    });

    // If filtering and we found the match, we can break early
    if (filterVaultId) break;
  }

  if (filterVaultId) {
    if (results.length === 0) throw new Error("Vault not found");
    setCached(cacheKey, results[0]);
    return results[0];
  }
  setCached(cacheKey, results);
  return results;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const vaultIdParam = url.searchParams.get("vaultId");
    const filterVaultId = vaultIdParam?.toLowerCase() || null;

    const result = await fetchTakaraData(filterVaultId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Vault not found") {
      return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to fetch vault data" },
      { status: 500 }
    );
  }
}
