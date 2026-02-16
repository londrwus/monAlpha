import { NextRequest, NextResponse } from "next/server";
import { analysisStore } from "@/lib/analysis/store";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || 10), 50);

  const analyses = analysisStore.getRecent(limit);

  return NextResponse.json({
    analyses,
    total: analysisStore.getTotalCount(),
    avgScore: analysisStore.getAverageScore(),
    signalDistribution: analysisStore.getSignalDistribution(),
  });
}
