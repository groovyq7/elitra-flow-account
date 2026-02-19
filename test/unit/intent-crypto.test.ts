import { describe, it, expect } from "vitest";
import {
  hashChainBatches,
  getIntentHash,
  type Call,
  type ChainBatch,
  type ChainBatchInput,
} from "@/lib/intentCrypto";
import { keccak256, encodeAbiParameters } from "viem";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const MOCK_ADDRESS = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" as const;

const SIMPLE_CALL: Call = {
  to: MOCK_ADDRESS,
  value: 0n,
  data: "0x",
};

const TRANSFER_CALL: Call = {
  to: MOCK_ADDRESS,
  value: 1_000_000n, // 1 USDC (6 decimals)
  data: "0xa9059cbb000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef0000000000000000000000000000000000000000000000000000000000000001",
};

// ---------------------------------------------------------------------------
// hashChainBatches — data construction
// ---------------------------------------------------------------------------

describe("hashChainBatches", () => {
  it("returns one ChainBatch per input", () => {
    const inputs: ChainBatchInput[] = [
      { chainId: 5115n, calls: [SIMPLE_CALL], recentBlock: 100n },
      { chainId: 11155111n, calls: [TRANSFER_CALL], recentBlock: 200n },
    ];
    const result = hashChainBatches(inputs);
    expect(result).toHaveLength(2);
  });

  it("coerces number chainId and recentBlock to BigInt", () => {
    const input: ChainBatchInput = {
      chainId: 5115, // number input
      calls: [SIMPLE_CALL],
      recentBlock: 42, // number input
    };
    const [batch] = hashChainBatches([input]);
    expect(typeof batch.chainId).toBe("bigint");
    expect(typeof batch.recentBlock).toBe("bigint");
    expect(batch.chainId).toBe(5115n);
    expect(batch.recentBlock).toBe(42n);
  });

  it("produces a 32-byte (0x-prefixed 66-char) hash", () => {
    const [batch] = hashChainBatches([
      { chainId: 5115n, calls: [SIMPLE_CALL], recentBlock: 1n },
    ]);
    expect(batch.hash).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it("hash changes when chainId changes", () => {
    const base: ChainBatchInput = { chainId: 5115n, calls: [SIMPLE_CALL], recentBlock: 1n };
    const alt: ChainBatchInput = { ...base, chainId: 11155111n };
    const [h1] = hashChainBatches([base]);
    const [h2] = hashChainBatches([alt]);
    expect(h1.hash).not.toBe(h2.hash);
  });

  it("hash changes when recentBlock changes", () => {
    const base: ChainBatchInput = { chainId: 5115n, calls: [SIMPLE_CALL], recentBlock: 1n };
    const alt: ChainBatchInput = { ...base, recentBlock: 2n };
    const [h1] = hashChainBatches([base]);
    const [h2] = hashChainBatches([alt]);
    expect(h1.hash).not.toBe(h2.hash);
  });

  it("hash changes when call target changes", () => {
    const call1: Call = { to: MOCK_ADDRESS, value: 0n, data: "0x" };
    const call2: Call = { to: ZERO_ADDRESS, value: 0n, data: "0x" };
    const [h1] = hashChainBatches([{ chainId: 1n, calls: [call1], recentBlock: 1n }]);
    const [h2] = hashChainBatches([{ chainId: 1n, calls: [call2], recentBlock: 1n }]);
    expect(h1.hash).not.toBe(h2.hash);
  });

  it("hash changes when call value changes", () => {
    const call1: Call = { to: MOCK_ADDRESS, value: 0n, data: "0x" };
    const call2: Call = { to: MOCK_ADDRESS, value: 1n, data: "0x" };
    const [h1] = hashChainBatches([{ chainId: 1n, calls: [call1], recentBlock: 1n }]);
    const [h2] = hashChainBatches([{ chainId: 1n, calls: [call2], recentBlock: 1n }]);
    expect(h1.hash).not.toBe(h2.hash);
  });

  it("handles multiple calls in one batch", () => {
    const [batch] = hashChainBatches([
      { chainId: 5115n, calls: [SIMPLE_CALL, TRANSFER_CALL], recentBlock: 99n },
    ]);
    expect(batch.calls).toHaveLength(2);
    expect(batch.hash).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it("handles empty calls array without throwing", () => {
    const [batch] = hashChainBatches([
      { chainId: 5115n, calls: [], recentBlock: 1n },
    ]);
    expect(batch.hash).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it("is deterministic — same input produces same hash", () => {
    const input: ChainBatchInput = { chainId: 5115n, calls: [SIMPLE_CALL], recentBlock: 1n };
    const [a] = hashChainBatches([input]);
    const [b] = hashChainBatches([input]);
    expect(a.hash).toBe(b.hash);
  });

  it("matches manual keccak256(abi.encode(chainId, calls, recentBlock))", () => {
    const chainId = 5115n;
    const calls = [SIMPLE_CALL];
    const recentBlock = 7n;

    const [batch] = hashChainBatches([{ chainId, calls, recentBlock }]);

    // Manually reproduce what hashChainBatches should produce
    const CallAbi = {
      type: "tuple",
      components: [
        { name: "to", type: "address" },
        { name: "value", type: "uint" },
        { name: "data", type: "bytes" },
      ],
    } as const;
    const expected = keccak256(
      encodeAbiParameters(
        [
          { name: "chainId", type: "uint256" },
          { name: "calls", ...CallAbi, type: "tuple[]" },
          { name: "recentBlock", type: "uint256" },
        ],
        [chainId, calls, recentBlock],
      ),
    );

    expect(batch.hash).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// getIntentHash — aggregation
// ---------------------------------------------------------------------------

describe("getIntentHash", () => {
  it("returns a 32-byte hex hash", () => {
    const batches = hashChainBatches([
      { chainId: 5115n, calls: [SIMPLE_CALL], recentBlock: 1n },
    ]);
    const intent = getIntentHash(batches);
    expect(intent).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it("is deterministic", () => {
    const batches = hashChainBatches([
      { chainId: 5115n, calls: [SIMPLE_CALL], recentBlock: 1n },
    ]);
    expect(getIntentHash(batches)).toBe(getIntentHash(batches));
  });

  it("changes when a batch hash changes", () => {
    const b1 = hashChainBatches([{ chainId: 5115n, calls: [SIMPLE_CALL], recentBlock: 1n }]);
    const b2 = hashChainBatches([{ chainId: 5115n, calls: [SIMPLE_CALL], recentBlock: 2n }]);
    expect(getIntentHash(b1)).not.toBe(getIntentHash(b2));
  });

  it("changes when batch order changes", () => {
    const b1 = hashChainBatches([
      { chainId: 1n, calls: [SIMPLE_CALL], recentBlock: 1n },
      { chainId: 5115n, calls: [SIMPLE_CALL], recentBlock: 2n },
    ]);
    const b2 = hashChainBatches([
      { chainId: 5115n, calls: [SIMPLE_CALL], recentBlock: 2n },
      { chainId: 1n, calls: [SIMPLE_CALL], recentBlock: 1n },
    ]);
    // Intent hash covers the batch list ordered as provided
    expect(getIntentHash(b1)).not.toBe(getIntentHash(b2));
  });

  it("handles multiple batches (multi-chain intent)", () => {
    const batches = hashChainBatches([
      { chainId: 5115n, calls: [SIMPLE_CALL], recentBlock: 10n },
      { chainId: 11155111n, calls: [TRANSFER_CALL], recentBlock: 20n },
    ]);
    const intent = getIntentHash(batches);
    expect(intent).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it("matches manual keccak256(abi.encode(bytes32[]))", () => {
    const batches = hashChainBatches([
      { chainId: 5115n, calls: [SIMPLE_CALL], recentBlock: 3n },
    ]);
    const expected = keccak256(
      encodeAbiParameters([{ type: "bytes32[]" }], [batches.map((b) => b.hash)]),
    );
    expect(getIntentHash(batches)).toBe(expected);
  });
});
