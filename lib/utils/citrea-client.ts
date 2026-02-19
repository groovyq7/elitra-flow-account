import { createPublicClient, http, PublicClient } from "viem";
import { citreaTestnet } from "viem/chains";

// Allow overriding the Citrea RPC via environment variable — useful for pointing
// at a private node or a different testnet endpoint without a code change.
// Falls back to the public Citrea testnet RPC (chain ID 5115).
const CITREA_RPC_URL =
  process.env.NEXT_PUBLIC_CITREA_RPC_URL || "https://rpc.testnet.citrea.xyz";

export const getCitreaClient = (): PublicClient => {
  return createPublicClient({
    chain: citreaTestnet,
    transport: http(CITREA_RPC_URL, {
      // Timeout after 10 seconds to avoid hanging on an unresponsive RPC.
      timeout: 10_000,
    }),
  });
};
