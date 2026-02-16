import { formatUnits } from "viem";
import { collectTokenData } from "./collector";
import { getModel } from "./registry";
import { analysisStore } from "./store";
import type { AnalysisResult, CollectedTokenData, SerializedTokenData } from "./types";
import type { AgentSSEEvent } from "./agent-types";
import { runAgentLoop } from "./agent-runner";

let idCounter = 0;

function generateId(): string {
  idCounter++;
  return `analysis_${Date.now()}_${idCounter}`;
}

function formatBigintTokens(val: bigint | null): string | null {
  if (val === null) return null;
  return formatUnits(val, 18);
}

export function serializeTokenData(data: CollectedTokenData): SerializedTokenData {
  const buys = data.trades.filter((t) => t.type === "BUY").length;
  const sells = data.trades.filter((t) => t.type === "SELL").length;
  const uniqueTraders = new Set(data.trades.filter((t) => t.trader).map((t) => t.trader.toLowerCase())).size;

  return {
    address: data.address,
    name: data.name,
    symbol: data.symbol,
    imageUrl: data.imageUrl,
    description: data.description,
    creator: data.creator,
    isGraduated: data.curveState?.isGraduated || data.isGraduatedApi,
    createdAt: data.createdAt,

    priceUsd: data.priceUsd,
    priceMon: data.priceMon,
    marketCapUsd: data.marketCapUsd,
    holderCount: data.holderCount,
    volume24h: data.volume24h,
    athPrice: data.athPrice,

    metrics: data.metrics,

    realMonReserve: data.curveState ? data.curveState.realMonReserve.toString() : "0",
    graduationProgress: data.graduationProgress,
    isLocked: data.curveState?.isLocked || false,

    priceImpact: {
      buy1Mon: formatBigintTokens(data.priceImpact.buy1Mon),
      buy10Mon: formatBigintTokens(data.priceImpact.buy10Mon),
      buy100Mon: formatBigintTokens(data.priceImpact.buy100Mon),
    },

    totalTrades: data.trades.length,
    buyCount: buys,
    sellCount: sells,
    uniqueTraders,
    recentTrades: data.trades.slice(0, 10),

    creatorTokenCount: data.creatorTokenCount,
    creatorTokens: data.creatorTokens,

    totalSupply: data.totalSupply.toString(),
    hasApiData: data.hasApiData,
  };
}

export async function runAnalysis(
  tokenAddress: string,
  modelIds: string[]
): Promise<{ results: AnalysisResult[]; tokenData: SerializedTokenData }> {
  // Validate model IDs
  const validModels = modelIds
    .map((id) => getModel(id))
    .filter((m) => m !== undefined);

  if (validModels.length === 0) {
    throw new Error("No valid model IDs provided");
  }

  // Collect data once (cached for 60s)
  console.log(`[engine] Collecting data for ${tokenAddress}...`);
  const data = await collectTokenData(tokenAddress);
  console.log(`[engine] Data collected: name=${data.name}, symbol=${data.symbol}, trades=${data.trades.length}`);

  const tokenData = serializeTokenData(data);
  const now = Date.now();
  const results: AnalysisResult[] = [];

  for (const model of validModels) {
    try {
      console.log(`[engine] Running model: ${model.id}`);
      const partial = await Promise.resolve(model.run(data));

      const result: AnalysisResult = {
        analysisId: generateId(),
        tokenAddress: data.address,
        tokenName: data.name,
        tokenSymbol: data.symbol,
        tokenImageUrl: data.imageUrl,
        timestamp: now,
        ...partial,
      };

      results.push(result);
      analysisStore.addAnalysis(result);
      console.log(`[engine] Model ${model.id}: score=${result.score}, signal=${result.signal}`);
    } catch (err) {
      console.error(`[engine] Model ${model.id} failed:`, err);
    }
  }

  if (results.length === 0) {
    throw new Error("All models failed to produce results");
  }

  return { results, tokenData };
}

/**
 * Streaming analysis — delegates to the agentic investigation runner.
 * The agent autonomously decides what to investigate based on tiered tools
 * and dynamic planning, streaming SSE events as it progresses.
 */
export async function runAnalysisStreaming(
  tokenAddress: string,
  modelIds: string[],
  emit: (event: AgentSSEEvent) => void
): Promise<void> {
  return runAgentLoop(tokenAddress, modelIds, emit);
}
