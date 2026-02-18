export function formatTokenAmount(amount: bigint | number | string, decimals = 18, displayDecimals = 6): string {
  const value = typeof amount === "bigint" ? Number(amount) / Math.pow(10, decimals) : Number(amount);

  if (isNaN(value) || !isFinite(value)) return "0";
  if (value === 0) return "0";
  if (value < 0.000001) return "<0.000001";

  // If value is less than 1 and displayDecimals is less than 6, force at least 6 decimals
  const decimalsToShow = value > 0 && value < 1 && displayDecimals < 6 ? 6 : displayDecimals;

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimalsToShow,
  }).format(value);
}

export function formatAPY(apy: number | string): string {
  const val = Number(apy);
  if (isNaN(val) || !isFinite(val)) return "0.00%";
  return `${val.toFixed(2)}%`
}

export function formatTVL(tvl: number): string {
  if (!tvl) return "$0.00"
  if (tvl >= 1_000_000_000) {
    return `$${(tvl / 1_000_000_000).toFixed(2)}B`
  }
  if (tvl >= 1_000_000) {
    return `$${(tvl / 1_000_000).toFixed(2)}M`
  }
  if (tvl >= 1_000) {
    return `$${(tvl / 1_000).toFixed(2)}K`
  }
  return `$${tvl.toFixed(2)}`
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return ""
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function formatSharePrice(price: number): string {
  if (isNaN(price) || !isFinite(price)) return "0.000000";
  return price.toFixed(6)
}

export function formatCurrency(amount: number | string): string {
  const numericAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!numericAmount || isNaN(numericAmount) || !isFinite(numericAmount)) return "$0.00"

  if (numericAmount >= 1_000_000_000) {
    return `$${(numericAmount / 1_000_000_000).toFixed(2)}B`
  }
  if (numericAmount >= 1_000_000) {
    return `$${(numericAmount / 1_000_000).toFixed(2)}M`
  }
  if (numericAmount >= 1_000) {
    return `$${(numericAmount / 1_000).toFixed(2)}K`
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericAmount)
}

export function formatPercentage(percentage: number | string): string {
  const val = Number(percentage);
  if (isNaN(val) || !isFinite(val)) return "0.00%";
  return `${val.toFixed(2)}%`
}


export const abbreviateNumber = (
  num: string | number | undefined,
  decimalPlace = 2,
) => {
  if (!num) return "0"
  if (+num >= 1000000000) {
    return (
      (+num / 1000000000).toPrecision(decimalPlace).replace(/\.0$/, "") + "B"
    )
  }
  if (+num >= 1000000) {
    return (+num / 1000000).toFixed(decimalPlace).replace(/\.0$/, "") + "M"
  }
  if (+num >= 1000) {
    return (+num / 1000).toFixed(decimalPlace).replace(/\.0$/, "") + "K"
  }
  return (+num).toFixed(decimalPlace)
}

const toSubscript = (num: number) => {
  const subscriptDigits = "₀₁₂₃₄₅₆₇₈₉" // Unicode subscript digits
  return num
    .toString()
    .split("")
    .map(digit => subscriptDigits[parseInt(digit, 10)])
    .join("")
}

export function toFixedDown(num: number, digits: number) {
  let factor = 10 ** digits // Shift decimal point
  return (Math.floor(num * factor) / factor).toFixed(digits)
}

export const formatPrice = (
  val: string | number | undefined,
  decimalPlace = 2,
  shouldAbbrivate = true,
  canRoundUp = false,
): string => {
  const num = Number(val)
  if (isNaN(num)) return "0"
  if (num === 0) return "0"

  // For numbers smaller than 1, calculate the number of decimals to show.
  if (Math.abs(num) < 1) {
    const decimals = Math.max(2 - Math.floor(Math.log10(Math.abs(num))) - 1, 0)
    const number = canRoundUp ? num.toFixed(decimals) : toFixedDown(num, decimals)
    const finalNumber = number.replace(/\.0+$/, "") // Remove trailing zeroes
    if (+finalNumber >= 0.00001) return finalNumber
    const match = finalNumber.match(/^0\.0+(?!0)(\d)/)
    if (!match) return finalNumber
    const zeroCount = match[0].length - 3
    const firstNonZero = match[1]
    return `0.0${toSubscript(zeroCount)}${firstNonZero}`
  }

  if (shouldAbbrivate) {
    // For numbers >= 1, abbreviate if it's a large number (thousands, millions, billions)
    if (num >= 1000000000) {
      const number = canRoundUp
        ? (num / 1000000000).toFixed(2)
        : toFixedDown(num / 1000000000, 2)
      return number.replace(/\.0+$/, "") + "B" // Remove trailing zeroes
    }
    if (num >= 1000000) {
      const number = canRoundUp
        ? (num / 1000000).toFixed(2)
        : toFixedDown(num / 1000000, 2)
      return number.replace(/\.0+$/, "") + "M" // Remove trailing zeroes
    }
    if (num >= 1000) {
      const number = canRoundUp
        ? (num / 1000).toFixed(2)
        : toFixedDown(num / 1000, 2)
      return number.replace(/\.0+$/, "") + "K" // Remove trailing zeroes
    }
  }

  // For numbers less than 1000, return the number with `decimalPlace` decimals, removing trailing zeros
  const number = canRoundUp
    ? num.toFixed(decimalPlace)
    : toFixedDown(num, decimalPlace)
  return number.replace(/\.0+$/, "") // Remove trailing zeroes
}