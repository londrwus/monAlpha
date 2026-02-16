import { type Address, parseEther } from "viem";
import { getTokenInfo, getMarketData, getMetrics, getSwapHistory, getCreatedTokens } from "../nadfun";
import { getCurveState, getProgress, getQuote, getErc20Metadata } from "../onchain";
import type { CollectedTokenData } from "./types";

// 60-second in-memory cache per token
const cache = new Map<string, { data: CollectedTokenData; expires: number }>();
const CACHE_TTL = 60_000;

/** Call API function, return null on any error (429 retry handled in nadFetch) */
async function safeCall<T>(fn: () => Promise<T>, label: string): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[collector] ${label} failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** Parse created_at — handles ISO strings, Unix seconds, and Unix milliseconds */
function parseCreatedAt(raw: string | number | undefined): string {
  if (!raw) return "";
  const str = String(raw);

  // Try ISO date string first
  const isoDate = new Date(str);
  if (!isNaN(isoDate.getTime()) && isoDate.getTime() > 1_000_000_000_000) {
    // Valid date and > year 2001 in ms — looks correct
    return isoDate.toISOString();
  }

  // Try as numeric value (could be Unix seconds or milliseconds)
  const num = Number(str);
  if (!isNaN(num) && num > 0) {
    // If < 1e12 it's likely seconds, otherwise milliseconds
    const ms = num < 1e12 ? num * 1000 : num;
    const d = new Date(ms);
    // Sanity: must be after 2024 (Monad didn't exist before) and not in the future
    if (d.getTime() > new Date("2024-01-01").getTime() && d.getTime() <= Date.now() + 86400000) {
      return d.toISOString();
    }
  }

  // Unparseable — return empty
  return "";
}

/** Sanitize volume — nad.fun sometimes returns raw/wei values instead of USD */
function sanitizeVolume(vol: number): number {
  if (!vol || !isFinite(vol)) return 0;
  // Anything above $10B is clearly wrong for a memecoin
  if (vol > 1e10) return 0;
  return vol;
}

/** Sanitize market cap */
function sanitizeMarketCap(mcap: number): number {
  if (!mcap || !isFinite(mcap)) return 0;
  // Anything above $100B is clearly wrong for a memecoin
  if (mcap > 1e11) return 0;
  return mcap;
}

