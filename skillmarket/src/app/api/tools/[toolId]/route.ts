import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { collectTokenData } from "@/lib/analysis/collector";
import { allTools, type ToolResult } from "@/lib/analysis/agent-tools";
import { createAgentContext, addFinding, addToolRun, shiftRisk } from "@/lib/analysis/agent-context";
import { getModel } from "@/lib/analysis/registry";
import { serializeTokenData } from "@/lib/analysis/engine";
import { analysisStore } from "@/lib/analysis/store";

/**
 * Internal tool execution endpoint for OpenClaw agent plugins.
 * Called by OpenClaw tool handlers to execute investigation tools.
 *
 * POST /api/tools/:toolId
 * Body: { tokenAddress: string, modelIds?: string[] }
 *
 * Security: Checked via OPENCLAW_INTERNAL_TOKEN header or localhost-only.
 */

const INTERNAL_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";

function isAuthorized(req: NextRequest): boolean {
  // Allow localhost requests without token (same-server calls)
  const host = req.headers.get("host") || "";
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
    return true;
  }
  // Otherwise require internal token
  if (!INTERNAL_TOKEN) return true; // No token configured = open (dev mode)
  const provided = req.headers.get("x-internal-token") || "";
  return provided === INTERNAL_TOKEN;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  const { toolId } = await params;

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { tokenAddress?: string; modelIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tokenAddress, modelIds } = body;

  if (!tokenAddress || !isAddress(tokenAddress)) {
    return NextResponse.json({ error: "Missing or invalid tokenAddress" }, { status: 400 });
  }

  // Collect data (cached 60s per token address)
  let data;
  try {
    data = await collectTokenData(tokenAddress);
  } catch (err) {
    return NextResponse.json(
      { error: "Data collection failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  // --- collect_token_data: return serialized summary ---
  if (toolId === "collect_token_data") {
    const serialized = serializeTokenData(data);
    return NextResponse.json({
      finding: `Collected data for $${data.symbol}: ${data.trades.length} trades, ${data.holderCount} holders, MCap $${data.marketCapUsd.toLocaleString()}`,
      severity: "info" as const,
      riskDelta: 0,
      details: [
        `Token: ${data.name} ($${data.symbol})`,
        `Creator: ${data.creator || "unknown"}`,
        `Graduated: ${data.curveState?.isGraduated || data.isGraduatedApi ? "Yes" : "No"}`,
        `Holders: ${data.holderCount}`,
        `Market Cap: $${data.marketCapUsd.toLocaleString()}`,
        `24h Volume: $${data.volume24h.toLocaleString()}`,
        `Trades (bonding curve): ${data.trades.length}`,
        `Creator tokens: ${data.creatorTokenCount}`,
      ],
      flags: [],
      tokenData: serialized,
    });
  }

  // --- score_token: run scoring models ---
  if (toolId === "score_token") {
    const ids = modelIds || ["rug-detector", "whale-tracker", "liquidity-scout"];
    const results = [];

    for (const mId of ids) {
      const model = getModel(mId);
      if (!model) continue;

      try {
        const partial = await Promise.resolve(model.run(data));
        const result = {
          analysisId: `analysis_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          tokenAddress: data.address,
          tokenName: data.name,
          tokenSymbol: data.symbol,
          tokenImageUrl: data.imageUrl,
          timestamp: Date.now(),
          ...partial,
        };
        analysisStore.addAnalysis(result);
        results.push({
          modelId: result.modelId,
          modelName: result.modelName,
          signal: result.signal,
          score: result.score,
          confidence: result.confidence,
          reasoning: result.reasoning,
          risks: result.risks,
          breakdown: result.breakdown,
          isAIPowered: result.isAIPowered,
        });
      } catch (err) {
        results.push({
          modelId: mId,
          modelName: model.name,
          signal: "AVOID",
          score: 0,
          confidence: "LOW",
          reasoning: `Model failed: ${err instanceof Error ? err.message : String(err)}`,
          risks: ["Model execution failed"],
          breakdown: {},
        });
      }
    }

    return NextResponse.json({
      finding: `Scored token with ${results.length} model(s): ${results.map((r) => `${r.modelId}=${r.score}`).join(", ")}`,
      severity: "info" as const,
      riskDelta: 0,
      details: results.map((r) => `${r.modelName}: ${r.score}/100 — ${r.signal}`),
      flags: [],
      results,
    });
  }

  // --- Investigation tools: find and run by ID ---
  const tool = allTools.find((t) => t.id === toolId);
  if (!tool) {
    return NextResponse.json(
      { error: `Unknown tool: ${toolId}`, availableTools: allTools.map((t) => t.id) },
      { status: 404 }
    );
  }

  const ctx = createAgentContext(data);
  const result: ToolResult = tool.run(data, ctx);

  // Extract flags that were set during this tool run
  const flags = Array.from(ctx.flags);

  return NextResponse.json({
    finding: result.finding,
    severity: result.severity,
    riskDelta: result.riskDelta,
    details: result.details,
    triggerTools: result.triggerTools,
    flags,
    toolId: tool.id,
    toolName: tool.name,
    tier: tool.tier,
  });
}

// GET: List all available tools
export async function GET() {
  const tools = allTools.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    tier: t.tier,
  }));

  return NextResponse.json({
    tools: [
      { id: "collect_token_data", name: "Collect Token Data", description: "Fetch all on-chain and API data for a token", tier: 0 },
      ...tools,
      { id: "score_token", name: "Score Token", description: "Run scoring models to produce final risk assessment", tier: 0 },
    ],
    total: tools.length + 2,
  });
}
