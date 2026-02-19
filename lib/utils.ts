import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import {
  CBTC_LOGO_URI,
  SEI_LOGO_URI,
  WETH_LOGO_URI,
  USDC_LOGO_URI,
  USDT_LOGO_URI,
  NUSD_LOGO_URI,
} from "@/lib/constants"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export const getTokenImage = (symbol: string | undefined) => {
  if (symbol == null || typeof symbol !== "string") return null;
  const tokenImages: { [key: string]: string } = {
    SEI: SEI_LOGO_URI,
    ETH: WETH_LOGO_URI,
    WETH: WETH_LOGO_URI,
    BTC: CBTC_LOGO_URI,
    WBTC: CBTC_LOGO_URI,
    SUMA: "https://www.satsuma.exchange/satsuma-logo.svg",
    VESUMA: "https://www.satsuma.exchange/(x)satsuma-logo.png",
    NUSD: NUSD_LOGO_URI,
    ENUSD: NUSD_LOGO_URI,
    WSEI: SEI_LOGO_URI,
    USDC: USDC_LOGO_URI,
    USDT: USDT_LOGO_URI,
    ESEI: SEI_LOGO_URI,
    EWSEI: SEI_LOGO_URI,
    EUSDC: USDC_LOGO_URI,
    EUSDT: USDT_LOGO_URI,
    EWCBTC: CBTC_LOGO_URI,
    ECBTC: CBTC_LOGO_URI,
    CBTC: CBTC_LOGO_URI,
    WCBTC: CBTC_LOGO_URI,
  };
  return tokenImages[symbol.toUpperCase()] ?? null;
};
