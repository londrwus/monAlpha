import { NextResponse } from "next/server";
import { analysisStore } from "@/lib/analysis/store";
import { isBuiltIn } from "@/lib/analysis/registry";
import { getAllCustomModels } from "@/lib/skills/model-store";

const BUILT_IN_PRICE = 5; // 5 MON per analysis for platform models

export async function GET() {
  const models = analysisStore.getModelStats();
  const customModels = getAllCustomModels();
  const customMap = new Map(customModels.map((m) => [m.id, m]));

  return NextResponse.json({
    skills: models.map((m) => {
      const custom = customMap.get(m.id);
      const builtIn = isBuiltIn(m.id);
      const price = builtIn ? BUILT_IN_PRICE : (custom?.price || 0);
      return {
        id: m.id,
        name: m.name,
        description: m.description,
        creator: m.creator,
        version: m.version,
        price,
        stake: 0,
        usageCount: m.usageCount,
        accuracy: m.avgScore,
        totalRevenue: builtIn
          ? Math.round(m.usageCount * BUILT_IN_PRICE * 0.5 * 100) / 100
          : custom ? Math.round(custom.usageCount * custom.price * 0.5 * 100) / 100 : 0,
        signalDistribution: m.signalDistribution,
        lastUsed: m.lastUsed,
        isBuiltIn: builtIn,
        modelType: custom?.modelType || "RESEARCH",
        createdAt: custom?.createdAt || 0,
      };
    }),
    total: models.length,
  });
}
