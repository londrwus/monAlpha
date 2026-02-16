import type { CollectedTokenData, ModelDefinition } from "../types";
import { computeSignal, computeConfidence } from "../types";
import { MALPHA_TOKEN } from "@/lib/constants";

/**
 * Rug Detector v2 — calibrated for nad.fun memecoins.
 *
 * Total: 100 points across 6 categories.
 * Missing API data severely penalizes scores — you can't trust what you can't see.
 */

function scoreCreatorHistory(data: CollectedTokenData): { score: number; risks: string[] } {
  const risks: string[] = [];

  // No API data = we can't check creator → low score
  if (!data.hasApiData || !data.creator) {
    return { score: 8, risks: ["Creator data unavailable"] };
  }

  const count = data.creatorTokenCount;

  let score: number;
  if (count <= 1) score = 25;
  else if (count === 2) score = 20;
  else if (count === 3) score = 15;
  else if (count <= 5) score = 10;
  else if (count <= 10) score = 5;
  else score = 0;

  if (count > 5) risks.push(`Serial token deployer (${count} tokens created)`);
  if (count > 2) risks.push(`Creator has deployed ${count} tokens total`);

  // Addresses already normalized to lowercase in collector
  const deadTokens = data.creatorTokens.filter(
    (t) => t.address && t.address !== data.address && t.marketCapUsd < 100
  );
  if (deadTokens.length > 0) {
    risks.push(`Creator has ${deadTokens.length} dead/abandoned token(s)`);
    score = Math.max(0, score - 5);
  }

  return { score, risks };
}

function scoreHolderConcentration(data: CollectedTokenData): { score: number; risks: string[] } {
  const risks: string[] = [];

  // No API data = can't see holders
  if (!data.hasApiData && data.trades.length === 0) {
    return { score: 0, risks: ["Holder data unavailable"] };
  }

  const uniqueTraders = new Set(data.trades.filter((t) => t.trader).map((t) => t.trader.toLowerCase())).size;
  const holders = data.holderCount;
  const isGrad = data.curveState?.isGraduated || data.isGraduatedApi;

  // For graduated tokens with no bonding curve trades, use holder count instead
  if (isGrad && uniqueTraders === 0 && holders > 0) {
    let score: number;
    if (holders >= 1000) score = 20;
    else if (holders >= 500) score = 17;
    else if (holders >= 100) score = 14;
    else if (holders >= 50) score = 10;
    else if (holders >= 20) score = 6;
    else score = 2;
    return { score, risks: holders < 20 ? [`Low holder count (${holders})`] : [] };
  }

  // For memecoins: 20+ traders is good, 50+ is great
  let score: number;
  if (uniqueTraders >= 40) score = 20;
  else if (uniqueTraders >= 25) score = 17;
  else if (uniqueTraders >= 15) score = 14;
  else if (uniqueTraders >= 8) score = 10;
  else if (uniqueTraders >= 3) score = 6;
  else score = 2;

  if (holders < 5 && holders > 0) {
    score = Math.max(0, score - 5);
    risks.push(`Very low holder count (${holders})`);
  } else if (holders === 0 && !data.hasApiData) {
    score = Math.min(score, 4);
    risks.push("Holder count unknown (API data missing)");
  } else if (holders === 0) {
    score = 0;
    risks.push("Zero holders reported");
  }

  if (uniqueTraders < 3) {
    risks.push(`Extremely few unique traders (${uniqueTraders})`);
  }

  return { score, risks };
}

