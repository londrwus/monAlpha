"use client";

import { useState, useEffect } from "react";
import type { TrendingToken } from "@/lib/types";

interface UseTrendingResult {
  tokens: TrendingToken[];
  isLoading: boolean;
  error: string | null;
}

let cache: { data: TrendingToken[]; timestamp: number } | null = null;
const CACHE_TTL = 60_000;

export function useTrending(limit = 10): UseTrendingResult {
  const [tokens, setTokens] = useState<TrendingToken[]>(cache?.data?.slice(0, limit) || []);
  const [isLoading, setIsLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      setTokens(cache.data.slice(0, limit));
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchTrending() {
      try {
        const res = await fetch(`/api/tokens/trending?limit=${limit}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          cache = { data: data.tokens, timestamp: Date.now() };
          setTokens(data.tokens);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
          setIsLoading(false);
        }
      }
    }

    fetchTrending();
    return () => { cancelled = true; };
  }, [limit]);

  return { tokens, isLoading, error };
}
