import type { CollectedTokenData, ModelDefinition } from "../types";
import { computeSignal, computeConfidence } from "../types";
import { MALPHA_TOKEN } from "@/lib/constants";

/**
 * Whale Tracker v2 — calibrated for nad.fun memecoins.
 *
 * Total: 100 points across 5 categories.
 * This model is heavily trade-dependent. With no trade data, scores will be very low.
 */

function scoreWhaleConcentration(data: CollectedTokenData): { score: number; risks: string[] } {
  const risks: string[] = [];
  const trades = data.trades;

  if (trades.length < 3) {
    const isGrad = data.curveState?.isGraduated || data.isGraduatedApi;
    if (isGrad && data.holderCount > 50) {
      return { score: 12, risks: ["Bonding curve trade data unavailable (graduated to DEX)"] };
    }
    return { score: 3, risks: ["Insufficient trade data for whale analysis"] };
  }

  const amounts = trades.map((t) => Number(t.amountMon) / 1e18).filter((a) => a > 0);
  if (amounts.length < 3) return { score: 5, risks: ["Too few valid trades"] };

  const sorted = [...amounts].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const totalVol = amounts.reduce((a, b) => a + b, 0);

  if (totalVol === 0 || median === 0) return { score: 5, risks: [] };

  const whaleVol = amounts.filter((a) => a > median * 10).reduce((a, b) => a + b, 0);
  const whaleRatio = whaleVol / totalVol;
  const maxTrade = Math.max(...amounts);

  // For memecoins: some whale activity is normal, extreme concentration is red flag
  let score: number;
  if (whaleRatio < 0.15) score = 25;
  else if (whaleRatio < 0.30) score = 21;
  else if (whaleRatio < 0.50) score = 16;
  else if (whaleRatio < 0.70) score = 10;
  else score = 4;

  if (whaleRatio >= 0.5) risks.push(`Whale dominance: top traders hold ${(whaleRatio * 100).toFixed(0)}% of volume`);
  if (maxTrade > median * 100) risks.push(`Massive single trade detected (${maxTrade.toFixed(2)} MON vs median ${median.toFixed(4)} MON)`);

  return { score, risks };
}

function scoreTraderDiversity(data: CollectedTokenData): { score: number; risks: string[] } {
  const risks: string[] = [];
  const traderCounts = new Map<string, number>();

  for (const t of data.trades) {
    if (!t.trader) continue;
    const addr = t.trader.toLowerCase();
    traderCounts.set(addr, (traderCounts.get(addr) || 0) + 1);
  }

  const uniqueTraders = traderCounts.size;

  if (uniqueTraders === 0) {
    const isGrad = data.curveState?.isGraduated || data.isGraduatedApi;
    if (isGrad && data.holderCount > 50) {
      return { score: 10, risks: ["Trading diversity from bonding curve period unavailable (graduated)"] };
    }
    return { score: 0, risks: ["No traders detected"] };
  }

  // For memecoins: 10+ unique traders is decent, 30+ is great
  let score: number;
  if (uniqueTraders >= 35) score = 20;
  else if (uniqueTraders >= 20) score = 17;
  else if (uniqueTraders >= 12) score = 13;
  else if (uniqueTraders >= 6) score = 9;
  else if (uniqueTraders >= 3) score = 5;
  else score = 2;

  // Penalize for single-address dominance
  const total = data.trades.length;
  if (total > 0) {
    for (const [, count] of traderCounts) {
      const pct = count / total;
      if (pct > 0.5) {
        score = Math.max(0, score - 6);
        risks.push(`Single address dominates ${(pct * 100).toFixed(0)}% of trades`);
        break;
      } else if (pct > 0.35) {
        score = Math.max(0, score - 3);
        risks.push(`Single address accounts for ${(pct * 100).toFixed(0)}% of trades`);
        break;
      }
    }
  }

  return { score, risks };
}

function scoreBuySellPressure(data: CollectedTokenData): { score: number; risks: string[] } {
  const risks: string[] = [];

  if (data.trades.length === 0) {
    const isGrad = data.curveState?.isGraduated || data.isGraduatedApi;
    if (isGrad) return { score: 10, risks: ["Buy/sell pressure from bonding curve period unavailable (graduated)"] };
    return { score: 2, risks: ["No trade data available"] };
  }
  if (data.trades.length < 3) return { score: 5, risks: ["Very few trades — pressure unreliable"] };

  let buyVol = 0;
  let sellVol = 0;
  for (const t of data.trades) {
    const amt = Number(t.amountMon) / 1e18;
    if (t.type === "BUY") buyVol += amt;
    else sellVol += amt;
  }

  const totalVol = buyVol + sellVol;
  if (totalVol === 0) return { score: 5, risks: [] };

  const buyRatio = buyVol / totalVol;

  // Healthy two-way market = best. All buys or all sells = risky
  let score: number;
  if (buyRatio >= 0.40 && buyRatio <= 0.65) score = 20;
  else if (buyRatio > 0.65 && buyRatio <= 0.80) score = 15;
  else if (buyRatio > 0.80 && buyRatio <= 0.90) score = 10;
  else if (buyRatio > 0.90) score = 4;
  else if (buyRatio >= 0.25) score = 12;
  else score = 4;

  if (buyRatio > 0.90) risks.push("Extreme buy pressure — may indicate coordinated pump");
  if (buyRatio < 0.20) risks.push("Extreme sell pressure — possible dump in progress");

  return { score, risks };
}

