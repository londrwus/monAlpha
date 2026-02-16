"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Search, Loader2, CandlestickChart, ChevronDown, Users, X } from "lucide-react";
import dynamic from "next/dynamic";
import { INDICATORS } from "@/components/TradingChart";
import type { OHLCVCandle } from "@/lib/indicators";

const TradingChart = dynamic(() => import("@/components/TradingChart"), { ssr: false });

interface TrendingToken {
  address: string;
  name: string;
  symbol: string;
  priceUsd: number;
  marketCapUsd: number;
  holderCount: number;
  volume: number;
}

const RESOLUTIONS = [
  { label: "1m", value: "1" },
  { label: "5m", value: "5" },
  { label: "1h", value: "60" },
  { label: "1D", value: "1D" },
] as const;

function formatPrice(raw: unknown): string {
  const n = Number(raw);
  if (!n || isNaN(n)) return "-";
  if (n < 0.000001) return `$${n.toExponential(2)}`;
  if (n < 0.0001) return `$${n.toFixed(8)}`;
  if (n < 0.01) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function formatCompact(raw: unknown): string {
  const n = Number(raw);
  if (!n || isNaN(n)) return "-";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default function ChartsPage() {
  const [tokenAddress, setTokenAddress] = useState("");
  const [resolution, setResolution] = useState("60");
  const [candles, setCandles] = useState<OHLCVCandle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedToken, setLoadedToken] = useState("");
  const [loadedName, setLoadedName] = useState("");

  // Trending tokens
  const [trending, setTrending] = useState<TrendingToken[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  // Indicators
  const [activeIndicators, setActiveIndicators] = useState<Set<string>>(new Set());
  const [showIndicatorPanel, setShowIndicatorPanel] = useState(false);
  const indicatorPanelRef = useRef<HTMLDivElement>(null);

  // Fetch trending tokens on mount
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch("/api/tokens/trending?limit=10");
        if (resp.ok) {
          const data = await resp.json();
          setTrending(data.tokens || []);
          // Auto-load first token
          if (data.tokens?.length > 0) {
            const first = data.tokens[0];
            loadChart(first.address, undefined, first.name || first.symbol);
          }
        }
      } catch {}
      setTrendingLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close indicator panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (indicatorPanelRef.current && !indicatorPanelRef.current.contains(e.target as Node)) {
        setShowIndicatorPanel(false);
      }
    }
    if (showIndicatorPanel) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showIndicatorPanel]);

  const loadChart = useCallback(async (addr?: string, res?: string, name?: string) => {
    const token = addr || tokenAddress;
    const resVal = res || resolution;
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const url = `/api/tokens/${encodeURIComponent(token)}/chart?resolution=${resVal}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `Failed to load chart (${resp.status})`);
      }
      const json = await resp.json();
      const raw = json.candles || json;
      if (!raw || raw.length === 0) {
        throw new Error("No chart data available for this token");
      }
      const chartCandles: OHLCVCandle[] = raw.map((c: Record<string, unknown>) => ({
        time: Number(c.time),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume),
      }));
      setCandles(chartCandles);
      setLoadedToken(token);
      setLoadedName(name || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCandles([]);
    } finally {
      setLoading(false);
    }
  }, [tokenAddress, resolution]);

  const handleResolutionChange = (res: string) => {
    setResolution(res);
    if (loadedToken) {
      loadChart(loadedToken, res, loadedName);
    }
  };

  const toggleIndicator = (id: string) => {
    setActiveIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const overlays = INDICATORS.filter((i) => i.category === "overlay");
  const oscillators = INDICATORS.filter((i) => i.category === "oscillator");
  const activeCount = activeIndicators.size;

  return (
    <div className="p-4 lg:p-6 h-full">
      {/* Top toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        {/* Search bar */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadChart()}
              placeholder="Paste token address 0x..."
              className="w-full pl-10 pr-4 py-2.5 bg-bg-secondary border border-border rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-green/40 focus:ring-1 focus:ring-accent-green/20 transition-all font-mono"
            />
          </div>
        </div>

        {/* Resolution picker */}
        <div className="flex gap-1 bg-bg-secondary border border-border rounded-xl p-1">
          {RESOLUTIONS.map((r) => (
            <button
              key={r.value}
              onClick={() => handleResolutionChange(r.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                resolution === r.value
                  ? "bg-accent-green/15 text-accent-green-light border border-accent-green/30"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Indicator dropdown */}
        <div className="relative" ref={indicatorPanelRef}>
          <button
            onClick={() => setShowIndicatorPanel(!showIndicatorPanel)}
            className="flex items-center gap-2 px-4 py-2.5 bg-bg-secondary border border-border rounded-xl text-sm text-text-secondary hover:text-text-primary transition-all"
          >
            <CandlestickChart className="w-4 h-4" />
            Indicators
            {activeCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-accent-green/20 text-accent-green-light text-[10px] font-mono font-bold">
                {activeCount}
              </span>
            )}
            <ChevronDown className={`w-3 h-3 transition-transform ${showIndicatorPanel ? "rotate-180" : ""}`} />
          </button>

          {showIndicatorPanel && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-bg-secondary border border-border rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="p-3 border-b border-border">
                <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-mono">Overlays</p>
              </div>
              <div className="p-2">
                {overlays.map((ind) => (
                  <button
                    key={ind.id}
                    onClick={() => toggleIndicator(ind.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-tertiary/50 transition-all"
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                        activeIndicators.has(ind.id)
                          ? "border-transparent"
                          : "border-border"
                      }`}
                      style={activeIndicators.has(ind.id) ? { backgroundColor: ind.color } : undefined}
                    >
                      {activeIndicators.has(ind.id) && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ind.color }} />
                    <span className="text-sm text-text-secondary">{ind.label}</span>
                  </button>
                ))}
              </div>
              <div className="p-3 border-t border-b border-border">
                <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-mono">Oscillators</p>
              </div>
              <div className="p-2">
                {oscillators.map((ind) => (
                  <button
                    key={ind.id}
                    onClick={() => toggleIndicator(ind.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-tertiary/50 transition-all"
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                        activeIndicators.has(ind.id)
                          ? "border-transparent"
                          : "border-border"
                      }`}
                      style={activeIndicators.has(ind.id) ? { backgroundColor: ind.color } : undefined}
                    >
                      {activeIndicators.has(ind.id) && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ind.color }} />
                    <span className="text-sm text-text-secondary">{ind.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Load button */}
        <button
          onClick={() => loadChart()}
          disabled={!tokenAddress || loading}
          className="px-5 py-2.5 bg-accent-green hover:bg-accent-green-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all flex items-center gap-2 text-sm"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <CandlestickChart className="w-4 h-4" />
              Load
            </>
          )}
        </button>
      </div>

      {/* Main content: sidebar + chart */}
      <div className="flex gap-4">
        {/* Token feed sidebar */}
        <div className="hidden lg:block w-60 flex-shrink-0">
          <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden sticky top-20">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Users className="w-4 h-4 text-accent-green-light" />
              <span className="text-xs font-medium uppercase tracking-wider">Top Holders</span>
            </div>
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
              {trendingLoading ? (
                <div className="p-4 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-text-tertiary" />
                </div>
              ) : trending.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-text-tertiary">No trending tokens</p>
                </div>
              ) : (
                trending.map((token) => {
                  const isSelected = loadedToken.toLowerCase() === token.address.toLowerCase();
                  return (
                    <button
                      key={token.address}
                      onClick={() => {
                        setTokenAddress(token.address);
                        loadChart(token.address, undefined, token.name || token.symbol);
                      }}
                      className={`w-full px-4 py-3 text-left border-b border-border/50 hover:bg-bg-tertiary/50 transition-all ${
                        isSelected ? "bg-accent-green/5 border-l-2 border-l-accent-green" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium truncate ${isSelected ? "text-accent-green-light" : ""}`}>
                          {token.symbol || token.name?.slice(0, 8) || token.address.slice(0, 8)}
                        </span>
                        <span className="text-[10px] text-text-tertiary font-mono">
                          {formatPrice(token.priceUsd)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-text-tertiary truncate max-w-[100px]">
                          {token.name || `${token.address.slice(0, 6)}...${token.address.slice(-4)}`}
                        </span>
                        {token.holderCount > 0 && (
                          <span className="text-[10px] text-text-tertiary font-mono">
                            {token.holderCount} holders
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Chart area */}
        <div className="flex-1 min-w-0">
          {/* Active indicator badges */}
          {activeCount > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {INDICATORS.filter((i) => activeIndicators.has(i.id)).map((ind) => (
                <span
                  key={ind.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono border border-border bg-bg-secondary"
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ind.color }} />
                  {ind.shortLabel}
                  <button
                    onClick={() => toggleIndicator(ind.id)}
                    className="ml-0.5 text-text-tertiary hover:text-text-primary"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-accent-red/10 border border-accent-red/20 rounded-xl p-4 mb-4">
              <p className="text-sm text-accent-red">{error}</p>
            </div>
          )}

          {/* Chart */}
          {candles.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {loadedName && (
                    <span className="text-sm font-medium">{loadedName}</span>
                  )}
                  <span className="text-xs text-text-tertiary font-mono">
                    {loadedToken.slice(0, 8)}...{loadedToken.slice(-6)}
                  </span>
                </div>
                <span className="text-xs text-text-tertiary font-mono">
                  {candles.length} candles
                </span>
              </div>
              <TradingChart candles={candles} activeIndicators={activeIndicators} />
            </div>
          )}

          {/* Empty state */}
          {candles.length === 0 && !loading && !error && (
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-bg-secondary border border-border flex items-center justify-center">
                <CandlestickChart className="w-8 h-8 text-text-tertiary" />
              </div>
              <h3 className="text-lg font-medium mb-2">Select a token or paste an address</h3>
              <p className="text-sm text-text-tertiary max-w-md mx-auto">
                Choose from trending tokens or paste any nad.fun token address to view candlestick charts with technical indicators.
              </p>
            </div>
          )}

          {/* Loading state */}
          {loading && candles.length === 0 && (
            <div className="text-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-accent-green-light mx-auto mb-4" />
              <p className="text-sm text-text-tertiary">Loading chart data...</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile trending (shown above chart on small screens) */}
      <div className="lg:hidden mt-4">
        {trending.length > 0 && (
          <div className="bg-bg-secondary border border-border rounded-xl p-3">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-mono mb-2">Top Holders</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {trending.slice(0, 6).map((token) => {
                const isSelected = loadedToken.toLowerCase() === token.address.toLowerCase();
                return (
                  <button
                    key={token.address}
                    onClick={() => {
                      setTokenAddress(token.address);
                      loadChart(token.address, undefined, token.name || token.symbol);
                    }}
                    className={`flex-shrink-0 px-3 py-2 rounded-lg border text-left transition-all ${
                      isSelected
                        ? "border-accent-green/30 bg-accent-green/10"
                        : "border-border hover:bg-bg-tertiary/50"
                    }`}
                  >
                    <p className={`text-xs font-medium ${isSelected ? "text-accent-green-light" : ""}`}>
                      {token.symbol || token.address.slice(0, 6)}
                    </p>
                    <p className="text-[10px] text-text-tertiary font-mono">{formatPrice(token.priceUsd)}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
