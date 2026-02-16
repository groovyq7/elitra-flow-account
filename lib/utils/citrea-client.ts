import { createPublicClient, http, PublicClient } from "viem";
import { citreaTestnet } from "viem/chains";

export const getCitreaClient = (): PublicClient => {
  return createPublicClient({
    chain: citreaTestnet,
    transport: http("https://rpc.testnet.citrea.xyz"),
  });
};

