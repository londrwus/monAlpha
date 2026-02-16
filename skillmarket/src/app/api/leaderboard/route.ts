import { NextResponse } from "next/server";
import { analysisStore } from "@/lib/analysis/store";

export async function GET() {
  const leaderboard = analysisStore.getLeaderboard().map((m, i) => ({
    rank: i + 1,
    id: m.id,
    name: m.name,
    creator: m.creator,
    accuracy: m.avgScore,
    usage: m.usageCount,
    signalDistribution: m.signalDistribution,
    lastUsed: m.lastUsed,
    trend: "stable" as const,
  }));

  return NextResponse.json({
    leaderboard,
    lastUpdated: new Date().toISOString(),
    period: "all-time",
    totalAnalyses: analysisStore.getTotalCount(),
  });
}
