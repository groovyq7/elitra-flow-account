import {
  Address,
  Chain,
  createPublicClient,
  erc20Abi,
  formatUnits,
  http,
  zeroAddress,
} from "viem";
import { readContract } from "viem/actions";
import { getAddresses } from "../constants";
import EliteraAccountantAbi from "../abis/EliteraAccountant.json";

// Simple in-memory caches (cleared on page reload)
const priceCache: Record<string, { price: number; timestamp: number }> = {};
const rateCache: Record<string, { rateRaw: bigint; timestamp: number }> = {};

export const getTokenBalance = async (
  token: string,
  address: `0x${string}` | undefined,
  chain: Chain
) => {
  try {
    const publicClient = createPublicClient({
      chain,
      transport: http(chain.rpcUrls.default.http[0]),
    });

    if (!address) return { balance: BigInt(0), decimals: 18, formatted: "0" };

    const [balance, decimals] =
      token === zeroAddress
        ? [
            await publicClient.getBalance({
              address: address as Address,
            }),
            18,
          ]
        : await Promise.all([
            readContract(publicClient, {
              address: token as `0x${string}`,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address as `0x${string}`],
            }) as Promise<bigint>,
            readContract(publicClient, {
              address: token as `0x${string}`,
              abi: erc20Abi,
              functionName: "decimals",
            }) as Promise<number>,
          ]);


    //formatted
    const formatted = formatUnits(balance, decimals);

    return { balance, decimals, formatted };
  } catch (error) {
    return { balance: BigInt(0), decimals: 18, formatted: "0", error: true };
  }
};

export const getTokenSupply = async (token: string, chain: Chain) => {
  try {
    const publicClient = createPublicClient({
      chain,
      transport: http(chain.rpcUrls.default.http[0]),
    });

    const [totalSupply, decimals] = await Promise.all([
      readContract(publicClient, {
        address: token as `0x${string}`,
        abi: erc20Abi,
        functionName: "totalSupply",
      }) as Promise<bigint>,
      readContract(publicClient, {
        address: token as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals",
      }) as Promise<number>,
    ]);

    const formatted = formatUnits(totalSupply, decimals);

    return { totalSupply, formatted };
  } catch (error) {
    return { totalSupply: BigInt(0), error: true };
  }
};

export const getVaultRate = async (symbol: string, chain: Chain) => {
  const accountantAddress = getAddresses(chain.id, symbol)?.accountantAddress; // Assuming vaultAddress is the accountant address
  try {
    const cacheKey = `${chain.id}:${accountantAddress}`;
    const now = Date.now();
    const CACHE_TTL_MS = 60_000; // 1 minute
    const cached = rateCache[cacheKey];
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      const formattedCached = formatUnits(cached.rateRaw, 18);
      return { rate: formattedCached, rateRaw: cached.rateRaw, cached: true };
    }
    const publicClient = createPublicClient({
      chain,
      transport: http(chain.rpcUrls.default.http[0]),
    });

    const [rate] = await Promise.all([
      readContract(publicClient, {
        address: accountantAddress as `0x${string}`,
        abi: EliteraAccountantAbi,
        functionName: "getRate",
      }) as Promise<bigint>,
    ]);

    const formatted = formatUnits(rate, 18);
    rateCache[cacheKey] = { rateRaw: rate, timestamp: Date.now() };
    return { rate: formatted, rateRaw: rate, cached: false };
  } catch (error) {
    // Attempt stale cache fallback
    const accountantAddress = getAddresses(chain.id, symbol)?.accountantAddress;
    const cacheKey = `${chain.id}:${accountantAddress}`;
    const cached = rateCache[cacheKey];
    if (cached) {
      return {
        rate: formatUnits(cached.rateRaw, 18),
        rateRaw: cached.rateRaw,
        error: true,
        cached: true,
        stale: true,
      };
    }
    return { rate: "0", rateRaw: BigInt(0), error: true, cached: false };
  }
};

export const getTokenPrice = async (token: string) => {
  if (!token || token.length === 0) {
    return { price: 1, error: true, cached: false };
  }

  if(token.toLowerCase() === "nusd" || token.toLowerCase() === "enusd" || token.toLowerCase() === "usdc"){
    return { price: 1, error: false, cached: true };
  }
  
  //Basic symbol to CoinGecko id mapping (expand as needed)
  const symbolToCoingeckoId: Record<string, string> = {
    ETH: "ethereum",
    USDC: "usd-coin",
    USDT: "tether",
    BTC: "bitcoin",
    ECBTC: "wrapped-bitcoin",
    EWCBTC: "wrapped-bitcoin",
    WBTC: "wrapped-bitcoin",
    WCBTC: "wrapped-bitcoin",
    CBTC: "wrapped-bitcoin", // fallback
    SEI: "sei-network",
    ATOM: "cosmos",
    // Add more as needed
  };
  const symbol = token.toUpperCase();
  const coingeckoId = symbolToCoingeckoId[symbol] || symbol.toLowerCase();
  const now = Date.now();
  const CACHE_TTL_MS = 60_000; // 1 minute
  const cacheKey = symbol; // use upper-case symbol as key

  // Serve from cache if fresh
  const cached = priceCache[cacheKey];
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return { price: cached.price, error: false, cached: true };
  }
  // Try CoinGecko first
  try {
    const cgRes = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`
    );
    if (cgRes.ok) {
      const cgData = await cgRes.json();
      const price = cgData[coingeckoId]?.usd;
      if (typeof price === "number") {
        priceCache[cacheKey] = { price, timestamp: Date.now() };
        return { price, error: false, cached: false };
      }
    }
    throw new Error("CoinGecko price not found");
  } catch (cgError) {
    // Fallback: Coinbase
    try {
      // Coinbase uses symbol-USD, e.g. ETH-USD
      const cbRes = await fetch(
        `https://api.coinbase.com/v2/prices/${symbol}-USD/spot`
      );
      if (cbRes.ok) {
        const cbData = await cbRes.json();
        const price = parseFloat(cbData?.data?.amount);
        if (!isNaN(price)) {
          priceCache[cacheKey] = { price, timestamp: Date.now() };
          return { price, error: false, cached: false };
        }
      }
      throw new Error("Coinbase price not found");
    } catch (cbError) {
      // Last resort: if we have a stale cache, return it despite age
      if (cached) {
        return { price: cached.price, error: true, cached: true, stale: true };
      }
      return { price: 1, error: true, cached: false };
    }
  }
};
