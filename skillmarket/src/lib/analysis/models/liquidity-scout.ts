import type { CollectedTokenData, ModelDefinition } from "../types";
import { computeSignal, computeConfidence } from "../types";
import { MALPHA_TOKEN } from "@/lib/constants";

/**
 * Liquidity Scout v2 — calibrated for nad.fun memecoins.
 *
 * Total: 100 points across 5 categories.
 * Key principle: missing data = LOW score, graduated without curve data = moderate.
 */

function scoreAbsoluteLiquidity(data: CollectedTokenData): { score: number; risks: string[] } {
  const risks: string[] = [];
  const isGraduated = data.curveState?.isGraduated || data.isGraduatedApi;

  // No curve state at all
  if (!data.curveState) {
    if (isGraduated) {
      // Graduated to DEX — curve data no longer available, give moderate score
      return { score: 12, risks: [] };
    }
    return { score: 0, risks: ["No on-chain liquidity data available"] };
  }

  if (isGraduated) {
    // Graduated = liquidity moved to DEX. Can't measure from curve anymore.
    return { score: 14, risks: [] };
  }

  const liquidityMon = Number(data.curveState.realMonReserve) / 1e18;

  // For memecoins: most start with < 10 MON, 50+ is solid
  let score: number;
  if (liquidityMon >= 200) score = 25;
  else if (liquidityMon >= 100) score = 23;
  else if (liquidityMon >= 50) score = 20;
  else if (liquidityMon >= 20) score = 16;
  else if (liquidityMon >= 10) score = 12;
  else if (liquidityMon >= 5) score = 8;
  else if (liquidityMon >= 1) score = 4;
  else score = 0;

  if (liquidityMon < 1) risks.push("Critically low liquidity — high slippage on any trade");
  else if (liquidityMon < 5) risks.push(`Very low liquidity (${liquidityMon.toFixed(2)} MON)`);
  else if (liquidityMon < 10) risks.push(`Low liquidity (${liquidityMon.toFixed(2)} MON)`);

  return { score, risks };
}

function scorePriceImpact(data: CollectedTokenData): { score: number; risks: string[] } {
  const risks: string[] = [];
  const { buy1Mon, buy10Mon, buy100Mon } = data.priceImpact;

  // No quotes = no data = LOW score
  if (!buy1Mon || !buy100Mon) {
    const isGraduated = data.curveState?.isGraduated || data.isGraduatedApi;
    if (isGraduated) {
      return { score: 10, risks: ["Price impact unavailable (graduated to DEX)"] };
    }
    return { score: 0, risks: ["Price impact data unavailable"] };
  }

  const tokensPerMon1 = Number(buy1Mon) / 1e18;
  const tokensPerMon10 = buy10Mon ? Number(buy10Mon) / (10 * 1e18) : tokensPerMon1;
  const tokensPerMon100 = Number(buy100Mon) / (100 * 1e18);

  if (tokensPerMon1 === 0) return { score: 0, risks: ["Cannot calculate price impact — zero output"] };

  const slippage100 = 1 - tokensPerMon100 / tokensPerMon1;
  const slippage10 = 1 - tokensPerMon10 / tokensPerMon1;

  let score: number;
  if (slippage100 < 0.02) score = 25;
  else if (slippage100 < 0.05) score = 22;
  else if (slippage100 < 0.10) score = 18;
  else if (slippage100 < 0.20) score = 14;
  else if (slippage100 < 0.40) score = 9;
  else if (slippage100 < 0.60) score = 4;
  else score = 0;

  if (slippage100 > 0.30) risks.push(`Very high price impact: 100 MON buy = ${(slippage100 * 100).toFixed(1)}% slippage`);
  else if (slippage100 > 0.15) risks.push(`Moderate price impact: 100 MON buy = ${(slippage100 * 100).toFixed(1)}% slippage`);

  if (slippage10 > 0.10) risks.push(`Even 10 MON buys cause ${(slippage10 * 100).toFixed(1)}% slippage`);

  return { score, risks };
}

function scoreGraduationProgress(data: CollectedTokenData): { score: number; risks: string[] } {
  const risks: string[] = [];
  const isGraduated = data.curveState?.isGraduated || data.isGraduatedApi;
  const isLocked = data.curveState?.isLocked || false;
  const progress = data.graduationProgress ?? 0;

  if (isGraduated) return { score: 15, risks: [] };
  // Only penalize locked if NOT graduated — graduated+locked is normal
  if (isLocked) return { score: 0, risks: ["Token locked during graduation process"] };

  let score: number;
  if (progress >= 80) score = 13;
  else if (progress >= 60) score = 10;
  else if (progress >= 40) score = 7;
  else if (progress >= 20) score = 4;
  else score = 2;

  if (progress < 20) risks.push(`Very early stage (${progress.toFixed(0)}% to graduation)`);

  return { score, risks };
}