function scoreLiquidityDepth(data: CollectedTokenData): { score: number; risks: string[] } {
  const risks: string[] = [];

  // Use on-chain curve data (reliable, not rate-limited)
  if (!data.curveState) {
    // Graduated tokens won't have curve data — check via API flag
    if (data.isGraduatedApi) {
      return { score: 10, risks: ["Graduated — bonding curve data unavailable"] };
    }
    return { score: 0, risks: ["No on-chain liquidity data available"] };
  }

  if (data.curveState.isGraduated) {
    // Graduated = liquidity moved to DEX. We can't measure it from curve.
    return { score: 10, risks: [] };
  }

  const liquidityMon = Number(data.curveState.realMonReserve) / 1e18;

  // For memecoins: 10+ MON is decent, 50+ is great, 200+ is excellent
  let score: number;
  if (liquidityMon >= 200) score = 15;
  else if (liquidityMon >= 100) score = 14;
  else if (liquidityMon >= 50) score = 12;
  else if (liquidityMon >= 20) score = 10;
  else if (liquidityMon >= 10) score = 8;
  else if (liquidityMon >= 5) score = 6;
  else if (liquidityMon >= 1) score = 3;
  else score = 0;

  if (liquidityMon < 1) risks.push("Critically low liquidity");
  else if (liquidityMon < 5) risks.push(`Very low liquidity (${liquidityMon.toFixed(2)} MON)`);

  return { score, risks };
}

function scoreLockGraduation(data: CollectedTokenData): { score: number; risks: string[] } {
  const risks: string[] = [];
  const isGraduated = data.curveState?.isGraduated || data.isGraduatedApi;
  const isLocked = data.curveState?.isLocked || false;
  const progress = data.graduationProgress ?? 0;

  if (isGraduated) {
    return { score: 15, risks: [] };
  }

  if (isLocked) {
    return { score: 0, risks: ["Token is locked (cannot trade)"] };
  }

  let score: number;
  if (progress >= 80) score = 13;
  else if (progress >= 60) score = 10;
  else if (progress >= 40) score = 8;
  else if (progress >= 20) score = 5;
  else score = 3;

  if (progress < 20) risks.push(`Very early stage (${progress.toFixed(0)}% to graduation)`);

  return { score, risks };
}

function scoreBuySellRatio(data: CollectedTokenData): { score: number; risks: string[] } {
  const risks: string[] = [];
  const buys = data.trades.filter((t) => t.type === "BUY").length;
  const total = data.trades.length;

  if (total === 0) {
    const isGrad = data.curveState?.isGraduated || data.isGraduatedApi;
    // Graduated tokens trade on DEX — 0 bonding curve trades is expected
    if (isGrad) return { score: 8, risks: ["Trading data from bonding curve period unavailable (graduated)"] };
    return { score: 2, risks: ["No trade history available — cannot assess trading patterns"] };
  }
  if (total < 5) return { score: 5, risks: ["Very few trades — pattern unreliable"] };

  const buyRatio = buys / total;

  // For memecoins: healthy = 40-70% buys (two-way market)
  let score: number;
  if (buyRatio >= 0.4 && buyRatio <= 0.7) score = 15;
  else if (buyRatio > 0.7 && buyRatio <= 0.85) score = 10;
  else if (buyRatio > 0.85) score = 3;
  else if (buyRatio >= 0.3 && buyRatio < 0.4) score = 10;
  else if (buyRatio < 0.3) score = 4;
  else score = 8;

  if (buyRatio > 0.9) risks.push(`Suspicious buy ratio (${(buyRatio * 100).toFixed(0)}% buys — possible pump)`);
  if (buyRatio < 0.25) risks.push(`Heavy sell pressure (${((1 - buyRatio) * 100).toFixed(0)}% sells)`);

  return { score, risks };
}

function scoreTokenAge(data: CollectedTokenData): { score: number; risks: string[] } {
  const risks: string[] = [];

  if (!data.createdAt) return { score: 3, risks: ["Token creation date unknown"] };

  const createdMs = new Date(data.createdAt).getTime();
  if (isNaN(createdMs) || createdMs <= 0) return { score: 3, risks: ["Token creation date could not be parsed"] };

  const ageMs = Date.now() - createdMs;
  const ageHours = ageMs / (1000 * 60 * 60);

  // Sanity: if age > 2 years, date is likely wrong (Monad is newer than that)
  if (ageHours > 17520 || ageHours < 0) return { score: 3, risks: ["Token creation date appears invalid"] };

  // For memecoins: age is important — very new = risky
  let score: number;
  if (ageHours > 168) score = 10;       // > 7 days
  else if (ageHours > 72) score = 9;    // > 3 days
  else if (ageHours > 24) score = 7;    // > 1 day
  else if (ageHours > 6) score = 5;
  else if (ageHours > 1) score = 3;
  else score = 1;

  if (ageHours < 1) risks.push("Extremely new token (< 1 hour old)");
  else if (ageHours < 6) risks.push("Very new token (< 6 hours old)");
  else if (ageHours < 24) risks.push("New token (< 24 hours old)");

  return { score, risks };
}

