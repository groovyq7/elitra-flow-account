/**
 * useGaslessTransaction — Shared EIP-7702 gasless transaction hook
 *
 * Encapsulates the full Spicenet TX Submission API flow:
 *   1. Build ChainBatch with the desired calls on Citrea
 *   2. Sign EIP-7702 delegation via Privy's useSign7702Authorization
 *   3. Sign intent hash via Privy embedded wallet (personal_sign)
 *   4. Submit to TX Submission API relayer
 *   5. Trigger step execution + poll for status
 *
 * Used by SupplyViaSpiceFlow for gasless Teller.deposit() operations.
 * The solver pays gas on behalf of the user.
 */

import { useCallback, useMemo } from "react";
import {
  useSign7702Authorization,
  useWallets,
  getEmbeddedConnectedWallet,
} from "@privy-io/react-auth";
import { type Address, type Hex } from "viem";
import { getCitreaClient } from "@/lib/utils/citrea-client";
import {
  DELEGATE_CONTRACTS,
  SPICENET_API_URL,
  NATIVE_CHAIN_ID,
} from "@/lib/spiceflowConfig";
import {
  type Call,
  type ChainBatchInput,
  hashChainBatches,
  getIntentHash,
} from "@/lib/intentCrypto";

export type { Call };

// ── Step tracking ─────────────────────────────────────────────────────────

export type GaslessStep =
  | "idle"
  | "building"
  | "signing-delegation"
  | "signing-intent"
  | "submitting"
  | "executing"
  | "success"
  | "error";

export interface GaslessProgress {
  step: GaslessStep;
  message: string;
  txHash?: string;
  error?: string;
}

export type OnProgress = (progress: GaslessProgress) => void;

// ── Module-level execution lock ──────────────────────────────────────────
// Survives component unmount/remount cycles, preventing nonce collisions
// when the same user triggers gasless transactions across different
// component instances or rapid re-renders. A component-level useRef would
// reset to false on remount, allowing concurrent nonce-colliding calls.
let globalExecutionLock = false;

// ── Hook ──────────────────────────────────────────────────────────────────

