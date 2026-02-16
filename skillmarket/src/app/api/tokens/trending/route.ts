import { NextRequest, NextResponse } from "next/server";
import { getMarketData } from "@/lib/nadfun";
import { getActiveDexTokens, getActivelyTradedTokens, getRecentCreations } from "@/lib/onchain";
import type { TrendingToken, TrendingResponse } from "@/lib/types";

// ── Cache ──
// Enriched list: rebuilt every hour via background enrichment
let enrichedCache: { data: TrendingToken[]; timestamp: number } | null = null;
const ENRICHED_TTL = 3_600_000; // 1 hour

// On-chain discovery cache: 5 min TTL (free RPC calls)
let onChainCache: { data: TrendingToken[]; timestamp: number } | null = null;
const ONCHAIN_TTL = 300_000; // 5 min

// ── Background enrichment state ──
// We progressively enrich ALL discovered tokens across multiple requests
// so that the list eventually sorts by holder count (most holders first)
type EnrichData = { priceUsd: number; marketCapUsd: number; holderCount: number; volume: number };
let enrichMap = new Map<string, EnrichData>();
let enrichQueue: string[] = [];       // Unenriched addresses still queued
let enrichRunning = false;
let enrichTimestamp = 0;               // When enrichMap was last fully rebuilt

// Budget per enrichment cycle — keep small to leave API budget for user-facing requests.
const ENRICH_PER_CYCLE = 5;

async function enrichBatch(batchSize: number) {
  if (enrichRunning || enrichQueue.length === 0) return;
  enrichRunning = true;
  try {
    // Pick up to batchSize addresses that haven't been enriched yet
    const batch: string[] = [];
    while (batch.length < batchSize && enrichQueue.length > 0) {
      const addr = enrichQueue.shift()!;
      if (!enrichMap.has(addr)) batch.push(addr);
    }
    for (const addr of batch) {
      try {
        const market = await getMarketData(addr);
        enrichMap.set(addr, {
          priceUsd: Number(market.price_usd) || 0,
          marketCapUsd: Number(market.market_cap_usd) || 0,
          holderCount: Number(market.holder_count) || 0,
          volume: Number(market.volume) || 0,
        });
      } catch {
        // Re-queue at the end for later retry
        enrichQueue.push(addr);
      }
    }
    rebuildEnrichedCache();
  } finally {
    enrichRunning = false;
  }
}

// Minimum holders to be listed — filters out dust/dead tokens
const MIN_HOLDERS = 10;

function sortByHolders(tokens: TrendingToken[]): TrendingToken[] {
  return tokens
    .filter((t) => t.holderCount >= MIN_HOLDERS)
    .sort((a, b) => {
      const aH = Number(a.holderCount);
      const bH = Number(b.holderCount);
      if (aH > 0 && bH > 0) return bH - aH;
      if (aH > 0) return -1;
      if (bH > 0) return 1;
      return 0; // preserve discovery ordering for unenriched
    });
}

