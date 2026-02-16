"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, Loader2, CheckCircle2, AlertTriangle, Brain, Shield, ChevronDown,
  Wallet, TrendingUp, TrendingDown, PieChart, RefreshCw, ExternalLink,
  Target, Zap, Info, XCircle, Terminal, ChevronRight, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { useAccount, useConnect } from "wagmi";

interface PortfolioThinking {
  type: "thinking";
  reasoning: string;
  timestamp: number;
}

interface PortfolioToolCall {
  type: "tool_call";
  toolId: string;
  toolName: string;
  status: "running" | "complete";
  finding?: string;
  severity?: "info" | "warning" | "critical";
  details?: string[];
  timestamp: number;
}

interface PortfolioHolding {
  type: "holding";
  tokenAddress: string;
  symbol: string;
  name: string;
  imageUrl: string;
  balance: string;
  valueMon: number;
  valueUsd: number;
  priceUsd: number;
  score: number;
  signal: "STRONG" | "HOLD" | "WEAK" | "EXIT";
  riskFactors: string[];
  timestamp: number;
}

interface PortfolioHealth {
  type: "portfolio_health";
  totalValueMon: number;
  totalValueUsd: number;
  diversificationScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  concentrationRisk: string;
  largestPosition: { symbol: string; percentage: number };
  timestamp: number;
}

interface PortfolioRecommendation {
  type: "recommendation";
  action: "HOLD" | "REDUCE" | "EXIT" | "REBALANCE" | "DIVERSIFY";
  symbol?: string;
  reasoning: string;
  urgency: "low" | "medium" | "high";
  timestamp: number;
}

type PortfolioEvent =
  | PortfolioThinking
  | PortfolioToolCall
  | PortfolioHolding
  | PortfolioHealth
  | PortfolioRecommendation
  | { type: "done"; timestamp: number }
  | { type: "error"; message: string };