export function useGaslessTransaction() {
  const { signAuthorization } = useSign7702Authorization();
  const { wallets } = useWallets();

  const embeddedWallet = useMemo(
    () => getEmbeddedConnectedWallet(wallets),
    [wallets]
  );

  const hasEmbedded = !!embeddedWallet;

  /**
   * Execute an array of on-chain calls via the EIP-7702 gasless flow.
   * The calls execute as the embedded wallet (the delegated EOA).
   *
   * @param calls         Array of {to, value, data} calls to execute on Citrea
   * @param tokenAddress  Token address for API metadata (e.g. the asset being supplied)
   * @param tokenAmount   Token amount (bigint) for API metadata
   * @param onProgress    Optional callback for step updates
   * @returns  The intent ID on success
   */
  const executeGasless = useCallback(
    async (
      calls: Call[],
      tokenAddress: string,
      tokenAmount: bigint,
      onProgress?: OnProgress,
    ): Promise<string> => {
      const notify = (step: GaslessStep, message: string, extra?: Partial<GaslessProgress>) => {
        onProgress?.({ step, message, ...extra });
      };

      // Prevent concurrent executions (nonce collision guard)
      if (globalExecutionLock) {
        throw new Error("A gasless transaction is already in progress. Please wait.");
      }
      globalExecutionLock = true;

      try {
        // ── Validate ────────────────────────────────────────────────────
        // Re-resolve embedded wallet from the current wallets array to avoid stale
        // references. The useMemo `embeddedWallet` may be outdated if wallets changed
        // between the last render and this async execution.
        const currentEmbeddedWallet = getEmbeddedConnectedWallet(wallets) || embeddedWallet;
        if (!currentEmbeddedWallet) {
          throw new Error("No Privy embedded wallet found. Please log in via Privy first.");
        }
        const embeddedAddress = currentEmbeddedWallet.address as Address;

        const delegateContract = DELEGATE_CONTRACTS[
          NATIVE_CHAIN_ID as keyof typeof DELEGATE_CONTRACTS
        ] as Address;

        // ── Step 1: Build ChainBatch ────────────────────────────────────
        notify("building", "Building transaction...");

        const citreaPublicClient = getCitreaClient();
        const recentBlock = await citreaPublicClient.getBlockNumber();

        const chainBatches = hashChainBatches([
          {
            chainId: NATIVE_CHAIN_ID,
            calls,
            recentBlock: recentBlock + 10n, // Buffer
          },
        ]);

        // ── Step 2: Sign EIP-7702 delegation via Privy ──────────────────
        notify("signing-delegation", "Sign delegation in your wallet...");

        const nonce = await citreaPublicClient.getTransactionCount({
          address: embeddedAddress,
        });

        const authResult = await signAuthorization({
          contractAddress: delegateContract,
          chainId: NATIVE_CHAIN_ID,
          nonce: nonce,
        });

        const authorizationObj = {
          address: delegateContract,
          chainId: NATIVE_CHAIN_ID,
          nonce: nonce,
          r: authResult.r as Hex,
          s: authResult.s as Hex,
          yParity: authResult.yParity as 0 | 1,
        };

        // ── Step 3: Sign intent hash via Privy embedded wallet ──────────
        notify("signing-intent", "Sign the intent in your wallet...");

        const intentDigest = getIntentHash(chainBatches);

        const provider = await currentEmbeddedWallet.getEthereumProvider();
        const intentSignature = (await provider.request({
          method: "personal_sign",
          params: [intentDigest, embeddedAddress],
        })) as Hex;

        // ── Step 4: Submit to TX Submission API ─────────────────────────
        notify("submitting", "Submitting to relayer...");

        const submitPayload = {
          address: embeddedAddress,
          authorization: [authorizationObj],
          intentAuthorization: {
            signature: intentSignature,
            chainBatches: chainBatches.map((batch) => ({
              hash: batch.hash,
              chainId: batch.chainId.toString(),
              calls: batch.calls.map((c) => ({
                to: c.to,
                value: c.value.toString(),
                data: c.data,
              })),
              recentBlock: batch.recentBlock.toString(),
            })),
          },
          tokenAddress,
          tokenAmount: tokenAmount.toString(),
        };

        const submitResponse = await fetch(
          `${SPICENET_API_URL}/transaction/submit`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(submitPayload),
          }
        );

        if (!submitResponse.ok) {
          const errorText = await submitResponse.text();
          throw new Error(`TX Submission API error: ${submitResponse.status} - ${errorText}`);
        }

        const submitResult = await submitResponse.json();
        const intentId = submitResult.data?.intentId || intentSignature;

        // ── Step 5: Trigger execution + poll for status ─────────────────
        notify("executing", "Executing on Citrea...");

        // POST to trigger step 0
        let step0PostFailed404 = false;
        try {
          const execResponse = await fetch(
            `${SPICENET_API_URL}/intent/${encodeURIComponent(intentId)}/step/0`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            }
          );

          if (execResponse.status === 404) {
            console.error("[GaslessTx] Step 0 POST returned 404");
            step0PostFailed404 = true;
          } else {
            const execResult = await execResponse.json();

            if (execResult.data?.transactionHash) {
              notify("executing", "Transaction executing on Citrea...", {
                txHash: execResult.data.transactionHash,
              });
            }
            if (
              execResult.data?.status === "success" ||
              execResult.data?.status === "completed"
            ) {
              notify("success", "Transaction successful!", {
                txHash: execResult.data.transactionHash,
              });
              return intentId;
            }
          }
        } catch (execError: unknown) {
          const msg = execError instanceof Error ? execError.message : "Unknown error";
          console.warn("[GaslessTx] Step 0 POST error (will poll):", msg);
        }

        if (step0PostFailed404) {
          throw new Error(
            `TX Submission API does not recognize the intent (404). ` +
            `Verify the API is the correct instance with intent execution support.`
          );
        }

        // Poll for status
        let stepStatus = "pending";
        let pollAttempts = 0;
        const maxPolls = 60;
        let consecutive404s = 0;
        const max404s = 5;

        while (
          stepStatus !== "success" &&
          stepStatus !== "completed" &&
          pollAttempts < maxPolls
        ) {
          await new Promise((r) => setTimeout(r, 3000));
          pollAttempts++;

          try {
            const statusResponse = await fetch(
              `${SPICENET_API_URL}/intent/${encodeURIComponent(intentId)}/step/0/status`,
              { method: "GET", headers: { "Content-Type": "application/json" } }
            );

            if (statusResponse.ok) {
              consecutive404s = 0;
              const statusResult = await statusResponse.json();
              stepStatus = statusResult.data?.status || "pending";

              const txHash = statusResult.data?.transactionHash;

              if (stepStatus === "reverted" || stepStatus === "error") {
                throw new Error(
                  `Transaction ${stepStatus}. ${statusResult.data?.error || "The transaction was rejected on-chain. This may be due to insufficient balance or contract constraints. Please verify your positions and try again."}`
                );
              }

              const statusMsg =
                stepStatus === "executing"
                  ? "Transaction executing on Citrea..."
                  : stepStatus === "submitted"
                    ? "Transaction submitted to Citrea..."
                    : stepStatus === "created"
                      ? "Solver picked up intent..."
                      : "Waiting for solver...";

              notify("executing", statusMsg, { txHash });
            } else {
              const errText = await statusResponse.text();
              console.warn(`[GaslessTx] Poll ${pollAttempts} HTTP ${statusResponse.status}:`, errText);

              if (statusResponse.status === 404) {
                consecutive404s++;
                if (consecutive404s >= max404s) {
                  throw new Error(`Intent not found after ${max404s} consecutive 404 responses`);
                }
              }
            }
          } catch (pollError: unknown) {
            const pollMsg = pollError instanceof Error ? pollError.message : "Unknown error";
            if (
              pollMsg.includes("reverted") ||
              pollMsg.includes("not found after")
            ) {
              throw pollError;
            }
            console.warn(`[GaslessTx] Poll ${pollAttempts} error:`, pollMsg);
          }
        }

        if (stepStatus === "success" || stepStatus === "completed") {
          notify("success", "Transaction successful!");
          return intentId;
        }

        throw new Error(
          `Transaction is still processing (status: ${stepStatus}). ` +
          `This doesn't mean it failed — the solver may still complete it. ` +
          `Check your positions in a few minutes, or try refreshing the page.`
        );
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : "Transaction failed";
        console.error("[GaslessTx] Error:", error);
        notify("error", errMsg, { error: errMsg });
        throw error;
      } finally {
        globalExecutionLock = false;
      }
    },
    [embeddedWallet, wallets, signAuthorization]
  );

  return { executeGasless, hasEmbeddedWallet: hasEmbedded };
}