export async function collectTokenData(tokenAddress: string): Promise<CollectedTokenData> {
  const key = tokenAddress.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const addr = tokenAddress as Address;

  // On-chain calls in parallel (no rate limit via QuickNode)
  const onChainResults = await Promise.allSettled([
    getCurveState(addr),
    getProgress(addr),
    getQuote(addr, parseEther("1"), true),
    getQuote(addr, parseEther("10"), true),
    getQuote(addr, parseEther("100"), true),
    getErc20Metadata(addr),
  ]);

  // Unpack on-chain results
  const curveState = onChainResults[0].status === "fulfilled" ? onChainResults[0].value : null;
  const graduationProgress = onChainResults[1].status === "fulfilled" ? onChainResults[1].value : null;
  const quote1 = onChainResults[2].status === "fulfilled" ? onChainResults[2].value : null;
  const quote10 = onChainResults[3].status === "fulfilled" ? onChainResults[3].value : null;
  const quote100 = onChainResults[4].status === "fulfilled" ? onChainResults[4].value : null;
  const erc20 = onChainResults[5].status === "fulfilled" ? onChainResults[5].value : null;

  // nad.fun API calls — rate limited globally via NadRateLimiter in nadfun.ts
  const tokenInfo = await safeCall(() => getTokenInfo(tokenAddress), "getTokenInfo");
  const marketData = await safeCall(() => getMarketData(tokenAddress), "getMarketData");
  const metricsRaw = await safeCall(() => getMetrics(tokenAddress), "getMetrics");
  const swapData = await safeCall(() => getSwapHistory(tokenAddress, 50), "getSwapHistory");

  // Build metrics map
  const metrics: CollectedTokenData["metrics"] = {};
  if (metricsRaw) {
    for (const m of metricsRaw) {
      if (m.timeframe === "1") metrics.m1 = m;
      else if (m.timeframe === "5") metrics.m5 = m;
      else if (m.timeframe === "60") metrics.h1 = m;
      else if (m.timeframe === "1D") metrics.d1 = m;
    }
  }

  // Build trades array — filter out trades with missing trader address
  // Normalize event_type to uppercase (API may return "buy"/"sell" or "BUY"/"SELL")
  const trades = swapData?.swaps
    ? swapData.swaps
        .filter((s) => s.trader)
        .map((s) => ({
          type: (s.event_type || "").toUpperCase(),
          trader: s.trader,
          amountMon: s.native_amount || "0",
          amountToken: s.token_amount || "0",
          priceUsd: s.price_usd || 0,
          timestamp: s.timestamp || "",
        }))
    : [];

  // Fetch creator history (5th nad.fun call)
  let creatorTokenCount = 1;
  let creatorTokens: CollectedTokenData["creatorTokens"] = [];

  const rawCreator = tokenInfo?.creator as unknown;
  const creatorAddr = typeof rawCreator === "string" ? rawCreator : (rawCreator as { account_id?: string } | undefined)?.account_id || "";
  if (creatorAddr) {
    try {
      const created = await safeCall(() => getCreatedTokens(creatorAddr, 1, 10), "getCreatedTokens");
      if (created) {
        creatorTokenCount = created.totalCount || 1;
        creatorTokens = (created.tokens || []).map((t) => ({
          address: (t.token_info?.token_address || "").toLowerCase(),
          name: t.token_info?.name || "Unknown",
          symbol: t.token_info?.symbol || "???",
          priceUsd: t.market_info?.price_usd || 0,
          marketCapUsd: sanitizeMarketCap(t.market_info?.market_cap_usd || 0),
        }));
      }
    } catch (e) {
      console.warn("[collector] getCreatedTokens failed:", e);
    }
  }

  // Track data availability for models
  const hasApiData = tokenInfo !== null;

  // Normalize address to lowercase for consistent comparison throughout
  const normalizedAddress = tokenAddress.toLowerCase();

  // Filter out current token from creator's token list
  const filteredCreatorTokens = creatorTokens.filter(
    (t) => t.address && t.address !== normalizedAddress
  );

  // Sanitize market data
  let marketCapUsd = sanitizeMarketCap(marketData?.market_cap_usd || 0);
  let volume24h = sanitizeVolume(marketData?.volume || 0);
  const priceUsd = marketData?.price_usd || 0;
  const totalSupply = erc20?.totalSupply ? BigInt(erc20.totalSupply) : 0n;

  // If market cap is $0 but we have a price + totalSupply, calculate it
  if (marketCapUsd === 0 && priceUsd > 0 && totalSupply > 0n) {
    const supplyNum = Number(totalSupply) / 1e18;
    const computed = priceUsd * supplyNum;
    if (isFinite(computed) && computed > 0 && computed < 1e11) {
      marketCapUsd = computed;
    }
  }

  // If volume was sanitized to 0 (was absurdly large), try to get from 24h metrics
  if (volume24h === 0 && metrics.d1 && metrics.d1.volume > 0) {
    const metricVol = metrics.d1.volume;
    if (metricVol < 1e10) {
      volume24h = metricVol;
    }
  }

  const data: CollectedTokenData = {
    address: normalizedAddress,
    name: tokenInfo?.name || erc20?.name || "Unknown",
    symbol: tokenInfo?.symbol || erc20?.symbol || "???",
    imageUrl: tokenInfo?.image_uri || "",
    description: tokenInfo?.description || "",
    creator: creatorAddr ? creatorAddr.toLowerCase() : "",
    isGraduatedApi: tokenInfo?.is_graduated || false,
    createdAt: parseCreatedAt(tokenInfo?.created_at),

    priceUsd,
    priceMon: marketData?.price_mon || 0,
    marketCapUsd,
    holderCount: marketData?.holder_count || 0,
    volume24h,
    athPrice: marketData?.ath_price || 0,

    metrics,
    trades,

    creatorTokenCount,
    creatorTokens: filteredCreatorTokens,

    curveState,
    graduationProgress,

    priceImpact: {
      buy1Mon: quote1?.amountOut ?? null,
      buy10Mon: quote10?.amountOut ?? null,
      buy100Mon: quote100?.amountOut ?? null,
    },

    totalSupply,
    hasApiData,
  };

  cache.set(key, { data, expires: Date.now() + CACHE_TTL });
  return data;
}
