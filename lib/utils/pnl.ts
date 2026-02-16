// Safe pow10 for BigInt without using ** (avoids TS target complaints)
function pow10(decimals: number): bigint {
  if (decimals <= 0) return 1n;
  let r = 1n;
  for (let i = 0; i < decimals; i++) r *= 10n;
  return r;
}

function formatUnits(value: bigint, decimals: number): string {
  if (decimals === 0) return value.toString();
  const neg = value < 0n;
  const v = neg ? -value : value;
  const base = pow10(decimals);
  const whole = v / base;
  const frac = v % base;
  if (frac === 0n) return (neg ? "-" : "") + whole.toString();
  let fracStr = frac.toString().padStart(decimals, "0");
  while (fracStr.endsWith("0")) fracStr = fracStr.slice(0, -1);
  return (neg ? "-" : "") + whole.toString() + "." + fracStr;
}

const RATE_SCALE = 1000000000000000000n; // 1e18

export interface PositionPnLInput {
  shareBalance: bigint;
  rate: bigint;        // scaled 1e18
  costBasis: bigint;   // raw underlying units
  realizedPnL: bigint; // raw underlying units
  assetDecimals: number;
  extraPrecision?: number;
}

export interface PositionPnLResult {
  underlyingValueRaw: bigint;
  unrealizedPnLRaw: bigint;
  totalPnLRaw: bigint;
  pnlPctScaled?: bigint; // ratio scaled 1e18
  underlyingValue: string;
  costBasis: string;
  realizedPnL: string;
  unrealizedPnL: string;
  totalPnL: string;
  pnlPct?: string;       // ratio (e.g. 0.12 = 12%)
}

export function computePositionPnL(input: PositionPnLInput): PositionPnLResult {
  const {
    shareBalance,
    rate,
    costBasis,
    realizedPnL,
    assetDecimals,
    extraPrecision = 0,
  } = input;

  const precisionMul = extraPrecision > 0 ? pow10(extraPrecision) : 1n;
  // underlyingValueRaw = shares * rate / 1e18 (with optional extra precision)
  const underlyingValueRaw =
    (shareBalance * rate * precisionMul) / RATE_SCALE / precisionMul;

  const unrealizedPnLRaw = underlyingValueRaw - costBasis;
  const totalPnLRaw = realizedPnL + unrealizedPnLRaw;

  let pnlPctScaled: bigint | undefined;
  if (costBasis > 0n) {
    pnlPctScaled = (totalPnLRaw * RATE_SCALE) / costBasis;
  }

  return {
    underlyingValueRaw,
    unrealizedPnLRaw,
    totalPnLRaw,
    pnlPctScaled,
    underlyingValue: formatUnits(underlyingValueRaw, assetDecimals),
    costBasis: formatUnits(costBasis, assetDecimals),
    realizedPnL: formatUnits(realizedPnL, assetDecimals),
    unrealizedPnL: formatUnits(unrealizedPnLRaw, assetDecimals),
    totalPnL: formatUnits(totalPnLRaw, assetDecimals),
    pnlPct: pnlPctScaled !== undefined
      ? formatUnits(pnlPctScaled, 18) // still a ratio
      : undefined,
  };
}

// Example:
// const res = computePositionPnL({
//   shareBalance: 500n * pow10(18),
//   rate: 1200000000000000000n, // 1.2
//   costBasis: 550n * pow10(18),
//   realizedPnL: 0n,
//   assetDecimals: 18
// });