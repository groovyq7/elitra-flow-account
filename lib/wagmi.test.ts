/**
 * Wagmi config for automated testing.
 * Uses wagmi's mock connector with a funded test wallet.
 * Never use this in production — test environment only.
 */
import { http, createConfig } from "wagmi";
import { mock } from "wagmi/connectors";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia, arbitrumSepolia, baseSepolia } from "viem/chains";
import { citreaTestnet } from "./wagmi";

// Test wallet — Sepolia only, funded with testnet ETH
const TEST_PRIVATE_KEY = (process.env.TEST_WALLET_PRIVATE_KEY ||
  "0xff33a8b4ea2cd8ade320267b0e80945a49ef08dd6542dc1f098849dc0e4f3026") as `0x${string}`;

export const testAccount = privateKeyToAccount(TEST_PRIVATE_KEY);

export const testConfig = createConfig({
  chains: [citreaTestnet, sepolia, arbitrumSepolia, baseSepolia],
  connectors: [
    mock({
      accounts: [testAccount.address],
    }),
  ],
  transports: {
    [citreaTestnet.id]: http("https://rpc.testnet.citrea.xyz"),
    [sepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
    [baseSepolia.id]: http(),
  },
});
