import type { CollectedTokenData } from "../analysis/types";
import type { ScoringCategory } from "./parser";

interface CategoryResult {
  score: number; // 0-100 normalized
  risks: string[];
}

// ── Canonical scoring functions ──
// Each returns 0-100 score. Extracted/adapted from the 3 built-in models.

function scoreHolderDistribution(data: CollectedTokenData): CategoryResult {
  const risks: string[] = [];
  const uniqueTraders = new Set(data.trades.filter((t) => t.trader).map((t) => t.trader.toLowerCase())).size;
  const holders = data.holderCount;
  const isGrad = data.curveState?.isGraduated || data.isGraduatedApi;

  if (!data.hasApiData && data.trades.length === 0) {
    return { score: 0, risks: ["Holder data unavailable"] };
  }

  // For graduated tokens with no bonding curve trades, use holder count
  if (isGrad && uniqueTraders === 0 && holders > 0) {
    let score: number;
    if (holders >= 1000) score = 100;
    else if (holders >= 500) score = 85;
    else if (holders >= 100) score = 70;
    else if (holders >= 50) score = 50;
    else if (holders >= 20) score = 30;
    else score = 10;
    return { score, risks: holders < 20 ? [`Low holder count (${holders})`] : [] };
  }

  let score: number;
  if (uniqueTraders >= 40) score = 100;
  else if (uniqueTraders >= 25) score = 85;
  else if (uniqueTraders >= 15) score = 70;
  else if (uniqueTraders >= 8) score = 50;
  else if (uniqueTraders >= 3) score = 30;
  else score = 10;

  if (holders < 5 && holders > 0) {
    score = Math.max(0, score - 25);
    risks.push(`Very low holder count (${holders})`);
  } else if (holders === 0) {
    score = Math.min(score, 20);
    risks.push("Holder count unknown or zero");
  }
  if (uniqueTraders < 3 && !isGrad) risks.push(`Extremely few unique traders (${uniqueTraders})`);

  return { score, risks };
}

function scoreLiquidityDepth(data: CollectedTokenData): CategoryResult {
  const risks: string[] = [];
  const isGraduated = data.curveState?.isGraduated || data.isGraduatedApi;

  if (!data.curveState) {
    if (isGraduated) return { score: 55, risks: [] };
    return { score: 0, risks: ["No on-chain liquidity data available"] };
  }
  if (isGraduated) return { score: 65, risks: [] };

  const liquidityMon = Number(data.curveState.realMonReserve) / 1e18;

  let score: number;
  if (liquidityMon >= 200) score = 100;
  else if (liquidityMon >= 100) score = 90;
  else if (liquidityMon >= 50) score = 75;
  else if (liquidityMon >= 20) score = 60;
  else if (liquidityMon >= 10) score = 45;
  else if (liquidityMon >= 5) score = 30;
  else if (liquidityMon >= 1) score = 15;
  else score = 0;

  if (liquidityMon < 1) risks.push("Critically low liquidity");
  else if (liquidityMon < 5) risks.push(`Very low liquidity (${liquidityMon.toFixed(2)} MON)`);

  return { score, risks };
}

function scoreCreatorTrust(data: CollectedTokenData): CategoryResult {
  const risks: string[] = [];
  if (!data.hasApiData || !data.creator) {
    return { score: 30, risks: ["Creator data unavailable"] };
  }

  const count = data.creatorTokenCount;

  let score: number;
  if (count <= 1) score = 100;
  else if (count === 2) score = 80;
  else if (count === 3) score = 60;
  else if (count <= 5) score = 40;
  else if (count <= 10) score = 20;
  else score = 0;

  if (count > 5) risks.push(`Serial token deployer (${count} tokens created)`);
  if (count > 2) risks.push(`Creator has deployed ${count} tokens total`);

  // creatorTokens is already filtered to exclude the current token in collector
  const deadTokens = data.creatorTokens.filter((t) => t.marketCapUsd < 100);
  if (deadTokens.length > 0) {
    risks.push(`Creator has ${deadTokens.length} dead/abandoned token(s)`);
    score = Math.max(0, score - 20);
  }

  return { score, risks };
}

function scoreTradingHealth(data: CollectedTokenData): CategoryResult {
  const risks: string[] = [];
  const buys = data.trades.filter((t) => t.type === "BUY").length;
  const total = data.trades.length;

  if (total === 0) return { score: 10, risks: ["No trade history available"] };
  if (total < 5) return { score: 30, risks: ["Very few trades"] };

  const buyRatio = buys / total;

  let score: number;
  if (buyRatio >= 0.4 && buyRatio <= 0.7) score = 100;
  else if (buyRatio > 0.7 && buyRatio <= 0.85) score = 65;
  else if (buyRatio > 0.85) score = 20;
  else if (buyRatio >= 0.3) score = 65;
  else score = 25;

  if (buyRatio > 0.9) risks.push(`Suspicious buy ratio (${(buyRatio * 100).toFixed(0)}% buys)`);
  if (buyRatio < 0.25) risks.push(`Heavy sell pressure (${((1 - buyRatio) * 100).toFixed(0)}% sells)`);

  return { score, risks };
}

