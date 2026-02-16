import { publicClient } from "./monad";
import { SKILL_REGISTRY_ADDRESS } from "./constants";
import { SKILL_REGISTRY_ABI } from "./abis/skill-registry";
import { decodeEventLog, type Hash } from "viem";

const FOUNDATION_WALLET = (process.env.NEXT_PUBLIC_FOUNDATION_WALLET || "").toLowerCase();

/**
 * Verify a payment transaction.
 * Supports both:
 *  - Contract calls (registerSkill/useSkill → checks for event)
 *  - Simple MON transfers to foundation wallet (payForAnalysis)
 */
export async function verifyPaymentTx(
  txHash: Hash,
  expectedEvent: "SkillRegistered" | "SkillUsed"
): Promise<{ valid: boolean; error?: string; data?: Record<string, unknown> }> {
  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

    if (receipt.status !== "success") {
      return { valid: false, error: "Transaction reverted" };
    }

    // Accept simple MON transfers to foundation wallet (payForAnalysis flow)
    if (receipt.to?.toLowerCase() === FOUNDATION_WALLET) {
      return { valid: true, data: { transfer: true } };
    }

    // If no contract deployed, accept any successful tx
    if (!SKILL_REGISTRY_ADDRESS) {
      return { valid: true, data: { devMode: true } };
    }

    // Contract call verification — check for expected event
    if (receipt.to?.toLowerCase() !== SKILL_REGISTRY_ADDRESS.toLowerCase()) {
      return { valid: false, error: "Transaction not sent to SkillRegistry or foundation wallet" };
    }

    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: SKILL_REGISTRY_ABI,
          data: log.data,
          topics: log.topics,
        });

        if (decoded.eventName === expectedEvent) {
          return {
            valid: true,
            data: decoded.args as unknown as Record<string, unknown>,
          };
        }
      } catch {
        // Not our event, skip
      }
    }

    return { valid: false, error: `Event ${expectedEvent} not found in tx` };
  } catch (err) {
    return { valid: false, error: `Failed to verify tx: ${String(err)}` };
  }
}
