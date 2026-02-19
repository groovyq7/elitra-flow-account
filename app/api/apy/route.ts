import { NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/utils/simple-api-cache";
import { fetchTakaraData, type TakaraVaultResult } from "@/app/api/protocols/takara/route";
import { fetchYeiData, type YeiVaultResult } from "@/app/api/protocols/yei/route";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const vaultId = url.searchParams.get("vaultId");
    const filterVaultId = vaultId?.toLowerCase() || null;

    const cacheKey = `apy:${filterVaultId || 'all'}`;
    const cached = getCached(cacheKey);
    if (cached) return NextResponse.json(cached);

    // Call protocol data-fetching functions directly (no HTTP self-request)
    let takaraData: TakaraVaultResult | TakaraVaultResult[] | null = null;
    let yeiData: YeiVaultResult | YeiVaultResult[] | null = null;
    let takaraError: string | undefined;
    let yeiError: string | undefined;

    try {
      takaraData = await fetchTakaraData(filterVaultId);
    } catch (err) {
      takaraError = `Takara error: ${err}`;
    }

    try {
      yeiData = await fetchYeiData(filterVaultId);
    } catch (err) {
      yeiError = `Yei error: ${err}`;
    }

    // If either failed, return error with details
    if (takaraError || yeiError) {
      return NextResponse.json({
        error: "One or both protocol APIs failed",
        takaraError,
        yeiError,
        takara: takaraData,
        yei: yeiData,
      }, { status: 502 });
    }

    // Calculate APYs
    let takaraApy: number, yeiApy: number;
    if (filterVaultId) {
      takaraApy = (takaraData as TakaraVaultResult)?.apy ?? 0;
      yeiApy = (yeiData as YeiVaultResult)?.apy ?? 0;
    } else {
      const takaraArr = takaraData as TakaraVaultResult[];
      const yeiArr = yeiData as YeiVaultResult[];
      takaraApy = Array.isArray(takaraArr) && takaraArr.length > 0
        ? takaraArr.reduce((sum, v) => sum + (v.apy ?? 0), 0) / takaraArr.length
        : 0;
      yeiApy = Array.isArray(yeiArr) && yeiArr.length > 0
        ? yeiArr.reduce((sum, v) => sum + (v.apy ?? 0), 0) / yeiArr.length
        : 0;
    }

    const averageApy = (takaraApy + yeiApy) / 2;

    const result = {
      takara: takaraData,
      yei: yeiData,
      averageApy,
    };
    setCached(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: `APY route failed: ${error}` }, { status: 500 });
  }
}
