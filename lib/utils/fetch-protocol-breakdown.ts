import type { ProtocolData, VaultBreakdown } from "@/lib/types";

/**
 * Fetch per-protocol APY/score data for a given vault across multiple protocols.
 * Keeps the ordering consistent with the provided breakdown list.
 * Uses Promise.allSettled so that one failed protocol fetch does not abort the rest.
 */
export async function fetchProtocolBreakdown(
  breakdown: VaultBreakdown[],
  vaultAddress: string
): Promise<ProtocolData[]> {
  const results = await Promise.allSettled(
    breakdown.map(async (item) => {
      const res = await fetch(`/api/protocols/${item.id}?vaultId=${vaultAddress}`);
      if (!res.ok) throw new Error(`Failed to fetch ${item.id}: ${res.status}`);
      return res.json() as Promise<ProtocolData>;
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<ProtocolData> => {
      if (r.status === "rejected") {
        console.error("[fetchProtocolBreakdown] Protocol fetch failed:", r.reason);
        return false;
      }
      return true;
    })
    .map((r) => r.value);
}
