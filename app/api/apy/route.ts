import { NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/utils/simple-api-cache";

const TAKARA_API = "/api/protocols/takara";
const YEI_API = "/api/protocols/yei";

function getVaultIdParam(req: Request) {
  const url = new URL(req.url);
  return url.searchParams.get("vaultId");
}

export async function GET(req: Request) {
  try {
    const vaultId = getVaultIdParam(req);
    const cacheKey = `apy:${vaultId || 'all'}`;
    const cached = getCached(cacheKey);
    if (cached) return NextResponse.json(cached);

    // Get origin from request
    const url = new URL(req.url);
    const origin = url.origin;

    const takaraUrl = vaultId ? `${origin}${TAKARA_API}?vaultId=${vaultId}` : `${origin}${TAKARA_API}`;
    const yeiUrl = vaultId ? `${origin}${YEI_API}?vaultId=${vaultId}` : `${origin}${YEI_API}`;

    console.log("Fetching APY data from:", { takaraUrl, yeiUrl });

    let takaraData, yeiData;
    let takaraError, yeiError;

    // Fetch Takara
    try {
      const takaraRes = await fetch(takaraUrl);
      if (!takaraRes.ok) {
        takaraError = `Takara API failed: ${takaraRes.status} ${takaraRes.statusText}`;
        takaraData = null;
      } else {
        takaraData = await takaraRes.json();
      }
    } catch (err) {
      takaraError = `Takara fetch error: ${err}`;
      takaraData = null;
    }

    // Fetch Yei
    try {
      const yeiRes = await fetch(yeiUrl);
      if (!yeiRes.ok) {
        yeiError = `Yei API failed: ${yeiRes.status} ${yeiRes.statusText}`;
        yeiData = null;
      } else {
        yeiData = await yeiRes.json();
      }
    } catch (err) {
      yeiError = `Yei fetch error: ${err}`;
      yeiData = null;
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
    let takaraApy, yeiApy;
    if (vaultId) {
      takaraApy = takaraData?.apy ?? 0;
      yeiApy = yeiData?.apy ?? 0;
    } else {
      takaraApy = Array.isArray(takaraData) && takaraData.length > 0
        ? takaraData.reduce((sum, v) => sum + (v.apy ?? 0), 0) / takaraData.length
        : 0;
      yeiApy = Array.isArray(yeiData) && yeiData.length > 0
        ? yeiData.reduce((sum, v) => sum + (v.apy ?? 0), 0) / yeiData.length
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
    // Top-level error
    return NextResponse.json({ error: `APY route failed: ${error}` }, { status: 500 });
  }
}
