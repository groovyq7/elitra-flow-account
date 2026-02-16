import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export const getTokenImage = (symbol: string | undefined) => {
  if (symbol == null || typeof symbol !== "string") return null;
  const tokenImages: { [key: string]: string } = {
    SEI: "https://app.yei.finance/icons/tokens/sei.svg",
    ETH: "https://app.yei.finance/icons/tokens/weth.svg",
    WETH: "https://app.yei.finance/icons/tokens/weth.svg",
    BTC: "https://citrea.elitra.xyz/images/tokens/cbtc.jpg",
    WBTC: "https://citrea.elitra.xyz/images/tokens/cbtc.jpg",
    SUMA: "https://www.satsuma.exchange/satsuma-logo.svg",
    VESUMA: "https://www.satsuma.exchange/(x)satsuma-logo.png",
    NUSD: "https://www.satsuma.exchange/nusd-icon.svg",
    ENUSD: "https://www.satsuma.exchange/nusd-icon.svg",
    WSEI: "https://app.yei.finance/icons/tokens/sei.svg",
    USDC: "https://app.yei.finance/icons/tokens/usdc.svg",
    USDT: "https://app.yei.finance/icons/tokens/usdt.svg",
    ESEI: "https://app.yei.finance/icons/tokens/sei.svg",
    EWSEI: "https://app.yei.finance/icons/tokens/sei.svg",
    EUSDC: "https://app.yei.finance/icons/tokens/usdc.svg",
    EUSDT: "https://app.yei.finance/icons/tokens/usdt.svg",
    EWCBTC: "https://citrea.elitra.xyz/images/tokens/cbtc.jpg",
    ECBTC: "https://citrea.elitra.xyz/images/tokens/cbtc.jpg",
    CBTC: "https://citrea.elitra.xyz/images/tokens/cbtc.jpg",
    WCBTC: "https://citrea.elitra.xyz/images/tokens/cbtc.jpg",
  };
  return tokenImages[symbol.toUpperCase()] ?? null;
};
