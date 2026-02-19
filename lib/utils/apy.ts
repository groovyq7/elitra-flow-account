import { formatUnits } from "viem";

type RateSnapshot = { rate: bigint | string; timestamp: number };
const RATE_SCALE = BigInt("1000000000000000000"); // 1e18
const SECONDS_IN_YEAR = 31536000n;
const MAX_ABS = BigInt("1000000000000000000000"); // clamp |apy| <= 1e21 (~1000%)

function toBigInt(x: bigint | string): bigint {
  return typeof x === "bigint" ? x : BigInt(x);
}

function pick24hWindow(snapshots: RateSnapshot[], nowSec = Math.floor(Date.now() / 1000)) {
  if (!snapshots.length) return undefined;
  // Ensure descending by timestamp
  const s = [...snapshots].sort((a, b) => b.timestamp - a.timestamp);
  const latest = s[0];
  const cutoff = nowSec - (86400 * 3);
  // Anchor: last snapshot at or before cutoff
  const anchor = s.find((sn) => sn.timestamp <= cutoff) ?? s[s.length - 1]; // fallback oldest
  if (!anchor || anchor.timestamp === latest.timestamp) return undefined;
  return {
    r0: toBigInt(anchor.rate),
    t0: anchor.timestamp,
    r1: toBigInt(latest.rate),
    t1: latest.timestamp,
  };
}

export function computeApy24hLinear(
  snapshots: RateSnapshot[],
  nowSec?: number
): { apyScaled?: bigint; apy?: string; dt?: number } {
  const win = pick24hWindow(snapshots, nowSec);
  if (!win) return { apyScaled: undefined, apy: undefined, dt: undefined };
  const { r0, r1, t0, t1 } = win;
  if (r0 <= 0n || t1 <= t0) return { apyScaled: undefined, apy: undefined, dt: t1 - t0 };
  const dt = BigInt(t1 - t0);

  // simpleReturnScaled = (r1 - r0) / r0, scaled 1e18
  const simpleReturnScaled = ((r1 - r0) * RATE_SCALE) / r0;
  let apyScaled = (simpleReturnScaled * SECONDS_IN_YEAR) / dt; // 1e18-scaled, signed

  // clamp extremes
  if (apyScaled > MAX_ABS) apyScaled = MAX_ABS;
  if (apyScaled < -MAX_ABS) apyScaled = -MAX_ABS;

  return {
    apyScaled,
    apy: (Number(formatUnits(apyScaled, 18)) * 100).toString(), // percentage string (e.g., "8" = 8% APY)
    dt: Number(dt),
  };
}

/**
 * APY using user's formula:
 * ((r1 - r0) / dt) * SECONDS_IN_YEAR / r1
 * where r1 is the latest rate (current), r0 is ~24h ago.
 * Returns 1e18-scaled apy as bigint and string.
 */
export function computeApy24hLinearCurrentDenom(
  snapshots: RateSnapshot[],
  nowSec?: number
): { apyScaled?: bigint; apy?: string; dt?: number } {
  const win = pick24hWindow(snapshots, nowSec);
  if (!win) return { apyScaled: undefined, apy: undefined, dt: undefined };
  const { r0, r1, t0, t1 } = win;
  if (r1 <= 0n || t1 <= t0) return { apyScaled: undefined, apy: undefined, dt: t1 - t0 };
  const dt = BigInt(t1 - t0);

  // apyScaled = ((r1 - r0) / dt) * SECONDS_IN_YEAR / r1, all in 1e18 scale
  // Combine to maintain precision: ((r1 - r0) * 1e18 * SECONDS_IN_YEAR) / (dt * r1)
  let apyScaled = ((r1 - r0) * RATE_SCALE * SECONDS_IN_YEAR) / (dt * r1);

  // clamp extremes
  if (apyScaled > MAX_ABS) apyScaled = MAX_ABS;
  if (apyScaled < -MAX_ABS) apyScaled = -MAX_ABS;

  return {
    apyScaled,
    apy: formatUnits(apyScaled, 18),
    dt: Number(dt),
  };
}