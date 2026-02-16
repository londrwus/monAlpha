import { NAD_API_BASE, NAD_API_KEY, DEFAULT_METRICS_TIMEFRAMES } from "./constants";
import type {
  NadTokenInfoRaw,
  NadMarketDataRaw,
  NadMetricsRaw,
  NadChartRaw,
  NadSwapHistoryRaw,
  NadHoldingsRaw,
  NadCreatedTokensRaw,
  NadMetricsTimeframe,
  OHLCVCandle,
} from "./types";

export class NadFunApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "NadFunApiError";
  }
}

// ── Response cache ──
// Caches API responses for 30s to avoid burning rate-limit budget on repeated requests.
// This is the primary defense against 429s — most page loads re-request the same data.
const responseCache = new Map<string, { data: unknown; ts: number }>();
const RESPONSE_CACHE_TTL = 120_000; // 2 min

// ── Global rate limiter (sliding window) ──
// nad.fun enforces: 10 req/min without API key, 100 req/min with key.
// We match upstream limits so we never get 429s in normal usage.
class NadRateLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests = NAD_API_KEY ? 90 : 9;
  private readonly windowMs = 60_000;
  private pendingQueue: Array<() => void> = [];
  private draining = false;

  async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.pendingQueue.push(resolve);
      if (!this.draining) this.drain();
    });
  }

  private async drain() {
    this.draining = true;
    while (this.pendingQueue.length > 0) {
      const now = Date.now();
      this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

      if (this.timestamps.length < this.maxRequests) {
        this.timestamps.push(now);
        const next = this.pendingQueue.shift()!;
        next();
      } else {
        const waitMs = this.timestamps[0] + this.windowMs - now + 500;
        console.warn(`[rate-limiter] Budget full (${this.maxRequests}/${this.windowMs / 1000}s), waiting ${(waitMs / 1000).toFixed(1)}s...`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
    this.draining = false;
  }
}

const rateLimiter = new NadRateLimiter();

// In-flight dedup: if the same path is already being fetched, reuse the promise
const inFlight = new Map<string, Promise<unknown>>();

async function nadFetch<T>(path: string): Promise<T> {
  // 1. Check response cache first (free — no API call)
  const cached = responseCache.get(path);
  if (cached && Date.now() - cached.ts < RESPONSE_CACHE_TTL) {
    return cached.data as T;
  }

  // 2. Dedup: if this exact path is already in-flight, piggyback on it
  const existing = inFlight.get(path);
  if (existing) return existing as Promise<T>;

  const doFetch = async (): Promise<T> => {
    await rateLimiter.acquire();

    const url = `${NAD_API_BASE}${path}`;
    const headers: Record<string, string> = {};
    if (NAD_API_KEY) {
      headers["X-API-Key"] = NAD_API_KEY;
    }

    let res = await fetch(url, { headers, cache: "no-store" });

    // Auto-retry on 429 (up to 2 retries)
    for (let attempt = 0; attempt < 2 && res.status === 429; attempt++) {
      const text = await res.text().catch(() => "");
      const match = text.match(/"retry_after":(\d+)/);
      const wait = match ? Math.min(Number(match[1]), 10) : 5;
      console.warn(`[nadFetch] 429 on ${path}, retry ${attempt + 1} in ${wait}s...`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      res = await fetch(url, { headers, cache: "no-store" });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new NadFunApiError(res.status, `nad.fun API ${res.status}: ${text || res.statusText}`);
    }

    const data = await res.json() as T;
    // Cache the successful response
    responseCache.set(path, { data, ts: Date.now() });
    return data;
  };

  const promise = doFetch().finally(() => inFlight.delete(path));
  inFlight.set(path, promise);
  return promise;
}

export async function getTokenInfo(tokenId: string) {
  const raw = await nadFetch<NadTokenInfoRaw>(`/agent/token/${tokenId}`);
  return raw.token_info;
}

export async function getMarketData(tokenId: string) {
  const raw = await nadFetch<NadMarketDataRaw>(`/agent/market/${tokenId}`);
  return raw.market_info;
}

export async function getMetrics(
  tokenId: string,
  timeframes: string = DEFAULT_METRICS_TIMEFRAMES
): Promise<NadMetricsTimeframe[]> {
  const raw = await nadFetch<NadMetricsRaw>(
    `/agent/metrics/${tokenId}?timeframes=${timeframes}`
  );
  return raw.metrics;
}

export async function getChart(
  tokenId: string,
  resolution: string = "60",
  from?: number,
  to?: number
): Promise<OHLCVCandle[]> {
  const now = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams({
    resolution,
    from: String(from ?? now - 86400),
    to: String(to ?? now),
  });

  const raw = await nadFetch<NadChartRaw>(
    `/agent/chart/${tokenId}?${params}`
  );

  // Transform parallel arrays into candle objects
  if (!raw.t || raw.t.length === 0) return [];
  return raw.t.map((time, i) => ({
    time,
    open: raw.o[i],
    high: raw.h[i],
    low: raw.l[i],
    close: raw.c[i],
    volume: raw.v[i],
  }));
}

export async function getSwapHistory(
  tokenId: string,
  limit: number = 20,
  tradeType?: "BUY" | "SELL"
) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (tradeType) params.set("trade_type", tradeType);

  const raw = await nadFetch<NadSwapHistoryRaw>(
    `/agent/swap-history/${tokenId}?${params}`
  );
  return {
    swaps: raw.swaps.map((s) => s.swap_info),
    totalCount: raw.total_count,
  };
}

export async function getCreatedTokens(accountId: string, page = 1, limit = 10) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  const raw = await nadFetch<NadCreatedTokensRaw>(
    `/agent/token/created/${accountId}?${params}`
  );
  return {
    tokens: raw.tokens || [],
    totalCount: raw.total_count || 0,
  };
}

export async function getHoldings(accountId: string, page = 1, limit = 20) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  const raw = await nadFetch<NadHoldingsRaw>(
    `/agent/holdings/${accountId}?${params}`
  );
  return {
    tokens: raw.tokens || [],
    totalCount: raw.total_count || 0,
  };
}
