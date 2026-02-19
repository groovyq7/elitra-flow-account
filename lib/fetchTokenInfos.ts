import type { Chain } from "viem";
import { getTokenImage } from "@/lib/utils";
import {
  getTokenBalance,
  getTokenPrice,
  getVaultRate,
} from "@/lib/utils/get-token-balance";
import { TokenInfo, TokenType, Vault } from "./types";
import { VAULTS } from "./contracts/vault-registry";

// address: user address, chain: wagmi/viem chain object
export async function fetchTokenInfos(
  tokens: Array<TokenType>,
  address: `0x${string}` | undefined,
  chain: Chain,
  vaultsData?: Vault[]
): Promise<TokenInfo[]> {
  const results = await Promise.allSettled(
    tokens.map(async (token) => {
      // Fetch real balance using getTokenBalance
      const { formatted } = await getTokenBalance(
        token.address,
        address,
        chain
      );
      const available = Number(formatted);
      let price = 0;
      if (token.symbol.toLowerCase().startsWith("e")) {
        const tokenPrice = (
          await getTokenPrice(token.symbol.toUpperCase().replace("E", ""))
        ).price;
        const ratio = await getVaultRate(token.symbol, chain);
        price = tokenPrice * Number(ratio.rate);
      } else {
        price = (await getTokenPrice(token.symbol)).price;
      }

      const vaultApy =
        vaultsData && vaultsData.length > 0
          ? vaultsData.find(
              (v) =>
                v.id.toLowerCase() === token.address.toLowerCase() ||
                v.token0.address.toLowerCase() === token.address.toLowerCase()
            )?.apy
          : VAULTS[chain.id]?.find(
              (v) =>
                v.id.toLowerCase() === token.address.toLowerCase() ||
                v.token0.address.toLowerCase() === token.address.toLowerCase()
            )?.apy || 1;
      const apy = Number(vaultApy);
      const availableUSD = available * price;
      const yearlyReward = (available * apy) / 100;
      const yearlyRewardUSD = yearlyReward * price;

      return {
        symbol: token.symbol,
        token: token,
        icon: getTokenImage(token.symbol),
        available,
        availableUSD,
        apy,
        yearlyReward,
        yearlyRewardUSD,
        price,
      } satisfies TokenInfo;
    })
  );

  // Filter out failed fetches and log errors
  const balances: TokenInfo[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      balances.push(result.value);
    } else {
      console.error(
        `[fetchTokenInfos] Failed to fetch info for token ${tokens[i]?.symbol}:`,
        result.reason
      );
    }
  }
  return balances;
}

export function mergeTokenInfos(external: TokenInfo[], embedded: TokenInfo[]): TokenInfo[] {
  const merged: Record<string, TokenInfo> = {};

  for (const token of external) {
    merged[token.symbol] = { ...token };
  }

  for (const token of embedded) {
    if (merged[token.symbol]) {
      merged[token.symbol].available += token.available;
      merged[token.symbol].availableUSD += token.availableUSD;
      merged[token.symbol].yearlyReward += token.yearlyReward;
      merged[token.symbol].yearlyRewardUSD += token.yearlyRewardUSD;
    } else {
      merged[token.symbol] = { ...token };
    }
  }

  return Object.values(merged);
}
