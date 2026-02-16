import type { ProtocolData, VaultBreakdown } from "@/lib/types";

/**
 * Fetch per-protocol APY/score data for a given vault across multiple protocols.
 * Keeps the ordering consistent with the provided breakdown list.
 */
export async function fetchProtocolBreakdown(
  breakdown: VaultBreakdown[],
  vaultAddress: string
): Promise<ProtocolData[]> {
  const results = await Promise.all(
    breakdown.map(async (item) => {
      const res = await fetch(`/api/protocols/${item.id}?vaultId=${vaultAddress}`);
      if (!res.ok) throw new Error(`Failed to fetch ${item.id}: ${res.status}`);
      return res.json();
    })
  );
  return results as ProtocolData[];
}