function rebuildEnrichedCache() {
  if (!onChainCache) return;
  const tokens = onChainCache.data.map((t) => {
    const e = enrichMap.get(t.address);
    return e ? { ...t, priceUsd: e.priceUsd, marketCapUsd: e.marketCapUsd, holderCount: e.holderCount, volume: e.volume } : t;
  });
  enrichedCache = { data: sortByHolders(tokens), timestamp: Date.now() };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || 10), 20);

  // Always kick off background enrichment if there's work queued
  if (enrichQueue.length > 0 && !enrichRunning) {
    // Non-blocking — fire and forget
    enrichBatch(ENRICH_PER_CYCLE);
  }

  // Return enriched cache if fresh (1 hour)
  if (enrichedCache && Date.now() - enrichedCache.timestamp < ENRICHED_TTL) {
    return NextResponse.json({
      tokens: enrichedCache.data.slice(0, limit),
      total: enrichedCache.data.length,
    } satisfies TrendingResponse);
  }

  // Return on-chain cache if fresh (5 min)
  if (onChainCache && Date.now() - onChainCache.timestamp < ONCHAIN_TTL) {
    // Apply any enrichment data we've collected so far
    const tokens = onChainCache.data.map((t) => {
      const e = enrichMap.get(t.address);
      return e ? { ...t, priceUsd: e.priceUsd, marketCapUsd: e.marketCapUsd, holderCount: e.holderCount, volume: e.volume } : t;
    });
    return NextResponse.json({
      tokens: sortByHolders(tokens).slice(0, limit),
      total: tokens.length,
    } satisfies TrendingResponse);
  }

  try {
    // Fast token discovery using rate-limit-free /events API for DEX tokens
    // + smaller on-chain scan for bonding curve tokens (5k blocks = ~80min)
    const [dexTokens, traded, creations] = await Promise.all([
      getActiveDexTokens(),            // /events API → ~1-2s (rate-limit-free)
      getActivelyTradedTokens(5000n),   // on-chain CurveBuy scan → small range, fast
      getRecentCreations(5000n),        // on-chain CurveCreate scan → small range, fast
    ]);

    // Build name/symbol lookup from creation events
    const nameMap = new Map<string, { name: string; symbol: string }>();
    for (const c of creations) {
      nameMap.set(c.token.toLowerCase(), { name: c.name, symbol: c.symbol });
    }

    // Build priceNative lookup from DEX events (rate-limit-free data)
    const dexPriceMap = new Map<string, number>();
    for (const dt of dexTokens) {
      if (dt.priceNative > 0) dexPriceMap.set(dt.address, dt.priceNative);
    }

    // Merge: DEX tokens first (graduated, highest holders), then bonding curve traded, then new
    const seen = new Set<string>();
    const allTokens: { address: string; name: string; symbol: string; trades: number; graduated: boolean }[] = [];

    // DEX tokens (graduated) get priority — they have the most holders
    for (const dt of dexTokens) {
      const key = dt.address.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      allTokens.push({
        address: dt.address,
        name: dt.name,
        symbol: dt.symbol,
        trades: dt.trades + 1000, // prioritize in enrichment queue
        graduated: true,
      });
    }

    for (const t of traded) {
      const key = t.address.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const info = nameMap.get(key);
      allTokens.push({
        address: t.address,
        name: info?.name || `Token ${t.address.slice(0, 8)}`,
        symbol: info?.symbol || t.address.slice(2, 6).toUpperCase(),
        trades: t.trades,
        graduated: false,
      });
    }

    for (const c of creations) {
      const key = c.token.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      allTokens.push({ address: c.token, name: c.name, symbol: c.symbol, trades: 0, graduated: false });
    }

    if (allTokens.length === 0) {
      return NextResponse.json({ tokens: [], total: 0 } satisfies TrendingResponse);
    }

    // Build token list with any existing enrichment data
    const tokens: TrendingToken[] = allTokens.map((item) => {
      const e = enrichMap.get(item.address);
      return {
        address: item.address,
        name: item.name,
        symbol: item.symbol,
        imageUrl: "",
        creator: "",
        priceUsd: e?.priceUsd || 0,
        marketCapUsd: e?.marketCapUsd || 0,
        holderCount: e?.holderCount || 0,
        volume: e?.volume || 0,
      };
    });

    // Save on-chain cache (unsorted — we always sort at response time)
    onChainCache = { data: tokens, timestamp: Date.now() };

    // Queue ALL tokens for progressive enrichment (graduated first, then most traded)
    // Only reset the queue if enrichMap is stale (>1h) or empty
    const enrichStale = Date.now() - enrichTimestamp > ENRICHED_TTL;
    if (enrichMap.size === 0 || enrichStale) {
      enrichMap.clear();
      enrichTimestamp = Date.now();
      enrichQueue = allTokens
        .sort((a, b) => {
          // Graduated tokens first (they have the most holders)
          if (a.graduated && !b.graduated) return -1;
          if (!a.graduated && b.graduated) return 1;
          return b.trades - a.trades; // then most traded
        })
        .map((t) => t.address);
    } else {
      // Just add newly discovered tokens we haven't seen
      const newAddrs = allTokens
        .filter((t) => !enrichMap.has(t.address))
        .map((t) => t.address);
      enrichQueue.push(...newAddrs);
    }

    // Synchronous initial enrichment — enrich graduated/top tokens immediately
    if (enrichMap.size === 0 && enrichQueue.length > 0) {
      const initialBatch = 6;
      enrichRunning = true;
      try {
        const batch: string[] = [];
        while (batch.length < initialBatch && enrichQueue.length > 0) {
          const addr = enrichQueue.shift()!;
          batch.push(addr);
        }
        for (const addr of batch) {
          try {
            const market = await getMarketData(addr);
            enrichMap.set(addr, {
              priceUsd: Number(market.price_usd) || 0,
              marketCapUsd: Number(market.market_cap_usd) || 0,
              holderCount: Number(market.holder_count) || 0,
              volume: Number(market.volume) || 0,
            });
          } catch {
            enrichQueue.push(addr);
          }
        }
      } finally {
        enrichRunning = false;
      }

      // Apply enrichment to tokens
      for (const t of tokens) {
        const e = enrichMap.get(t.address);
        if (e) {
          t.priceUsd = e.priceUsd;
          t.marketCapUsd = e.marketCapUsd;
          t.holderCount = e.holderCount;
          t.volume = e.volume;
        }
      }
      onChainCache = { data: tokens, timestamp: Date.now() };
      rebuildEnrichedCache();
    }

    return NextResponse.json({
      tokens: sortByHolders(tokens).slice(0, limit),
      total: tokens.length,
    } satisfies TrendingResponse);
  } catch (err) {
    const fallback = enrichedCache || onChainCache;
    if (fallback) {
      return NextResponse.json({
        tokens: fallback.data.slice(0, limit),
        total: fallback.data.length,
      } satisfies TrendingResponse);
    }
    return NextResponse.json(
      { error: "Failed to fetch tokens", message: String(err) },
      { status: 502 },
    );
  }
}