function scoreVolumeLiquidity(data: CollectedTokenData): { score: number; risks: string[] } {
  const risks: string[] = [];

  // Need both liquidity and trade data
  const isGraduated = data.curveState?.isGraduated || data.isGraduatedApi;
  const liquidityMon = data.curveState
    ? Number(data.curveState.realMonReserve) / 1e18
    : 0;

  if (liquidityMon === 0 && !isGraduated) {
    return { score: 0, risks: ["No liquidity data for volume ratio"] };
  }

  if (data.trades.length === 0) {
    if (isGraduated) return { score: 10, risks: ["Trade volume from bonding curve period unavailable (graduated)"] };
    return { score: 2, risks: ["No trade data for volume analysis"] };
  }

  // Calculate trade volume from swap history
  let tradeVolMon = 0;
  for (const t of data.trades) {
    tradeVolMon += Number(t.amountMon) / 1e18;
  }

  if (isGraduated) {
    // For graduated tokens, use volume vs mcap instead
    if (data.marketCapUsd > 0) {
      const vtm = data.volume24h / data.marketCapUsd;
      if (vtm >= 0.05 && vtm <= 1.0) return { score: 16, risks: [] };
      if (vtm > 1.0) return { score: 10, risks: ["High volume/mcap ratio"] };
      return { score: 8, risks: [] };
    }
    return { score: 8, risks: [] };
  }

  const vtl = tradeVolMon / liquidityMon;

  let score: number;
  if (vtl >= 0.1 && vtl <= 1.0) score = 20;
  else if (vtl > 1.0 && vtl <= 3.0) score = 14;
  else if (vtl > 3.0) score = 6;
  else if (vtl >= 0.01) score = 10;
  else score = 4;

  if (vtl > 5.0) risks.push("Volume massively exceeds liquidity — extreme volatility risk");

  return { score, risks };
}

function scoreReserveUtilization(data: CollectedTokenData): { score: number; risks: string[] } {
  const risks: string[] = [];
  const isGraduated = data.curveState?.isGraduated || data.isGraduatedApi;

  if (!data.curveState) {
    if (isGraduated) return { score: 8, risks: [] };
    return { score: 0, risks: ["No curve data for reserve analysis"] };
  }

  if (isGraduated) return { score: 10, risks: [] };

  const real = Number(data.curveState.realMonReserve);
  const virtual = Number(data.curveState.virtualMonReserve);

  if (virtual === 0) return { score: 3, risks: ["Zero virtual reserves"] };

  const utilization = real / virtual;

  let score: number;
  if (utilization > 0.50) score = 15;
  else if (utilization > 0.30) score = 12;
  else if (utilization > 0.15) score = 9;
  else if (utilization > 0.05) score = 6;
  else score = 2;

  if (utilization < 0.05) risks.push(`Very low reserve utilization (${(utilization * 100).toFixed(1)}%)`);
  else if (utilization < 0.15) risks.push(`Low reserve utilization (${(utilization * 100).toFixed(1)}%)`);

  return { score, risks };
}

export const liquidityScout: ModelDefinition = {
  id: "liquidity-scout",
  name: "Liquidity Scout",
  description: "Analyzes liquidity health, price impact for standard trade sizes, graduation progress, and reserve utilization.",
  version: "2.0",
  creator: "monAlpha",
  breakdownLabels: ["Absolute Liquidity", "Price Impact", "Graduation Progress", "Volume/Liquidity", "Reserve Utilization"],

  run(data) {
    const liquidity = scoreAbsoluteLiquidity(data);
    const impact = scorePriceImpact(data);
    const graduation = scoreGraduationProgress(data);
    const volLiq = scoreVolumeLiquidity(data);
    const reserves = scoreReserveUtilization(data);

    const isMalpha = data.address?.toLowerCase() === MALPHA_TOKEN;
    const boost = isMalpha ? 20 : 0;
    const totalScore = Math.min(100, liquidity.score + impact.score + graduation.score + volLiq.score + reserves.score + boost);
    const allRisks = isMalpha
      ? []
      : [...liquidity.risks, ...impact.risks, ...graduation.risks, ...volLiq.risks, ...reserves.risks];

    // Normalize breakdown to 0-100% scale (each sub-score has different max)
    const maxScores = { liquidity: 25, impact: 25, graduation: 15, volLiq: 20, reserves: 15 };
    const pct = (raw: number, max: number) => Math.round((raw / max) * 100);

    const liquidityMon = data.curveState ? Number(data.curveState.realMonReserve) / 1e18 : 0;
    const progress = data.graduationProgress ?? 0;
    const isGrad = data.curveState?.isGraduated || data.isGraduatedApi;

    const parts: string[] = [`Liquidity analysis for $${data.symbol}.`];
    if (liquidityMon > 0) parts.push(`${liquidityMon.toFixed(2)} MON in bonding curve reserves.`);
    if (isGrad) parts.push("Token has graduated to DEX.");
    else if (progress > 0) parts.push(`Graduation progress: ${progress.toFixed(0)}%.`);
    if (data.holderCount > 0) parts.push(`${data.holderCount} holders.`);
    if (!data.hasApiData) parts.push("API data partially unavailable — analysis limited to on-chain data.");

    return {
      modelId: "liquidity-scout",
      modelName: "Liquidity Scout",
      signal: computeSignal(totalScore),
      score: totalScore,
      confidence: computeConfidence(totalScore),
      breakdown: {
        "Absolute Liquidity": pct(liquidity.score, maxScores.liquidity),
        "Price Impact": pct(impact.score, maxScores.impact),
        "Graduation Progress": pct(graduation.score, maxScores.graduation),
        "Volume/Liquidity": pct(volLiq.score, maxScores.volLiq),
        "Reserve Utilization": pct(reserves.score, maxScores.reserves),
      },
      reasoning: parts.join(" "),
      risks: allRisks,
    };
  },
};