type TimelineEntry =
  | { kind: "thinking"; data: PortfolioThinking }
  | { kind: "tool_call"; data: PortfolioToolCall }
  | { kind: "holding"; data: PortfolioHolding }
  | { kind: "recommendation"; data: PortfolioRecommendation };

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  const [state, setState] = useState<"idle" | "scanning" | "complete" | "error">("idle");
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [health, setHealth] = useState<PortfolioHealth | null>(null);
  const [recommendations, setRecommendations] = useState<PortfolioRecommendation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [timeline]);

  const scan = useCallback(async () => {
    if (!address) return;

    setState("scanning");
    setTimeline([]);
    setHoldings([]);
    setHealth(null);
    setRecommendations([]);
    setError(null);

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const res = await fetch("/api/portfolio/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
        signal: controller.signal,
      });

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await res.json();
        setError(json.error || "Scan failed");
        setState("error");
        return;
      }

      if (!res.body) {
        setError("No response");
        setState("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(trimmed.slice(6)) as PortfolioEvent;

            switch (event.type) {
              case "thinking":
                setTimeline((prev) => [...prev, { kind: "thinking", data: event }]);
                break;
              case "tool_call":
                setTimeline((prev) => {
                  const exists = prev.some((e) => e.kind === "tool_call" && e.data.toolId === event.toolId);
                  if (exists) {
                    return prev.map((e) =>
                      e.kind === "tool_call" && e.data.toolId === event.toolId
                        ? { kind: "tool_call" as const, data: event }
                        : e
                    );
                  }
                  return [...prev, { kind: "tool_call", data: event }];
                });
                break;
              case "holding":
                setHoldings((prev) => [...prev, event]);
                setTimeline((prev) => [...prev, { kind: "holding", data: event }]);
                break;
              case "portfolio_health":
                setHealth(event);
                break;
              case "recommendation":
                setRecommendations((prev) => [...prev, event]);
                setTimeline((prev) => [...prev, { kind: "recommendation", data: event }]);
                break;
              case "done":
                setState("complete");
                break;
              case "error":
                setError(event.message);
                setState("error");
                break;
            }
          } catch {
            // skip
          }
        }
      }
      setState((s) => (s === "scanning" ? "complete" : s));
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(String(err));
      setState("error");
    }
  }, [address]);

  const isScanning = state === "scanning";

  // Not connected
  if (!isConnected) {
    return (
      <div className="p-6">
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-bg-secondary border border-border flex items-center justify-center">
            <Wallet className="w-8 h-8 text-text-tertiary" />
          </div>
          <h3 className="text-lg font-medium mb-2">Connect Your Wallet</h3>
          <p className="text-sm text-text-tertiary max-w-md mx-auto mb-6">
            The Portfolio Agent will autonomously scan your Monad holdings, evaluate each position, and provide intelligent recommendations.
          </p>
          <button
            onClick={() => {
              const injected = connectors.find((c) => c.id === "injected") || connectors[0];
              if (injected) connect({ connector: injected });
            }}
            className="px-6 py-3 bg-accent-green hover:bg-accent-green-light text-white font-medium rounded-xl transition-all flex items-center gap-2 mx-auto"
          >
            <Wallet className="w-4 h-4" />
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-accent-green-light" />
            Portfolio Agent
          </h1>
          <p className="text-sm text-text-tertiary">Autonomous AI agent scans and evaluates your Monad holdings</p>
        </div>
        <button
          onClick={scan}
          disabled={isScanning}
          className="px-5 py-2.5 bg-accent-green hover:bg-accent-green-light disabled:opacity-50 text-white font-medium rounded-xl transition-all flex items-center gap-2"
        >
          {isScanning ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Scanning...</>
          ) : (
            <><RefreshCw className="w-4 h-4" /> {state === "idle" ? "Scan Portfolio" : "Rescan"}</>
          )}
        </button>
      </div>

      {/* Portfolio Health Card */}
      {health && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-bg-secondary border border-border rounded-2xl p-6"
        >
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
            <div>
              <p className="text-xs text-text-tertiary mb-1">Total Value</p>
              <p className="text-2xl font-bold font-mono">{health.totalValueMon.toFixed(2)}</p>
              <p className="text-xs text-text-tertiary font-mono">MON</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-1">USD Value</p>
              <p className="text-2xl font-bold font-mono">${health.totalValueUsd.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-1">Diversification</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold font-mono">{health.diversificationScore}</p>
                <span className="text-xs text-text-tertiary">/100</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-1">Risk Level</p>
              <p className={`text-2xl font-bold ${
                health.riskLevel === "LOW" ? "text-accent-green-light" :
                health.riskLevel === "MEDIUM" ? "text-accent-yellow" :
                health.riskLevel === "HIGH" ? "text-orange-400" :
                "text-accent-red"
              }`}>{health.riskLevel}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-1">Largest Position</p>
              <p className="text-lg font-bold font-mono">${health.largestPosition.symbol}</p>
              <p className="text-xs text-text-tertiary">{health.largestPosition.percentage.toFixed(1)}% of portfolio</p>
            </div>
          </div>
          {health.concentrationRisk && (
            <div className="mt-4 p-3 bg-accent-yellow/5 border border-accent-yellow/20 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-accent-yellow shrink-0 mt-0.5" />
              <p className="text-xs text-accent-yellow">{health.concentrationRisk}</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Holdings Grid */}
      {holdings.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">Holdings ({holdings.length})</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {holdings.map((h, i) => (
              <motion.div
                key={h.tokenAddress}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
                className="bg-bg-secondary border border-border rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {h.imageUrl ? (
                      <img src={h.imageUrl} alt={h.symbol} className="w-8 h-8 rounded-lg" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center text-xs font-bold text-text-tertiary">
                        {h.symbol.slice(0, 2)}
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-semibold">${h.symbol}</h3>
                      <p className="text-[10px] text-text-tertiary truncate max-w-[120px]">{h.name}</p>
                    </div>
                  </div>
                  <SignalBadge signal={h.signal} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-text-tertiary">Value</p>
                    <p className="text-sm font-mono font-semibold">{h.valueMon.toFixed(3)} MON</p>
                    <p className="text-[10px] text-text-tertiary font-mono">${h.valueUsd.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-tertiary">Score</p>
                    <p className={`text-sm font-mono font-bold ${
                      h.score >= 70 ? "text-accent-green-light" :
                      h.score >= 50 ? "text-accent-yellow" :
                      h.score >= 30 ? "text-orange-400" :
                      "text-accent-red"
                    }`}>{h.score}/100</p>
                  </div>
                </div>
                {h.riskFactors.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {h.riskFactors.map((r, j) => (
                      <span key={j} className="text-[9px] px-1.5 py-0.5 rounded bg-accent-red/10 text-accent-red border border-accent-red/20">
                        {r}
                      </span>
                    ))}
                  </div>
                )}
                <a
                  href={`/analyze?token=${h.tokenAddress}`}
                  className="text-[10px] text-accent-green-light hover:text-accent-green flex items-center gap-1"
                >
                  Run deep analysis <ArrowUpRight className="w-2.5 h-2.5" />
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">Agent Recommendations</h2>
          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1, duration: 0.3 }}
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  rec.urgency === "high" ? "bg-accent-red/5 border-accent-red/20" :
                  rec.urgency === "medium" ? "bg-accent-yellow/5 border-accent-yellow/20" :
                  "bg-accent-green/5 border-accent-green/20"
                }`}
              >
                <ActionIcon action={rec.action} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold uppercase ${
                      rec.action === "EXIT" ? "text-accent-red" :
                      rec.action === "REDUCE" ? "text-orange-400" :
                      rec.action === "REBALANCE" ? "text-accent-yellow" :
                      "text-accent-green-light"
                    }`}>{rec.action}</span>
                    {rec.symbol && <span className="text-xs text-text-tertiary font-mono">${rec.symbol}</span>}
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                      rec.urgency === "high" ? "bg-accent-red/10 text-accent-red" :
                      rec.urgency === "medium" ? "bg-accent-yellow/10 text-accent-yellow" :
                      "bg-accent-green/10 text-accent-green-light"
                    }`}>{rec.urgency} priority</span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">{rec.reasoning}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Terminal */}
      {state !== "idle" && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-bg-secondary border border-border rounded-2xl overflow-hidden"
        >
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-bg-tertiary/50">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <Terminal className="w-3.5 h-3.5 text-text-tertiary" />
              <span className="text-xs text-text-tertiary font-mono">portfolio agent</span>
            </div>
            {isScanning && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
                <span className="text-[10px] text-accent-green-light font-mono">scanning</span>
              </div>
            )}
            {state === "complete" && (
              <span className="text-[10px] text-accent-green-light font-mono">scan complete</span>
            )}
          </div>

          <div ref={terminalRef} className="p-5 space-y-3 max-h-[400px] overflow-y-auto font-mono text-sm">
            <AnimatePresence mode="popLayout">
              {timeline.map((entry, i) => (
                <PortfolioTimelineRow key={`${entry.kind}-${i}`} entry={entry} />
              ))}
            </AnimatePresence>
            {error && (
              <div className="flex items-start gap-2 p-3 bg-accent-red/10 border border-accent-red/20 rounded-lg">
                <XCircle className="w-4 h-4 text-accent-red shrink-0 mt-0.5" />
                <span className="text-sm text-accent-red">{error}</span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {state === "idle" && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-bg-secondary border border-border flex items-center justify-center">
            <PieChart className="w-8 h-8 text-text-tertiary" />
          </div>
          <h3 className="text-lg font-medium mb-2">Scan Your Portfolio</h3>
          <p className="text-sm text-text-tertiary max-w-md mx-auto mb-6">
            The Portfolio Agent will autonomously discover your token holdings on Monad,
            evaluate each position, assess concentration risk, and generate personalized recommendations.
          </p>
          <button
            onClick={scan}
            className="px-6 py-3 bg-accent-green hover:bg-accent-green-light text-white font-medium rounded-xl transition-all flex items-center gap-2 mx-auto"
          >
            <Zap className="w-4 h-4" />
            Start Portfolio Scan
          </button>
        </motion.div>
      )}
    </div>
  );
}

function PortfolioTimelineRow({ entry }: { entry: TimelineEntry }) {
  switch (entry.kind) {
    case "thinking":
      return (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative pl-4 py-3 rounded-lg bg-accent-green/5 border-l-2 border-accent-green/40"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className="relative">
              <Brain className="w-3.5 h-3.5 text-accent-green-light" />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent-green animate-pulse" />
            </div>
            <span className="text-[10px] text-accent-green-light font-semibold uppercase tracking-wider">Agent Thinking</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed italic">{entry.data.reasoning}</p>
        </motion.div>
      );
    case "tool_call":
      return (
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2.5"
        >
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-blue-500/15 text-blue-400 border-blue-500/25 shrink-0">
            TOOL
          </span>
          <div className="shrink-0">
            {entry.data.status === "running" && <Loader2 className="w-3.5 h-3.5 text-accent-green-light animate-spin" />}
            {entry.data.status === "complete" && <CheckCircle2 className="w-3.5 h-3.5 text-accent-green-light" />}
          </div>
          <span className="text-xs text-text-secondary font-mono">{entry.data.toolName}</span>
          {entry.data.finding && entry.data.status === "complete" && (
            <span className={`text-xs truncate flex-1 ${
              entry.data.severity === "critical" ? "text-accent-red" :
              entry.data.severity === "warning" ? "text-accent-yellow" :
              "text-text-tertiary"
            }`}>{entry.data.finding}</span>
          )}
        </motion.div>
      );
    case "holding":
      return (
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2.5"
        >
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-purple-500/15 text-purple-400 border-purple-500/25 shrink-0">
            POS
          </span>
          <CheckCircle2 className="w-3.5 h-3.5 text-accent-green-light shrink-0" />
          <span className="text-xs text-text-secondary font-mono">${entry.data.symbol}</span>
          <span className="text-xs text-text-tertiary">{entry.data.valueMon.toFixed(3)} MON</span>
          <SignalBadge signal={entry.data.signal} small />
        </motion.div>
      );
    case "recommendation":
      return (
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2.5"
        >
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
            entry.data.urgency === "high" ? "bg-red-500/15 text-red-400 border-red-500/25" :
            entry.data.urgency === "medium" ? "bg-amber-500/15 text-amber-400 border-amber-500/25" :
            "bg-green-500/15 text-green-400 border-green-500/25"
          }`}>
            REC
          </span>
          <Target className="w-3.5 h-3.5 text-accent-green-light shrink-0" />
          <span className="text-xs text-text-secondary">{entry.data.action}</span>
          {entry.data.symbol && <span className="text-xs text-text-tertiary font-mono">${entry.data.symbol}</span>}
        </motion.div>
      );
  }
}

function SignalBadge({ signal, small = false }: { signal: string; small?: boolean }) {
  const colors: Record<string, string> = {
    STRONG: "bg-accent-green/10 text-accent-green-light border-accent-green/20",
    HOLD: "bg-accent-yellow/10 text-accent-yellow border-accent-yellow/20",
    WEAK: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    EXIT: "bg-accent-red/10 text-accent-red border-accent-red/20",
  };
  return (
    <span className={`${small ? "text-[8px] px-1 py-0" : "text-[10px] px-2 py-0.5"} font-bold rounded border ${colors[signal] || colors.HOLD}`}>
      {signal}
    </span>
  );
}

function ActionIcon({ action }: { action: string }) {
  switch (action) {
    case "EXIT": return <ArrowDownRight className="w-5 h-5 text-accent-red shrink-0" />;
    case "REDUCE": return <TrendingDown className="w-5 h-5 text-orange-400 shrink-0" />;
    case "REBALANCE": return <PieChart className="w-5 h-5 text-accent-yellow shrink-0" />;
    case "DIVERSIFY": return <Target className="w-5 h-5 text-blue-400 shrink-0" />;
    default: return <TrendingUp className="w-5 h-5 text-accent-green-light shrink-0" />;
  }
}