function scoreGrowthSignal(data: CollectedTokenData): { score: number; risks: string[] } {
  const risks: string[] = [];
  const h1 = data.metrics.h1;
  const d1 = data.metrics.d1;

  // If we have hourly vs daily maker ratio, use it
  if (h1 && d1 && d1.makers > 0) {
    const hourlyRate = h1.makers / d1.makers;
    let score: number;
    if (hourlyRate > 0.15) score = 15;
    else if (hourlyRate > 0.08) score = 11;
    else if (hourlyRate > 0.03) score = 7;
    else score = 4;
    return { score, risks };
  }

  // Fallback: holder count
  const holders = data.holderCount;
  if (holders === 0 && !data.hasApiData) {
    return { score: 2, risks: ["Growth data unavailable"] };
  }

  let score: number;
  if (holders >= 100) score = 13;
  else if (holders >= 50) score = 10;
  else if (holders >= 20) score = 7;
  else if (holders >= 5) score = 4;
  else score = 1;

  if (holders < 5) risks.push(`Very few holders (${holders})`);

  return { score, risks };
}

function scoreVolumeMcap(data: CollectedTokenData): { score: number; risks: string[] } {
  const risks: string[] = [];

  if (data.marketCapUsd === 0 && data.volume24h === 0) {
    const isGrad = data.curveState?.isGraduated || data.isGraduatedApi;
    if (!data.hasApiData) return { score: 2, risks: ["Market data unavailable"] };
    if (isGrad && data.holderCount > 50) {
      return { score: 8, risks: ["Market data may be stale for graduated token"] };
    }
    return { score: 0, risks: ["Zero market cap and volume reported"] };
  }

  if (data.marketCapUsd === 0) {
    const isGrad = data.curveState?.isGraduated || data.isGraduatedApi;
    if (isGrad) return { score: 8, risks: ["Market cap unavailable for graduated token — API data may be stale"] };
    return { score: 3, risks: ["Zero market cap — cannot calculate ratio"] };
  }

  const vtm = data.volume24h / data.marketCapUsd;

  // For memecoins: higher volume/mcap is actually normal
  let score: number;
  if (vtm >= 0.05 && vtm <= 0.8) score = 20;
  else if (vtm > 0.8 && vtm <= 2.0) score = 15;
  else if (vtm > 2.0 && vtm <= 5.0) score = 10;
  else if (vtm > 5.0) score = 5;
  else if (vtm >= 0.01) score = 12;
  else score = 4;

  if (vtm > 3.0) risks.push("Volume far exceeds market cap — possible wash trading");
  if (vtm < 0.01 && data.marketCapUsd > 0) risks.push("Extremely low trading activity relative to market cap");

  return { score, risks };
}

export const whaleTracker: ModelDefinition = {
  id: "whale-tracker",
  name: "Whale Tracker",
  description: "Analyzes trading patterns for whale activity, concentration risk, and organic growth signals.",
  version: "2.0",
  creator: "monAlpha",
  breakdownLabels: ["Whale Concentration", "Trader Diversity", "Buy/Sell Pressure", "Growth Signal", "Volume/MCap"],

  run(data) {
    const whales = scoreWhaleConcentration(data);
    const diversity = scoreTraderDiversity(data);
    const pressure = scoreBuySellPressure(data);
    const growth = scoreGrowthSignal(data);
    const vtm = scoreVolumeMcap(data);

    const isMalpha = data.address?.toLowerCase() === MALPHA_TOKEN;
    const boost = isMalpha ? 20 : 0;
    const totalScore = Math.min(100, whales.score + diversity.score + pressure.score + growth.score + vtm.score + boost);
    const allRisks = isMalpha
      ? []
      : [...whales.risks, ...diversity.risks, ...pressure.risks, ...growth.risks, ...vtm.risks];

    // Normalize breakdown to 0-100% scale (each sub-score has different max)
    const maxScores = { whales: 25, diversity: 20, pressure: 20, growth: 15, vtm: 20 };
    const pct = (raw: number, max: number) => Math.round((raw / max) * 100);

    const uniqueTraders = new Set(data.trades.filter((t) => t.trader).map((t) => t.trader.toLowerCase())).size;
    let buyVol = 0;
    let totalVol = 0;
    for (const t of data.trades) {
      const amt = Number(t.amountMon) / 1e18;
      totalVol += amt;
      if (t.type === "BUY") buyVol += amt;
    }
    const buyPct = totalVol > 0 ? (buyVol / totalVol * 100).toFixed(0) : "N/A";
    const vtmRatio = data.marketCapUsd > 0 ? (data.volume24h / data.marketCapUsd).toFixed(3) : "N/A";

    const parts: string[] = [`Whale analysis for $${data.symbol}.`];
    if (uniqueTraders > 0) {
      parts.push(`${uniqueTraders} unique traders across ${data.trades.length} trades.`);
      parts.push(`Buy pressure: ${buyPct}% of volume.`);
    } else {
      parts.push("No trade data available — whale analysis limited to market metrics.");
    }
    if (vtmRatio !== "N/A") parts.push(`Volume/MCap ratio: ${vtmRatio}.`);
    if (data.holderCount > 0) parts.push(`${data.holderCount} holders.`);

    return {
      modelId: "whale-tracker",
      modelName: "Whale Tracker",
      signal: computeSignal(totalScore),
      score: totalScore,
      confidence: computeConfidence(totalScore),
      breakdown: {
        "Whale Concentration": pct(whales.score, maxScores.whales),
        "Trader Diversity": pct(diversity.score, maxScores.diversity),
        "Buy/Sell Pressure": pct(pressure.score, maxScores.pressure),
        "Growth Signal": pct(growth.score, maxScores.growth),
        "Volume/MCap": pct(vtm.score, maxScores.vtm),
      },
      reasoning: parts.join(" "),
      risks: allRisks,
    };
  },
};
