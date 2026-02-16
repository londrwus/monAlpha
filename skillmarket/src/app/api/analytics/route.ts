import { NextRequest, NextResponse } from "next/server";
import { analysisStore } from "@/lib/analysis/store";
import { getAllModels, isBuiltIn } from "@/lib/analysis/registry";
import { getAllCustomModels } from "@/lib/skills/model-store";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json({ error: "Missing wallet parameter" }, { status: 400 });
  }

  const walletLower = wallet.toLowerCase();

  // Find models owned by this wallet
  const allModels = getAllModels();
  const customModels = getAllCustomModels();
  const customMap = new Map(customModels.map((m) => [m.id, m]));

  const myModelIds = allModels
    .filter((m) => m.creator.toLowerCase() === walletLower)
    .map((m) => m.id);

  // Get all analyses for this creator's models
  const myAnalyses = analysisStore.getByCreator(wallet);

  // Compute metrics
  const totalAnalyses = myAnalyses.length;
  const avgScore = totalAnalyses > 0
    ? Math.round((myAnalyses.reduce((s, a) => s + a.score, 0) / totalAnalyses) * 10) / 10
    : 0;

  // Revenue = sum(usageCount * price) for each model
  let totalRevenue = 0;
  for (const id of myModelIds) {
    const custom = customMap.get(id);
    if (custom) {
      totalRevenue += custom.usageCount * custom.price * 0.7; // 70% creator cut
    }
  }
  totalRevenue = Math.round(totalRevenue * 100) / 100;

  // Signal distribution
  const signalDist = { BUY: 0, WATCH: 0, AVOID: 0 };
  for (const a of myAnalyses) {
    if (a.signal === "BUY" || a.signal === "WATCH" || a.signal === "AVOID") {
      signalDist[a.signal]++;
    }
  }

  // Rank among all models by usage
  const leaderboard = analysisStore.getLeaderboard();
  const rank = leaderboard.findIndex((m) => myModelIds.includes(m.id));

  // Daily usage/revenue arrays (last 15 days)
  const now = Date.now();
  const DAY = 86400000;
  const dailyUsage: number[] = [];
  const dailyRevenue: number[] = [];
  for (let i = 14; i >= 0; i--) {
    const dayStart = now - (i + 1) * DAY;
    const dayEnd = now - i * DAY;
    const dayAnalyses = myAnalyses.filter((a) => a.timestamp >= dayStart && a.timestamp < dayEnd);
    dailyUsage.push(dayAnalyses.length);

    let dayRev = 0;
    for (const a of dayAnalyses) {
      const custom = customMap.get(a.modelId);
      if (custom) dayRev += custom.price * 0.7;
    }
    dailyRevenue.push(Math.round(dayRev * 100) / 100);
  }

  // Per-model breakdown
  const modelBreakdown = myModelIds.map((id) => {
    const model = allModels.find((m) => m.id === id);
    const custom = customMap.get(id);
    const modelAnalyses = myAnalyses.filter((a) => a.modelId === id);
    const modelAvg = modelAnalyses.length > 0
      ? Math.round((modelAnalyses.reduce((s, a) => s + a.score, 0) / modelAnalyses.length) * 10) / 10
      : 0;

    return {
      id,
      name: model?.name || id,
      isBuiltIn: isBuiltIn(id),
      price: custom?.price || 0,
      usageCount: modelAnalyses.length,
      avgScore: modelAvg,
      revenue: custom ? Math.round(custom.usageCount * custom.price * 0.7 * 100) / 100 : 0,
    };
  });

  return NextResponse.json({
    wallet,
    totalRevenue,
    totalAnalyses,
    avgScore,
    rank: rank >= 0 ? rank + 1 : null,
    signalDistribution: signalDist,
    dailyUsage,
    dailyRevenue,
    models: modelBreakdown,
    recentAnalyses: myAnalyses.slice(0, 20),
  });
}
