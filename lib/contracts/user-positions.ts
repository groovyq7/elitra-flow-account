import { fetchQuery } from "@/lib/utils/query";

// Cache for user position queries (1 minute TTL)
const USER_POS_TTL = 1;
const userPosCache: Record<string, { data: UserVaultPositionResult | null; timestamp: number; error?: any }> = {};

export interface UserVaultPositionResult {
  id: string;
  currentShareBalance: bigint;
  costBasis: bigint;
  realizedPnL: bigint;
  vault: {
    rate?: bigint;
    apy?: number;
  };
}

const USER_POSITION_QUERY = `
  query UserMetrics($userId: String, $vaultId: String) {
    UserVaultPosition(where: {user_id: {_eq: $userId}, vault_id: {_eq: $vaultId}}) {
      id
      currentShareBalance
      costBasis
      realizedPnL
      vault { 
        rate 
        apy 
      }
    }
  }
`;

function toBigIntSafe(v: any): bigint {
  try {
    if (v === null || v === undefined) return BigInt(0);
    if (typeof v === "bigint") return v;
    if (typeof v === "number") return BigInt(Math.trunc(v));
    if (typeof v === "string" && v.trim() !== "") return BigInt(v);
  } catch {}
  return BigInt(0);
}

export async function getUserVaultPositionFromSubgraph(userId: string, vaultId: string) {
  console.log("Fetching user vault position from subgraph:", userId, vaultId);
  if (!userId || !vaultId) {
    return { data: null, error: new Error("Invalid userId or vaultId"), cached: false };
  }
  const key = `${userId.toLowerCase()}:${vaultId.toLowerCase()}`;
  const now = Date.now();
  const cached = userPosCache[key];
  if (cached && now - cached.timestamp < USER_POS_TTL) {
    return { data: cached.data, error: cached.error, cached: true };
  }

  try {
    const { data, error } = await fetchQuery(USER_POSITION_QUERY, { userId: userId.toLowerCase(), vaultId: vaultId.toLowerCase() });
    if (error) throw error;
    const raw = data?.UserVaultPosition?.[0];
    if (!raw) {
      userPosCache[key] = { data: null, timestamp: now };
      return { data: null, error: null, cached: false };
    }
    const parsed: UserVaultPositionResult = {
      id: raw.id,
      currentShareBalance: toBigIntSafe(raw.currentShareBalance),
      costBasis: toBigIntSafe(raw.costBasis),
      realizedPnL: toBigIntSafe(raw.realizedPnL),
      vault: {
        rate: toBigIntSafe(raw.vault?.rate),
        apy: raw.vault?.apy ? raw.vault.apy : undefined,
      },
    };
    userPosCache[key] = { data: parsed, timestamp: Date.now() };
    return { data: parsed, error: null, cached: false };
  } catch (e: any) {
    userPosCache[key] = { data: null, timestamp: Date.now(), error: e };
    return { data: null, error: e, cached: false };
  }
}
