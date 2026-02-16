"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, TrendingUp, Eye, AlertTriangle, ChevronRight, X, Users, Droplets, ArrowUpDown, User, ExternalLink, CheckCircle2, Sparkles } from "lucide-react";
import type { SerializedTokenData } from "@/lib/analysis/types";

interface AnalysisCardProps {
  signal: "BUY" | "WATCH" | "AVOID";
  score: number;
  model: string;
  reasoning: string;
  risks: string[];
  confidence: "LOW" | "MEDIUM" | "HIGH";
  breakdown?: Record<string, number>;
  compact?: boolean;
  tokenData?: SerializedTokenData;
  isAIPowered?: boolean;
}

const signalConfig = {
  BUY: { color: "text-accent-green-light", bg: "bg-accent-green/15", border: "border-accent-green/30", icon: TrendingUp, label: "BUY" },
  WATCH: { color: "text-accent-yellow", bg: "bg-accent-yellow/15", border: "border-accent-yellow/30", icon: Eye, label: "WATCH" },
  AVOID: { color: "text-accent-red", bg: "bg-accent-red/15", border: "border-accent-red/30", icon: Shield, label: "AVOID" },
};

function formatCompact(raw: unknown): string {
  const val = Number(raw);
  if (!val || isNaN(val)) return "$0";
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(2)}K`;
  if (val >= 1) return `$${val.toFixed(2)}`;
  if (val > 0) return `$${val.toFixed(6)}`;
  return "$0";
}

function formatTokenAmount(val: string | null): string {
  if (!val) return "N/A";
  const num = parseFloat(val);
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toFixed(2);
}

function truncateAddr(raw: unknown): string {
  const addr = String(raw || "");
  if (!addr || addr.length < 10) return addr || "Unknown";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function AnalysisCard({
  signal,
  score,
  model,
  reasoning,
  risks,
  confidence,
  breakdown,
  compact = false,
  tokenData,
  isAIPowered,
}: AnalysisCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cfg = signalConfig[signal];
  const Icon = cfg.icon;

  if (compact) {
    return (
      <div className="p-4 bg-bg-secondary border border-border rounded-xl hover:border-border-light transition-colors group cursor-pointer">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-text-primary">{model}</span>
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${cfg.bg} ${cfg.color} ${cfg.border} border`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-semibold font-mono">{score}</span>
          <span className="text-xs text-text-tertiary">{confidence} confidence</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 bg-bg-secondary border border-border rounded-2xl hover:border-border-light transition-all">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Model</p>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-medium">{model}</h3>
              {isAIPowered && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Sparkles className="w-3 h-3" />
                  AI
                </span>
              )}
            </div>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${cfg.bg} ${cfg.color} ${cfg.border} border`}>
            <Icon className="w-4 h-4" />
            {cfg.label}
          </div>
        </div>

        <div className="flex items-end gap-2 mb-5">
          <span className="text-4xl font-bold font-mono">{score}</span>
          <span className="text-lg text-text-tertiary font-mono mb-1">/100</span>
          <div className="ml-auto px-2 py-0.5 bg-bg-tertiary rounded text-xs text-text-secondary">
            {confidence} confidence
          </div>
        </div>

        {breakdown && Object.keys(breakdown).length > 0 && (
          <div className={`grid gap-3 mb-5 ${Object.keys(breakdown).length <= 3 ? "grid-cols-3" : Object.keys(breakdown).length <= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
            {Object.entries(breakdown).map(([label, value]) => (
              <BreakdownBar key={label} label={label} value={value} />
            ))}
          </div>
        )}

        <p className="text-sm text-text-secondary leading-relaxed mb-4">{reasoning}</p>

        {risks.length > 0 && (
          <div className="space-y-2 mb-4">
            {risks.slice(0, 3).map((risk, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-accent-yellow">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>{risk}</span>
              </div>
            ))}
            {risks.length > 3 && !expanded && (
              <span className="text-xs text-text-tertiary">+{risks.length - 3} more risks</span>
            )}
          </div>
        )}

        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-text-secondary hover:text-text-primary bg-bg-tertiary hover:bg-bg-tertiary/80 rounded-lg transition-colors"
        >
          View Full Report <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Full Report Modal */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setExpanded(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
              className="bg-bg-primary border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
            {/* Modal Header */}
            <div className="sticky top-0 bg-bg-primary border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${cfg.bg} ${cfg.color} ${cfg.border} border`}>
                  <Icon className="w-4 h-4" />
                  {cfg.label}
                </div>
                <h2 className="text-lg font-semibold">{model}</h2>
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Token Header (if tokenData available) */}
              {tokenData && (
                <div className="flex items-center gap-4">
                  {tokenData.imageUrl && (
                    <img src={tokenData.imageUrl} alt={tokenData.name} className="w-12 h-12 rounded-xl border border-border" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold truncate">{tokenData.name}</h3>
                      <span className="text-sm text-text-tertiary font-mono">${tokenData.symbol}</span>
                      {tokenData.isGraduated && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-accent-green/10 text-accent-green-light border border-accent-green/20">
                          <CheckCircle2 className="w-3 h-3" />
                          Graduated
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-tertiary font-mono">{truncateAddr(tokenData.address)}</p>
                  </div>
                </div>
              )}

              {/* Market Stats Grid */}
              {tokenData && tokenData.hasApiData && (
                <div>
                  <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">Market Stats</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <StatCell label="Price" value={formatCompact(tokenData.priceUsd)} />
                    <StatCell label="Market Cap" value={formatCompact(tokenData.marketCapUsd)} />
                    <StatCell label="Volume 24h" value={formatCompact(tokenData.volume24h)} />
                    <StatCell label="Holders" value={String(tokenData.holderCount)} />
                    <StatCell label="ATH Price" value={formatCompact(tokenData.athPrice)} />
                    <StatCell label="Price (MON)" value={tokenData.priceMon > 0 ? tokenData.priceMon.toFixed(8) : "N/A"} />
                  </div>
                </div>
              )}

              {/* Liquidity Section */}
              {tokenData && (
                <div>
                  <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Droplets className="w-4 h-4" />
                    Liquidity
                  </h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <StatCell
                        label="Curve Reserves"
                        value={tokenData.isGraduated ? "DEX (graduated)" : `${(parseFloat(tokenData.realMonReserve) / 1e18).toFixed(2)} MON`}
                      />
                      <StatCell
                        label="Graduation"
                        value={tokenData.graduationProgress !== null ? `${tokenData.graduationProgress.toFixed(1)}%` : "N/A"}
                      />
                      <StatCell
                        label="Status"
                        value={tokenData.isGraduated ? "Graduated" : tokenData.isLocked ? "Locked" : "Active"}
                      />
                    </div>
                    {/* Price Impact */}
                    <div className="p-3 bg-bg-secondary border border-border rounded-xl">
                      <p className="text-xs text-text-tertiary mb-2">Price Impact (tokens received)</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-[10px] text-text-tertiary">1 MON buy</p>
                          <p className="text-sm font-mono text-text-primary">{formatTokenAmount(tokenData.priceImpact.buy1Mon)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-text-tertiary">10 MON buy</p>
                          <p className="text-sm font-mono text-text-primary">{formatTokenAmount(tokenData.priceImpact.buy10Mon)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-text-tertiary">100 MON buy</p>
                          <p className="text-sm font-mono text-text-primary">{formatTokenAmount(tokenData.priceImpact.buy100Mon)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Trade Summary */}
              {tokenData && tokenData.totalTrades > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4" />
                    Trade Summary
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    <StatCell label="Total Trades" value={String(tokenData.totalTrades)} />
                    <StatCell label="Buys" value={String(tokenData.buyCount)} highlight="green" />
                    <StatCell label="Sells" value={String(tokenData.sellCount)} highlight="red" />
                    <StatCell label="Unique Traders" value={String(tokenData.uniqueTraders)} />
                  </div>
                  {/* Buy/Sell Ratio Bar */}
                  <div className="p-3 bg-bg-secondary border border-border rounded-xl">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-accent-green-light">Buys {tokenData.totalTrades > 0 ? `${((tokenData.buyCount / tokenData.totalTrades) * 100).toFixed(0)}%` : ""}</span>
                      <span className="text-accent-red">Sells {tokenData.totalTrades > 0 ? `${((tokenData.sellCount / tokenData.totalTrades) * 100).toFixed(0)}%` : ""}</span>
                    </div>
                    <div className="h-2.5 bg-bg-tertiary rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-accent-green rounded-l-full"
                        style={{ width: `${tokenData.totalTrades > 0 ? (tokenData.buyCount / tokenData.totalTrades) * 100 : 50}%` }}
                      />
                      <div
                        className="h-full bg-accent-red rounded-r-full"
                        style={{ width: `${tokenData.totalTrades > 0 ? (tokenData.sellCount / tokenData.totalTrades) * 100 : 50}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Creator Info */}
              {tokenData && tokenData.creator && (
                <div>
                  <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Creator
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-bg-secondary border border-border rounded-xl">
                      <div>
                        <p className="text-xs text-text-tertiary">Address</p>
                        <p className="text-sm font-mono text-text-primary">{truncateAddr(tokenData.creator)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-text-tertiary">Tokens Created</p>
                        <p className="text-sm font-mono text-text-primary text-right">{tokenData.creatorTokenCount}</p>
                      </div>
                    </div>
                    {tokenData.creatorTokens.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-text-tertiary">Other tokens by this creator</p>
                        {tokenData.creatorTokens.slice(0, 5).map((ct) => (
                          <div key={ct.address} className="flex items-center justify-between p-2 bg-bg-tertiary rounded-lg text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-text-primary font-medium truncate">{ct.name}</span>
                              <span className="text-text-tertiary font-mono">${ct.symbol}</span>
                            </div>
                            <span className={`font-mono ${ct.marketCapUsd > 0 ? "text-text-secondary" : "text-accent-red"}`}>
                              {ct.marketCapUsd > 0 ? formatCompact(ct.marketCapUsd) : "Dead"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Score Overview */}
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Overall Score</p>
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-bold font-mono">{score}</span>
                    <span className="text-xl text-text-tertiary font-mono mb-1">/100</span>
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-tertiary">Confidence</span>
                    <span className="text-text-secondary font-medium">{confidence}</span>
                  </div>
                  <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${score >= 65 ? "bg-accent-green" : score >= 40 ? "bg-accent-yellow" : "bg-accent-red"}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown */}
              {breakdown && Object.keys(breakdown).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">Score Breakdown</h3>
                  <div className="space-y-3">
                    {Object.entries(breakdown).map(([label, value], i) => {
                      const clamped = Math.min(100, Math.max(0, value));
                      const color = clamped >= 75 ? "bg-accent-green" : clamped >= 50 ? "bg-accent-yellow" : "bg-accent-red";
                      const textColor = clamped >= 75 ? "text-accent-green-light" : clamped >= 50 ? "text-accent-yellow" : "text-accent-red";
                      return (
                        <div key={label}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm text-text-secondary">{label}</span>
                            <span className={`text-sm font-mono font-semibold ${textColor}`}>{clamped}%</span>
                          </div>
                          <div className="h-2.5 bg-bg-tertiary rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${clamped}%` }}
                              transition={{ delay: i * 0.08, duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
                              className={`h-full rounded-full ${color}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Analysis */}
              <div>
                <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">Analysis</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{reasoning}</p>
              </div>

              {/* All Risks */}
              {risks.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                    Risk Factors ({risks.length})
                  </h3>
                  <div className="space-y-2">
                    {risks.map((risk, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.25 }}
                        className="flex items-start gap-2.5 p-3 bg-accent-yellow/5 border border-accent-yellow/10 rounded-lg"
                      >
                        <AlertTriangle className="w-4 h-4 text-accent-yellow shrink-0 mt-0.5" />
                        <span className="text-sm text-text-secondary">{risk}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {risks.length === 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">Risk Factors</h3>
                  <p className="text-sm text-accent-green-light">No significant risks detected.</p>
                </div>
              )}

              {/* Signal Explanation */}
              <div className="p-4 bg-bg-secondary border border-border rounded-xl">
                <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Signal Guide</h3>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className={`p-2 rounded-lg ${signal === "BUY" ? "bg-accent-green/10 border border-accent-green/20" : ""}`}>
                    <span className="text-accent-green-light font-semibold">BUY</span>
                    <span className="text-text-tertiary"> (65+)</span>
                    <p className="text-text-tertiary mt-1">Strong fundamentals across metrics</p>
                  </div>
                  <div className={`p-2 rounded-lg ${signal === "WATCH" ? "bg-accent-yellow/10 border border-accent-yellow/20" : ""}`}>
                    <span className="text-accent-yellow font-semibold">WATCH</span>
                    <span className="text-text-tertiary"> (40-64)</span>
                    <p className="text-text-tertiary mt-1">Mixed signals, monitor closely</p>
                  </div>
                  <div className={`p-2 rounded-lg ${signal === "AVOID" ? "bg-accent-red/10 border border-accent-red/20" : ""}`}>
                    <span className="text-accent-red font-semibold">AVOID</span>
                    <span className="text-text-tertiary"> (&lt;40)</span>
                    <p className="text-text-tertiary mt-1">High risk or insufficient data</p>
                  </div>
                </div>
              </div>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function StatCell({ label, value, highlight }: { label: string; value: string; highlight?: "green" | "red" }) {
  const valueColor = highlight === "green" ? "text-accent-green-light" : highlight === "red" ? "text-accent-red" : "text-text-primary";
  return (
    <div className="p-3 bg-bg-tertiary rounded-xl">
      <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm font-mono font-medium ${valueColor}`}>{value}</p>
    </div>
  );
}

function BreakdownBar({ label, value }: { label: string; value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  const color = clamped >= 75 ? "bg-accent-green" : clamped >= 50 ? "bg-accent-yellow" : "bg-accent-red";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-text-tertiary">{label}</span>
        <span className="text-xs font-mono text-text-secondary">{clamped}%</span>
      </div>
      <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