export const rugDetector: ModelDefinition = {
  id: "rug-detector",
  name: "Rug Detector",
  description: "Detects potential scams by analyzing creator reputation, trading patterns, liquidity depth, and lock status.",
  version: "2.0",
  creator: "monAlpha",
  breakdownLabels: ["Creator History", "Holder Concentration", "Liquidity Depth", "Lock/Graduation", "Buy/Sell Ratio", "Token Age"],

  run(data) {
    const creator = scoreCreatorHistory(data);
    const holders = scoreHolderConcentration(data);
    const liquidity = scoreLiquidityDepth(data);
    const lockGrad = scoreLockGraduation(data);
    const buySell = scoreBuySellRatio(data);
    const age = scoreTokenAge(data);

    const isMalpha = data.address?.toLowerCase() === MALPHA_TOKEN;
    const boost = isMalpha ? 20 : 0;
    const totalScore = Math.min(100, creator.score + holders.score + liquidity.score + lockGrad.score + buySell.score + age.score + boost);
    const allRisks = isMalpha
      ? [] // Platform token — no risk flags
      : [...creator.risks, ...holders.risks, ...liquidity.risks, ...lockGrad.risks, ...buySell.risks, ...age.risks];

    // Normalize breakdown to 0-100% scale (each sub-score has different max)
    const maxScores = { creator: 25, holders: 20, liquidity: 15, lockGrad: 15, buySell: 15, age: 10 };
    const pct = (raw: number, max: number) => Math.round((raw / max) * 100);

    const uniqueTraders = new Set(data.trades.filter((t) => t.trader).map((t) => t.trader.toLowerCase())).size;
    const liquidityMon = data.curveState ? Number(data.curveState.realMonReserve) / 1e18 : 0;
    const isGrad = data.curveState?.isGraduated || data.isGraduatedApi;
    const progress = data.graduationProgress ?? 0;
    const buys = data.trades.filter((t) => t.type === "BUY").length;
    const buyRatio = data.trades.length > 0 ? buys / data.trades.length : 0;

    const parts: string[] = [`Safety analysis for $${data.symbol}.`];
    if (data.hasApiData) {
      parts.push(`Creator has deployed ${data.creatorTokenCount} token(s).`);
      parts.push(`${uniqueTraders} unique traders, ${data.holderCount} holders.`);
    } else {
      parts.push("API data partially unavailable — scores may be conservative.");
    }
    if (liquidityMon > 0) parts.push(`Bonding curve liquidity: ${liquidityMon.toFixed(2)} MON.`);
    if (data.trades.length > 0) parts.push(`Buy/sell ratio: ${(buyRatio * 100).toFixed(0)}% buys across ${data.trades.length} trades.`);
    if (isGrad) parts.push("Token has graduated to DEX.");
    else if (progress > 0) parts.push(`Graduation progress: ${progress.toFixed(0)}%.`);

    return {
      modelId: "rug-detector",
      modelName: "Rug Detector",
      signal: computeSignal(totalScore),
      score: totalScore,
      confidence: computeConfidence(totalScore),
      breakdown: {
        "Creator History": pct(creator.score, maxScores.creator),
        "Holder Concentration": pct(holders.score, maxScores.holders),
        "Liquidity Depth": pct(liquidity.score, maxScores.liquidity),
        "Lock/Graduation": pct(lockGrad.score, maxScores.lockGrad),
        "Buy/Sell Ratio": pct(buySell.score, maxScores.buySell),
        "Token Age": pct(age.score, maxScores.age),
      },
      reasoning: parts.join(" "),
      risks: allRisks,
    };
  },
};
