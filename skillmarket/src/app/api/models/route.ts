import { NextRequest, NextResponse } from "next/server";
import { parseAndValidateSkill } from "@/lib/skills/parser";
import { createCustomModel, getAllCustomModels } from "@/lib/skills/model-store";
import { isBuiltIn, getAllModels } from "@/lib/analysis/registry";
import { analysisStore } from "@/lib/analysis/store";
import { verifyPaymentTx } from "@/lib/contract";
import type { Hash } from "viem";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { skillMarkdown, price, creator, advancedSettings, modelType, txHash } = body as {
      skillMarkdown: string;
      price: number;
      creator: string;
      advancedSettings?: Record<string, unknown>;
      modelType?: "RESEARCH" | "DEEP_RESEARCH";
      txHash?: string;
    };

    if (!skillMarkdown || !creator) {
      return NextResponse.json(
        { error: "Missing required fields: skillMarkdown, creator" },
        { status: 400 }
      );
    }

    // Verify on-chain payment if contract is deployed
    if (txHash) {
      const verification = await verifyPaymentTx(txHash as Hash, "SkillRegistered");
      if (!verification.valid) {
        return NextResponse.json(
          { error: "Payment verification failed", message: verification.error },
          { status: 402 }
        );
      }
    }

    const result = parseAndValidateSkill(skillMarkdown);
    if (!result.valid || !result.parsed) {
      return NextResponse.json(
        { error: "Invalid SKILL.md", errors: result.errors, warnings: result.warnings },
        { status: 400 }
      );
    }

    const model = createCustomModel({
      skillMarkdown,
      parsedSkill: result.parsed,
      price: price || 0,
      creator,
      modelType: modelType || (result.parsed.type === "DEEP_RESEARCH" ? "DEEP_RESEARCH" : "RESEARCH"),
      advancedSettings: advancedSettings as Record<string, unknown> | undefined,
    });

    return NextResponse.json({
      model: {
        id: model.id,
        name: model.name,
        description: model.description,
        version: model.version,
        creator: model.creator,
        createdAt: model.createdAt,
        price: model.price,
        isBuiltIn: false,
        breakdownLabels: model.parsedSkill.scoringBreakdown.map((c) => c.label),
      },
      warnings: result.warnings,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create model", message: String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const allModels = getAllModels();
  const stats = analysisStore.getModelStats();
  const customModels = getAllCustomModels();
  const customMap = new Map(customModels.map((m) => [m.id, m]));
  const statsMap = new Map(stats.map((s) => [s.id, s]));

  const models = allModels.map((m) => {
    const s = statsMap.get(m.id);
    const custom = customMap.get(m.id);
    return {
      id: m.id,
      name: m.name,
      description: m.description,
      version: m.version,
      creator: m.creator,
      isBuiltIn: isBuiltIn(m.id),
      modelType: custom?.modelType || "RESEARCH",
      price: isBuiltIn(m.id) ? 5 : (custom?.price || 0),
      createdAt: custom?.createdAt || 0,
      usageCount: s?.usageCount || 0,
      avgScore: s?.avgScore || 0,
      signalDistribution: s?.signalDistribution || { BUY: 0, WATCH: 0, AVOID: 0 },
      lastUsed: s?.lastUsed || null,
      breakdownLabels: m.breakdownLabels,
    };
  });

  return NextResponse.json({ models, total: models.length });
}
