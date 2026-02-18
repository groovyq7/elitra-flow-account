/**
 * Shared EIP-7702 Intent Cryptography Utilities
 *
 * Core types and functions for building ChainBatches and computing intent hashes
 * used by the Spicenet TX Submission API. This is the single source of truth —
 * used by useGaslessTransaction, SupplyViaSpiceFlow, and WithdrawFlow.
 *
 * Reference: tx-submission-api/src/authorization.ts
 */

import {
  keccak256,
  encodeAbiParameters,
  type Address,
  type Hex,
  type Hash,
} from "viem";

// ── Intent / ChainBatch types (from TX Submission API spec) ──────────────

export type Call = { to: Address; value: bigint; data: Hex };

export interface ChainBatchInput {
  chainId: bigint | number;
  calls: Call[];
  recentBlock: bigint | number;
}

export type ChainBatch = {
  hash: Hash;
  chainId: bigint;
  calls: Call[];
  recentBlock: bigint;
};

// CallAbi — matches TX Submission API authorization.ts
export const CallAbi = {
  type: "tuple",
  components: [
    { name: "to", type: "address" },
    { name: "value", type: "uint" },
    { name: "data", type: "bytes" },
  ],
} as const;

// ABI encoding for chain batch hashing — matches TX Submission API authorization.ts
// hash = keccak256(abi.encode(chainId, calls, recentBlock))
export const ChainBatchHashComponentsAbi = [
  { name: "chainId", type: "uint256" },
  { name: "calls", ...CallAbi, type: "tuple[]" },
  { name: "recentBlock", type: "uint256" },
] as const;

/**
 * Hash an array of chain batch inputs into ChainBatch objects with computed hashes.
 * Each hash = keccak256(abi.encode(chainId, calls, recentBlock))
 * Matches TX Submission API authorization.ts hashChainBatches()
 */
export function hashChainBatches(chainCalls: ChainBatchInput[]): ChainBatch[] {
  return chainCalls.map(({ chainId, calls, recentBlock }) => {
    chainId = BigInt(chainId);
    recentBlock = BigInt(recentBlock);
    const hash = keccak256(
      encodeAbiParameters(ChainBatchHashComponentsAbi, [chainId, calls, recentBlock])
    );
    return { hash, chainId, calls, recentBlock };
  });
}

/**
 * Compute the intent hash from an array of ChainBatches.
 * hash = keccak256(abi.encode(chainBatchHashes[]))
 * Matches TX Submission API authorization.ts getIntentHash()
 */
export function getIntentHash(chainBatches: ChainBatch[]): Hash {
  const chainBatchHashes = chainBatches.map(({ hash }) => hash);
  return keccak256(
    encodeAbiParameters([{ type: "bytes32[]" }], [chainBatchHashes])
  );
}