function scorePriceImpact(data: CollectedTokenData): CategoryResult {
  const risks: string[] = [];
  const { buy1Mon, buy100Mon } = data.priceImpact;

  if (!buy1Mon || !buy100Mon) {
    const isGrad = data.curveState?.isGraduated || data.isGraduatedApi;
    if (isGrad) return { score: 40, risks: ["Price impact unavailable (graduated to DEX)"] };
    return { score: 0, risks: ["Price impact data unavailable"] };
  }

  const tpm1 = Number(buy1Mon) / 1e18;
  const tpm100 = Number(buy100Mon) / (100 * 1e18);
  if (tpm1 === 0) return { score: 0, risks: ["Zero output for price impact"] };

  const slippage100 = 1 - tpm100 / tpm1;

  let score: number;
  if (slippage100 < 0.02) score = 100;
  else if (slippage100 < 0.05) score = 88;
  else if (slippage100 < 0.10) score = 72;
  else if (slippage100 < 0.20) score = 56;
  else if (slippage100 < 0.40) score = 36;
  else if (slippage100 < 0.60) score = 16;
  else score = 0;

  if (slippage100 > 0.30) risks.push(`Very high price impact: ${(slippage100 * 100).toFixed(1)}% slippage on 100 MON`);

  return { score, risks };
}

function scoreGraduationProgress(data: CollectedTokenData): CategoryResult {
  const risks: string[] = [];
  const isGraduated = data.curveState?.isGraduated || data.isGraduatedApi;
  const isLocked = data.curveState?.isLocked || false;
  const progress = data.graduationProgress ?? 0;

  if (isGraduated) return { score: 100, risks: [] };
  if (isLocked) return { score: 0, risks: ["Token is locked"] };

  let score: number;
  if (progress >= 80) score = 87;
  else if (progress >= 60) score = 67;
  else if (progress >= 40) score = 47;
  else if (progress >= 20) score = 33;
  else score = 20;

  if (progress < 20) risks.push(`Very early stage (${progress.toFixed(0)}% to graduation)`);

  return { score, risks };
}

