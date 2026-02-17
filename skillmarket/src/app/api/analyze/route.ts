import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { runAnalysisStreaming } from "@/lib/analysis/engine";
import { getModel, isBuiltIn } from "@/lib/analysis/registry";
import { getCustomModel } from "@/lib/skills/model-store";
import { recordUsagePayment } from "@/lib/payouts";
import { verifyPaymentTx } from "@/lib/contract";
import { OPENCLAW_CONFIG } from "@/lib/openclaw/config";
import { runOpenClawAnalysis } from "@/lib/openclaw/bridge";
import type { AgentSSEEvent } from "@/lib/analysis/agent-types";
import type { Hash } from "viem";

const BUILT_IN_PRICE = 5; // MON per built-in model
const OWNER_WALLET = process.env.NEXT_PUBLIC_FOUNDATION_WALLET || "0x0000000000000000000000000000000000000000";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { token?: string; modelIds?: string[]; stream?: boolean; txHash?: string; userWallet?: string; skillId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { token, modelIds, txHash, userWallet, skillId } = body;

  // Verify on-chain usage payment if txHash provided
  if (txHash) {
    const verification = await verifyPaymentTx(txHash as Hash, "SkillUsed");
    if (!verification.valid) {
      return NextResponse.json(
        { error: "Payment verification failed", message: verification.error },
        { status: 402 }
      );
    }
  }

  // Record payout ledger entries for each model
  if (txHash && userWallet && modelIds) {
    for (const modelId of modelIds) {
      const model = getModel(modelId);
      if (!model) continue;

      if (isBuiltIn(modelId)) {
        // Built-in models: revenue goes to owner
        recordUsagePayment({
          modelId,
          modelName: model.name,
          creatorWallet: OWNER_WALLET,
          amountMon: BUILT_IN_PRICE,
          userWallet,
          txHash,
        });
      } else {
        // Community models: track creator's share
        const custom = getCustomModel(modelId);
        if (custom) {
          recordUsagePayment({
            modelId,
            modelName: model.name,
            creatorWallet: custom.creator,
            amountMon: custom.price,
            userWallet,
            txHash,
          });
        }
      }
    }
  }

  if (!token || !isAddress(token)) {
    return NextResponse.json({ error: "Missing or invalid token address" }, { status: 400 });
  }

  if (!modelIds || !Array.isArray(modelIds) || modelIds.length === 0) {
    return NextResponse.json({ error: "modelIds must be a non-empty array" }, { status: 400 });
  }

  // Validate all model IDs
  const invalid = modelIds.filter((id) => !getModel(id));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Unknown model IDs: ${invalid.join(", ")}` },
      { status: 400 },
    );
  }

  // SSE streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: AgentSSEEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // stream already closed
        }
      };

      try {
        if (OPENCLAW_CONFIG.enabled) {
          // Use OpenClaw agent for orchestration
          await runOpenClawAnalysis(token, modelIds, emit, skillId);
        } else {
          // Fallback: direct agent loop (no OpenClaw required)
          await runAnalysisStreaming(token, modelIds, emit);
        }
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
