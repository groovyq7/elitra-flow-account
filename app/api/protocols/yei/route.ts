/**
 * Fetches APY data from the YEI lending protocol on Sei mainnet.
 * NOTE: This intentionally uses Sei MAINNET even though the app runs on testnets.
 * Rationale: We display real-world APY data from the live YEI protocol to show
 * projected vault yields. Deposits happen on testnets; this data is display-only.
 */
import { NextResponse } from 'next/server';
import { getCached, setCached } from "@/lib/utils/simple-api-cache";
import { createPublicClient, http } from 'viem';
import { sei } from 'viem/chains';
import yeiMarketAbi from '../../../../lib/abis/YeiMarket.json';
// On-chain config
const RPC_URL = process.env.RPC_URL || "https://evm-rpc.sei-apis.com";
const YEI_ADDRESS = '0x4a4d9abD36F923cBA0Af62A39C01dEC2944fb638';


const erc20Abi = [
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
] as const;

const client = createPublicClient({ chain: sei, transport: http(RPC_URL) });

const RAY = 1e27; // 1e27 scaler
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max));
const toNum = (v: unknown) => Number(v);

export type YeiVaultResult = {
  vaultId: string;
  apy: number;
  yieldScore: number;
  liquidityScore: number;
  protocol: string;
};

function computeUtilizationRate(totalBorrows: bigint, totalSupply: bigint): number {
  if (totalSupply === 0n) return 0;
  const ratioScaled = (totalBorrows * 1_000_000n) / totalSupply;
  return Number(ratioScaled) / 1_000_000;
}

function calculateLiquidityScore(utilizationRate: number): number {
  let score = utilizationRate * 80;
  if (utilizationRate > 0.9) score += 10;
  if (utilizationRate > 0.95) score += 10;
  return clamp(Math.round(score), 0, 100);
}

function calculateYieldScore(supplyApy: number, borrowApy: number, utilizationRate: number): number {
  const borrowRisk = Math.min(borrowApy, 120) * 0.4;
  const supplyRisk = Math.min(supplyApy, 60) * 0.2;
  const spread = borrowApy - supplyApy;
  const spreadRisk = spread < 1 ? 15 : spread < 2 ? 10 : spread < 3 ? 5 : 0;
  const utilSynergy = utilizationRate > 0.95 && borrowApy > 50 ? 25
                    : utilizationRate > 0.9 && borrowApy > 40 ? 15
                    : utilizationRate > 0.8 && borrowApy > 30 ? 8
                    : 0;
  const score = borrowRisk + supplyRisk + spreadRisk + utilSynergy;
  return clamp(Math.round(score), 0, 100);
}

/**
 * Core YEI data-fetching logic. Exported so the /api/apy route can call it
 * directly (server-to-server function call) instead of making an HTTP self-request.
 */
export async function fetchYeiData(
  filterVaultId: string | null
): Promise<YeiVaultResult | YeiVaultResult[]> {
  const cacheKey = `yei:${filterVaultId || 'all'}`;
  const cached = getCached(cacheKey);
  if (cached) return cached as YeiVaultResult | YeiVaultResult[];

  const reserves = await client.readContract({
    address: YEI_ADDRESS as `0x${string}`,
    abi: yeiMarketAbi,
    functionName: 'getReservesList',
  }) as readonly `0x${string}`[];

  const results: YeiVaultResult[] = [];

  for (const asset of reserves) {
    if (filterVaultId && asset.toLowerCase() !== filterVaultId) {
      continue;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await client.readContract({ // ABI-decoded reserve data struct — no generated type
        address: YEI_ADDRESS as `0x${string}`,
        abi: yeiMarketAbi,
        functionName: 'getReserveData',
        args: [asset],
      });

      const aToken = data.aTokenAddress as `0x${string}`;
      const varDebt = data.variableDebtTokenAddress as `0x${string}`;

      const zero = '0x0000000000000000000000000000000000000000';
      const [totalSupplyRaw, totalBorrowsRaw] = await Promise.all([
        aToken && aToken !== zero ? client.readContract({ address: aToken, abi: erc20Abi, functionName: 'totalSupply' }) as Promise<bigint> : Promise.resolve(0n),
        varDebt && varDebt !== zero ? client.readContract({ address: varDebt, abi: erc20Abi, functionName: 'totalSupply' }) as Promise<bigint> : Promise.resolve(0n),
      ]);

      const utilizationRate = computeUtilizationRate(totalBorrowsRaw, totalSupplyRaw);

      // Number(rayBigInt) / RAY: converting a ~1e25 BigInt to Number loses
      // precision in lower digits, but the result (a 0–1 decimal) is accurate
      // to >10 significant figures — well beyond what's needed for APY display.
      const supplyApy = (toNum(data.currentLiquidityRate) / RAY) * 100;
      const borrowApy = (toNum(data.currentVariableBorrowRate) / RAY) * 100;

      const liquidityScore = calculateLiquidityScore(utilizationRate);
      const yieldScore = calculateYieldScore(supplyApy, borrowApy, utilizationRate);

      results.push({ vaultId: asset, apy: supplyApy, yieldScore, liquidityScore, protocol: "yei" });
      if (filterVaultId) break;
    } catch {
      // Skip asset on error but continue others
      if (!filterVaultId) continue;
      // If filtering and an error occurs for the target vault, treat as not found
      throw new Error("Vault not found");
    }
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
    const vaultIdParam = url.searchParams.get('vaultId');
    const filterVaultId = vaultIdParam?.toLowerCase() || null;

    const result = await fetchYeiData(filterVaultId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Vault not found") {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to fetch YEI data' }, { status: 500 });
  }
}
