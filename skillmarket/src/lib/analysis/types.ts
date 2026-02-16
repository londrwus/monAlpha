import type { CurveState, NadMetricsTimeframe } from "../types";

// === Data collected for analysis ===

export interface CollectedTokenData {
  // From nad.fun API
  address: string;
  name: string;
  symbol: string;
  imageUrl: string;
  description: string;
  creator: string;
  isGraduatedApi: boolean;
  createdAt: string;

  // Market data
  priceUsd: number;
  priceMon: number;
  marketCapUsd: number;
  holderCount: number;
  volume24h: number;
  athPrice: number;

  // Metrics by timeframe
  metrics: {
    m1?: NadMetricsTimeframe;
    m5?: NadMetricsTimeframe;
    h1?: NadMetricsTimeframe;
    d1?: NadMetricsTimeframe;
  };

  // Recent trades
  trades: Array<{
    type: string;
    trader: string;
    amountMon: string;
    amountToken: string;
    priceUsd: number;
    timestamp: string;
  }>;

  // Creator history
  creatorTokenCount: number;
  creatorTokens: Array<{
    address: string;
    name: string;
    symbol: string;
    priceUsd: number;
    marketCapUsd: number;
  }>;

  // From on-chain (no rate limit)
  curveState: CurveState | null;
  graduationProgress: number | null;

  // Price impact quotes
  priceImpact: {
    buy1Mon: bigint | null;
    buy10Mon: bigint | null;
    buy100Mon: bigint | null;
  };

  totalSupply: bigint;

  // Data quality flag — true if nad.fun API calls succeeded
  hasApiData: boolean;
}

// === Serialized token data (JSON-safe, no bigints) ===

export interface SerializedTokenData {
  // Identity
  address: string;
  name: string;
  symbol: string;
  imageUrl: string;
  description: string;
  creator: string;
  isGraduated: boolean;
  createdAt: string;

  // Market
  priceUsd: number;
  priceMon: number;
  marketCapUsd: number;
  holderCount: number;
  volume24h: number;
  athPrice: number;

  // Metrics by timeframe
  metrics: {
    m1?: { timeframe: string; percent: number; transactions: number; volume: number; makers: number };
    m5?: { timeframe: string; percent: number; transactions: number; volume: number; makers: number };
    h1?: { timeframe: string; percent: number; transactions: number; volume: number; makers: number };
    d1?: { timeframe: string; percent: number; transactions: number; volume: number; makers: number };
  };

  // Liquidity (on-chain)
  realMonReserve: string;
  graduationProgress: number | null;
  isLocked: boolean;

  // Price impact (formatted strings)
  priceImpact: {
    buy1Mon: string | null;
    buy10Mon: string | null;
    buy100Mon: string | null;
  };

  // Trade summary
  totalTrades: number;
  buyCount: number;
  sellCount: number;
  uniqueTraders: number;
  recentTrades: Array<{
    type: string;
    trader: string;
    amountMon: string;
    amountToken: string;
    priceUsd: number;
    timestamp: string;
  }>;

  // Creator
  creatorTokenCount: number;
  creatorTokens: Array<{
    address: string;
    name: string;
    symbol: string;
    priceUsd: number;
    marketCapUsd: number;
  }>;

  totalSupply: string;
  hasApiData: boolean;
}

// === Analysis results ===

export type Signal = "BUY" | "WATCH" | "AVOID";
export type Confidence = "LOW" | "MEDIUM" | "HIGH";

export interface AnalysisResult {
  analysisId: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenImageUrl: string;
  modelId: string;
  modelName: string;
  signal: Signal;
  score: number;
  confidence: Confidence;
  breakdown: Record<string, number>;
  reasoning: string;
  risks: string[];
  timestamp: number;
  isAIPowered?: boolean;
}

// === Model definition ===

type PartialResult = Omit<
  AnalysisResult,
  "analysisId" | "tokenAddress" | "tokenName" | "tokenSymbol" | "tokenImageUrl" | "timestamp"
>;

export interface ModelDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  creator: string;
  breakdownLabels: string[];
  run: (data: CollectedTokenData) => PartialResult | Promise<PartialResult>;
}

// === Store types ===

export interface ModelStats {
  id: string;
  name: string;
  description: string;
  creator: string;
  version: string;
  usageCount: number;
  avgScore: number;
  signalDistribution: { BUY: number; WATCH: number; AVOID: number };
  lastUsed: number | null;
}

export function computeSignal(score: number): Signal {
  if (score >= 65) return "BUY";
  if (score >= 40) return "WATCH";
  return "AVOID";
}

export function computeConfidence(score: number): Confidence {
  if (score >= 75 || score <= 20) return "HIGH";
  if (score >= 55 || score <= 30) return "MEDIUM";
  return "LOW";
}