function scoreTokenAge(data: CollectedTokenData): CategoryResult {
  const risks: string[] = [];
  if (!data.createdAt) return { score: 30, risks: ["Token creation date unknown"] };

  const ageMs = Date.now() - new Date(data.createdAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  let score: number;
  if (ageHours > 168) score = 100;
  else if (ageHours > 72) score = 90;
  else if (ageHours > 24) score = 70;
  else if (ageHours > 6) score = 50;
  else if (ageHours > 1) score = 30;
  else score = 10;

  if (ageHours < 1) risks.push("Extremely new token (< 1 hour old)");
  else if (ageHours < 6) risks.push("Very new token (< 6 hours old)");

  return { score, risks };
}

function scoreBuySellRatio(data: CollectedTokenData): CategoryResult {
  const risks: string[] = [];
  if (data.trades.length === 0) return { score: 10, risks: ["No trade data"] };

  let buyVol = 0;
  let sellVol = 0;
  for (const t of data.trades) {
    const amt = Number(t.amountMon) / 1e18;
    if (t.type === "BUY") buyVol += amt;
    else sellVol += amt;
  }

  const totalVol = buyVol + sellVol;
  if (totalVol === 0) return { score: 25, risks: [] };

  const buyRatio = buyVol / totalVol;

  let score: number;
  if (buyRatio >= 0.40 && buyRatio <= 0.65) score = 100;
  else if (buyRatio > 0.65 && buyRatio <= 0.80) score = 75;
  else if (buyRatio > 0.80 && buyRatio <= 0.90) score = 50;
  else if (buyRatio > 0.90) score = 20;
  else if (buyRatio >= 0.25) score = 60;
  else score = 20;

  if (buyRatio > 0.90) risks.push("Extreme buy pressure — possible pump");
  if (buyRatio < 0.20) risks.push("Extreme sell pressure — possible dump");

  return { score, risks };
}

function scoreWhaleConcentration(data: CollectedTokenData): CategoryResult {
  const risks: string[] = [];
  const trades = data.trades;

  if (trades.length < 3) return { score: 20, risks: ["Insufficient trade data for whale analysis"] };

  const amounts = trades.map((t) => Number(t.amountMon) / 1e18).filter((a) => a > 0);
  if (amounts.length < 3) return { score: 25, risks: [] };

  const sorted = [...amounts].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const totalVol = amounts.reduce((a, b) => a + b, 0);
  if (totalVol === 0 || median === 0) return { score: 25, risks: [] };

  const whaleVol = amounts.filter((a) => a > median * 10).reduce((a, b) => a + b, 0);
  const whaleRatio = whaleVol / totalVol;

  let score: number;
  if (whaleRatio < 0.15) score = 100;
  else if (whaleRatio < 0.30) score = 84;
  else if (whaleRatio < 0.50) score = 64;
  else if (whaleRatio < 0.70) score = 40;
  else score = 16;

  if (whaleRatio >= 0.5) risks.push(`Whale dominance: ${(whaleRatio * 100).toFixed(0)}% of volume`);

  return { score, risks };
}

function scoreVolumeMcap(data: CollectedTokenData): CategoryResult {
  const risks: string[] = [];
  if (data.marketCapUsd === 0 && data.volume24h === 0) {
    return { score: data.hasApiData ? 0 : 10, risks: ["Market data unavailable"] };
  }
  if (data.marketCapUsd === 0) return { score: 15, risks: ["Zero market cap"] };

  const vtm = data.volume24h / data.marketCapUsd;

  let score: number;
  if (vtm >= 0.05 && vtm <= 0.8) score = 100;
  else if (vtm > 0.8 && vtm <= 2.0) score = 75;
  else if (vtm > 2.0 && vtm <= 5.0) score = 50;
  else if (vtm > 5.0) score = 25;
  else if (vtm >= 0.01) score = 60;
  else score = 20;

  if (vtm > 3.0) risks.push("Volume far exceeds market cap — possible wash trading");

  return { score, risks };
}

function scoreTraderDiversity(data: CollectedTokenData): CategoryResult {
  const risks: string[] = [];
  const traderCounts = new Map<string, number>();
  for (const t of data.trades) {
    if (!t.trader) continue;
    const addr = t.trader.toLowerCase();
    traderCounts.set(addr, (traderCounts.get(addr) || 0) + 1);
  }

  const uniqueTraders = traderCounts.size;
  if (uniqueTraders === 0) return { score: 0, risks: ["No traders detected"] };

  let score: number;
  if (uniqueTraders >= 35) score = 100;
  else if (uniqueTraders >= 20) score = 85;
  else if (uniqueTraders >= 12) score = 65;
  else if (uniqueTraders >= 6) score = 45;
  else if (uniqueTraders >= 3) score = 25;
  else score = 10;

  const total = data.trades.length;
  if (total > 0) {
    for (const [, count] of traderCounts) {
      const pct = count / total;
      if (pct > 0.5) {
        score = Math.max(0, score - 30);
        risks.push(`Single address dominates ${(pct * 100).toFixed(0)}% of trades`);
        break;
      }
    }
  }

  return { score, risks };
}

function scoreReserveUtilization(data: CollectedTokenData): CategoryResult {
  const risks: string[] = [];
  const isGraduated = data.curveState?.isGraduated || data.isGraduatedApi;

  if (!data.curveState) {
    if (isGraduated) return { score: 55, risks: [] };
    return { score: 0, risks: ["No curve data for reserve analysis"] };
  }
  if (isGraduated) return { score: 65, risks: [] };

  const real = Number(data.curveState.realMonReserve);
  const virtual = Number(data.curveState.virtualMonReserve);
  if (virtual === 0) return { score: 20, risks: ["Zero virtual reserves"] };

  const utilization = real / virtual;

  let score: number;
  if (utilization > 0.50) score = 100;
  else if (utilization > 0.30) score = 80;
  else if (utilization > 0.15) score = 60;
  else if (utilization > 0.05) score = 40;
  else score = 13;

  if (utilization < 0.05) risks.push(`Very low reserve utilization (${(utilization * 100).toFixed(1)}%)`);

  return { score, risks };
}

function scoreGrowthSignal(data: CollectedTokenData): CategoryResult {
  const risks: string[] = [];
  const h1 = data.metrics.h1;
  const d1 = data.metrics.d1;

  if (h1 && d1 && d1.makers > 0) {
    const hourlyRate = h1.makers / d1.makers;
    let score: number;
    if (hourlyRate > 0.15) score = 100;
    else if (hourlyRate > 0.08) score = 73;
    else if (hourlyRate > 0.03) score = 47;
    else score = 27;
    return { score, risks };
  }

  const holders = data.holderCount;
  if (holders === 0 && !data.hasApiData) return { score: 13, risks: ["Growth data unavailable"] };

  let score: number;
  if (holders >= 100) score = 87;
  else if (holders >= 50) score = 67;
  else if (holders >= 20) score = 47;
  else if (holders >= 5) score = 27;
  else score = 7;

  if (holders < 5) risks.push(`Very few holders (${holders})`);

  return { score, risks };
}

// ── Label → canonical category map ──

type ScoringFn = (data: CollectedTokenData) => CategoryResult;

const CANONICAL_CATEGORIES: Record<string, ScoringFn> = {
  holder_distribution: scoreHolderDistribution,
  liquidity_depth: scoreLiquidityDepth,
  creator_trust: scoreCreatorTrust,
  trading_health: scoreTradingHealth,
  price_impact: scorePriceImpact,
  graduation_progress: scoreGraduationProgress,
  token_age: scoreTokenAge,
  buy_sell_ratio: scoreBuySellRatio,
  whale_concentration: scoreWhaleConcentration,
  volume_mcap: scoreVolumeMcap,
  trader_diversity: scoreTraderDiversity,
  reserve_utilization: scoreReserveUtilization,
  growth_signal: scoreGrowthSignal,
};

// Fuzzy label → canonical key mapping
const LABEL_MAP: Record<string, string> = {
  // holder_distribution
  "holder distribution": "holder_distribution",
  "holders": "holder_distribution",
  "holder count": "holder_distribution",
  "holder concentration": "holder_distribution",
  // liquidity_depth
  "liquidity depth": "liquidity_depth",
  "liquidity": "liquidity_depth",
  "absolute liquidity": "liquidity_depth",
  // creator_trust
  "creator trust": "creator_trust",
  "creator history": "creator_trust",
  "creator reputation": "creator_trust",
  "creator": "creator_trust",
  // trading_health
  "trading health": "trading_health",
  "trading patterns": "trading_health",
  "trading": "trading_health",
  // price_impact
  "price impact": "price_impact",
  "slippage": "price_impact",
  // graduation_progress
  "graduation progress": "graduation_progress",
  "graduation": "graduation_progress",
  "lock/graduation": "graduation_progress",
  // token_age
  "token age": "token_age",
  "age": "token_age",
  // buy_sell_ratio
  "buy/sell ratio": "buy_sell_ratio",
  "buy sell ratio": "buy_sell_ratio",
  "buy/sell pressure": "buy_sell_ratio",
  "buy sell pressure": "buy_sell_ratio",
  // whale_concentration
  "whale concentration": "whale_concentration",
  "whale activity": "whale_concentration",
  "whales": "whale_concentration",
  // volume_mcap
  "volume/mcap": "volume_mcap",
  "volume mcap": "volume_mcap",
  "volume": "volume_mcap",
  "volume/liquidity": "volume_mcap",
  // trader_diversity
  "trader diversity": "trader_diversity",
  "diversity": "trader_diversity",
  // reserve_utilization
  "reserve utilization": "reserve_utilization",
  "reserves": "reserve_utilization",
  // growth_signal
  "growth signal": "growth_signal",
  "growth": "growth_signal",
  "momentum": "growth_signal",
  "social momentum": "growth_signal",
  // safety alias
  "safety": "creator_trust",
};

function resolveCategory(label: string): string | null {
  const key = label.toLowerCase().trim();
  if (LABEL_MAP[key]) return LABEL_MAP[key];
  // Partial match: check if any known key starts with or contains the label
  for (const [mapKey, canonical] of Object.entries(LABEL_MAP)) {
    if (mapKey.includes(key) || key.includes(mapKey)) return canonical;
  }
  return null;
}

export interface CustomScoringResult {
  totalScore: number;
  breakdown: Record<string, number>;
  risks: string[];
  unmatchedLabels: string[];
}

export function runCustomScoring(
  data: CollectedTokenData,
  categories: ScoringCategory[]
): CustomScoringResult {
  const breakdown: Record<string, number> = {};
  const allRisks: string[] = [];
  const unmatchedLabels: string[] = [];

  // Normalize weights to sum to 100
  const totalWeight = categories.reduce((s, c) => s + c.weight, 0);
  const normalizer = totalWeight > 0 ? 100 / totalWeight : 1;

  let totalScore = 0;

  for (const cat of categories) {
    const canonicalKey = resolveCategory(cat.label);
    const normalizedWeight = cat.weight * normalizer;

    if (canonicalKey && CANONICAL_CATEGORIES[canonicalKey]) {
      const result = CANONICAL_CATEGORIES[canonicalKey](data);
      // Convert 0-100 score to weighted contribution
      const contribution = (result.score / 100) * normalizedWeight;
      totalScore += contribution;
      breakdown[cat.label] = Math.round(result.score);
      allRisks.push(...result.risks);
    } else {
      // Unknown category: give neutral 50 score
      const contribution = 0.5 * normalizedWeight;
      totalScore += contribution;
      breakdown[cat.label] = 50;
      unmatchedLabels.push(cat.label);
    }
  }

  return {
    totalScore: Math.round(totalScore),
    breakdown,
    risks: [...new Set(allRisks)], // dedupe
    unmatchedLabels,
  };
}
