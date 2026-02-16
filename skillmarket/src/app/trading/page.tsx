"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Loader2, CheckCircle2, AlertTriangle, Brain, Shield, ChevronDown,
  Wallet, Plus, Play, Pause, Trash2, Bell, BellRing, Terminal, XCircle,
  TrendingUp, TrendingDown, Activity, Clock, Target, Zap, ChevronRight,
  Settings2, ArrowDownRight, ArrowUpRight, X,
} from "lucide-react";
import { useAccount, useConnect } from "wagmi";

interface TradingStrategy {
  id: string;
  name: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  createdBy: string;
  createdAt: number;
  active: boolean;
  conditions: {
    checkInterval: string;
    scoreThreshold: number;
    riskThreshold: number;
    priceDropPercent: number;
    volumeSpikeFactor: number;
    holderDropPercent: number;
  };
  actions: {
    alertOnTrigger: boolean;
    autoAnalyze: boolean;
    recommendSell: boolean;
    recommendBuy: boolean;
  };
  lastChecked: number | null;
  timesTriggered: number;
  lastTriggeredAt: number | null;
}

interface StrategyAlert {
  id: string;
  strategyId: string;
  strategyName: string;
  tokenAddress: string;
  tokenSymbol: string;
  triggeredConditions: string[];
  agentReasoning: string;
  recommendation: "BUY" | "HOLD" | "SELL" | "URGENT_SELL";
  score: number;
  riskScore: number;
  timestamp: number;
  dismissed: boolean;
}

// SSE events for evaluation
interface EvalThinking { type: "thinking"; reasoning: string; timestamp: number }
interface EvalToolCall { type: "tool_call"; toolId: string; toolName: string; status: "running" | "complete"; finding?: string; severity?: "info" | "warning" | "critical"; details?: string[]; timestamp: number }
interface EvalConditionCheck { type: "condition_check"; condition: string; triggered: boolean; currentValue: string; threshold: string; timestamp: number }
interface EvalSignal { type: "signal"; recommendation: "BUY" | "HOLD" | "SELL" | "URGENT_SELL"; score: number; riskScore: number; reasoning: string; triggeredConditions: string[]; timestamp: number }

type EvalEvent = EvalThinking | EvalToolCall | EvalConditionCheck | EvalSignal | { type: "alert_created"; alertId: string; timestamp: number } | { type: "done"; timestamp: number } | { type: "error"; message: string };

type EvalTimeline =
  | { kind: "thinking"; data: EvalThinking }
  | { kind: "tool_call"; data: EvalToolCall }
  | { kind: "condition"; data: EvalConditionCheck }
  | { kind: "signal"; data: EvalSignal };

export default function TradingPage() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  const [strategies, setStrategies] = useState<TradingStrategy[]>([]);
  const [alerts, setAlerts] = useState<StrategyAlert[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  // Evaluation state
  const [evalStrategyId, setEvalStrategyId] = useState<string | null>(null);
  const [evalState, setEvalState] = useState<"idle" | "running" | "complete" | "error">("idle");
  const [evalTimeline, setEvalTimeline] = useState<EvalTimeline[]>([]);
  const [evalSignal, setEvalSignal] = useState<EvalSignal | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [evalTimeline]);

  // Load strategies
  const loadStrategies = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/trading/strategies?wallet=${address}`);
      const data = await res.json();
      setStrategies(data.strategies || []);
      setAlerts(data.alerts || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (address) loadStrategies();
  }, [address, loadStrategies]);

  // Run evaluation
  const evaluate = useCallback(async (strategyId: string) => {
    setEvalStrategyId(strategyId);
    setEvalState("running");
    setEvalTimeline([]);
    setEvalSignal(null);
    setEvalError(null);

    try {
      const res = await fetch("/api/trading/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategyId }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await res.json();
        setEvalError(json.error || "Evaluation failed");
        setEvalState("error");
        return;
      }

      if (!res.body) { setEvalError("No response"); setEvalState("error"); return; }

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
            const event = JSON.parse(trimmed.slice(6)) as EvalEvent;
            switch (event.type) {
              case "thinking":
                setEvalTimeline((p) => [...p, { kind: "thinking", data: event }]);
                break;
              case "tool_call":
                setEvalTimeline((p) => {
                  const exists = p.some((e) => e.kind === "tool_call" && e.data.toolId === event.toolId);
                  if (exists) return p.map((e) => e.kind === "tool_call" && e.data.toolId === event.toolId ? { kind: "tool_call" as const, data: event } : e);
                  return [...p, { kind: "tool_call", data: event }];
                });
                break;
              case "condition_check":
                setEvalTimeline((p) => [...p, { kind: "condition", data: event }]);
                break;
              case "signal":
                setEvalSignal(event);
                setEvalTimeline((p) => [...p, { kind: "signal", data: event }]);
                break;
              case "alert_created":
                loadStrategies(); // refresh alerts
                break;
              case "done":
                setEvalState("complete");
                loadStrategies();
                break;
              case "error":
                setEvalError(event.message);
                setEvalState("error");
                break;
            }
          } catch { /* skip */ }
        }
      }
      setEvalState((s) => (s === "running" ? "complete" : s));
    } catch (err) {
      setEvalError(String(err));
      setEvalState("error");
    }
  }, [loadStrategies]);

  // Delete strategy
  const deleteStrategy = async (id: string) => {
    await fetch("/api/trading/strategies", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadStrategies();
  };

  if (!isConnected) {
    return (
      <div className="p-6">
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-bg-secondary border border-border flex items-center justify-center">
            <Bot className="w-8 h-8 text-text-tertiary" />
          </div>
          <h3 className="text-lg font-medium mb-2">Connect Your Wallet</h3>
          <p className="text-sm text-text-tertiary max-w-md mx-auto mb-6">
            The Trading Agent autonomously monitors your tokens, evaluates market conditions,
            and generates trading signals based on your custom strategies.
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

  const activeAlerts = alerts.filter((a) => !a.dismissed);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Bot className="w-5 h-5 text-accent-green-light" />
            Trading Agent
          </h1>
          <p className="text-sm text-text-tertiary">Autonomous monitoring, analysis, and trading signals</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2.5 bg-accent-green hover:bg-accent-green-light text-white font-medium rounded-xl transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Strategy
        </button>
      </div>

      {/* Active Alerts Banner */}
      {activeAlerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-accent-red/5 border border-accent-red/20 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <BellRing className="w-4 h-4 text-accent-red" />
            <span className="text-sm font-semibold text-accent-red">{activeAlerts.length} Active Alert{activeAlerts.length > 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-2">
            {activeAlerts.slice(0, 3).map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 p-3 bg-bg-secondary rounded-lg border border-border">
                <RecommendationIcon rec={alert.recommendation} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-text-primary">${alert.tokenSymbol}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      alert.recommendation === "URGENT_SELL" ? "bg-accent-red/10 text-accent-red" :
                      alert.recommendation === "SELL" ? "bg-orange-500/10 text-orange-400" :
                      alert.recommendation === "BUY" ? "bg-accent-green/10 text-accent-green-light" :
                      "bg-accent-yellow/10 text-accent-yellow"
                    }`}>{alert.recommendation}</span>
                    <span className="text-[10px] text-text-tertiary">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-xs text-text-secondary truncate">{alert.agentReasoning}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {alert.triggeredConditions.map((c, i) => (
                      <span key={i} className="text-[8px] px-1 py-0 rounded bg-accent-red/10 text-accent-red">{c}</span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono">Score: {alert.score}</p>
                  <p className="text-[10px] text-text-tertiary font-mono">Risk: {alert.riskScore}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Strategies Grid */}
      <div>
        <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">
          Strategies ({strategies.length})
        </h2>
        {loading ? (
          <div className="flex items-center gap-2 text-text-tertiary py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading strategies...</span>
          </div>
        ) : strategies.length === 0 ? (
          <div className="text-center py-12 bg-bg-secondary border border-border rounded-2xl">
            <Activity className="w-8 h-8 text-text-tertiary mx-auto mb-3" />
            <p className="text-sm text-text-tertiary mb-4">No strategies yet. Create one to start autonomous monitoring.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-accent-green/10 text-accent-green-light border border-accent-green/20 rounded-lg text-sm hover:bg-accent-green/20 transition-all"
            >
              Create First Strategy
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {strategies.map((strat, i) => (
              <motion.div
                key={strat.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
                className={`bg-bg-secondary border rounded-xl p-5 space-y-4 ${
                  strat.active ? "border-accent-green/20" : "border-border opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${strat.active ? "bg-accent-green animate-pulse" : "bg-text-tertiary"}`} />
                    <div>
                      <h3 className="text-sm font-semibold">{strat.name}</h3>
                      <p className="text-[10px] text-text-tertiary font-mono">${strat.tokenSymbol} &middot; {strat.tokenName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => evaluate(strat.id)}
                      disabled={evalState === "running" && evalStrategyId === strat.id}
                      className="p-2 hover:bg-bg-tertiary rounded-lg transition-all text-accent-green-light"
                      title="Run evaluation now"
                    >
                      {evalState === "running" && evalStrategyId === strat.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteStrategy(strat.id)}
                      className="p-2 hover:bg-bg-tertiary rounded-lg transition-all text-text-tertiary hover:text-accent-red"
                      title="Delete strategy"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-2 bg-bg-tertiary rounded-lg">
                    <p className="text-[9px] text-text-tertiary uppercase">Interval</p>
                    <p className="text-xs font-mono font-semibold">{strat.conditions.checkInterval}</p>
                  </div>
                  <div className="p-2 bg-bg-tertiary rounded-lg">
                    <p className="text-[9px] text-text-tertiary uppercase">Score &lt;</p>
                    <p className="text-xs font-mono font-semibold">{strat.conditions.scoreThreshold}</p>
                  </div>
                  <div className="p-2 bg-bg-tertiary rounded-lg">
                    <p className="text-[9px] text-text-tertiary uppercase">Risk &gt;</p>
                    <p className="text-xs font-mono font-semibold">{strat.conditions.riskThreshold}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-text-tertiary">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {strat.lastChecked ? new Date(strat.lastChecked).toLocaleString() : "Never checked"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Bell className="w-3 h-3" />
                      {strat.timesTriggered} triggered
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {strat.actions.alertOnTrigger && <Bell className="w-3 h-3 text-accent-green-light" />}
                    {strat.actions.autoAnalyze && <Brain className="w-3 h-3 text-blue-400" />}
                    {strat.actions.recommendSell && <ArrowDownRight className="w-3 h-3 text-accent-red" />}
                    {strat.actions.recommendBuy && <ArrowUpRight className="w-3 h-3 text-accent-green-light" />}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Agent Evaluation Terminal */}
      {evalState !== "idle" && (
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
              <span className="text-xs text-text-tertiary font-mono">trading agent</span>
              {evalStrategyId && (
                <span className="text-[10px] text-text-tertiary font-mono">
                  evaluating {strategies.find((s) => s.id === evalStrategyId)?.tokenSymbol || "..."}
                </span>
              )}
            </div>
            {evalState === "running" && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
                <span className="text-[10px] text-accent-green-light font-mono">evaluating</span>
              </div>
            )}
            {evalState === "complete" && <span className="text-[10px] text-accent-green-light font-mono">done</span>}
          </div>

          <div ref={terminalRef} className="p-5 space-y-3 max-h-[500px] overflow-y-auto font-mono text-sm">
            <AnimatePresence mode="popLayout">
              {evalTimeline.map((entry, i) => (
                <EvalTimelineRow key={`${entry.kind}-${i}`} entry={entry} />
              ))}
            </AnimatePresence>
            {evalError && (
              <div className="flex items-start gap-2 p-3 bg-accent-red/10 border border-accent-red/20 rounded-lg">
                <XCircle className="w-4 h-4 text-accent-red shrink-0 mt-0.5" />
                <span className="text-sm text-accent-red">{evalError}</span>
              </div>
            )}
          </div>

          {/* Signal Result */}
          {evalSignal && (
            <div className="border-t border-border bg-bg-tertiary/30 px-5 py-4">
              <div className="flex items-center gap-4">
                <RecommendationIcon rec={evalSignal.recommendation} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-bold ${
                      evalSignal.recommendation === "URGENT_SELL" ? "text-accent-red" :
                      evalSignal.recommendation === "SELL" ? "text-orange-400" :
                      evalSignal.recommendation === "BUY" ? "text-accent-green-light" :
                      "text-accent-yellow"
                    }`}>{evalSignal.recommendation}</span>
                    <span className="text-xs text-text-tertiary">Score: {evalSignal.score}/100</span>
                    <span className="text-xs text-text-tertiary">Risk: {evalSignal.riskScore}/100</span>
                  </div>
                  <p className="text-xs text-text-secondary">{evalSignal.reasoning}</p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Create Strategy Modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateStrategyModal
            address={address!}
            onClose={() => setShowCreate(false)}
            onCreated={() => { loadStrategies(); setShowCreate(false); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// === Evaluation Timeline ===

function EvalTimelineRow({ entry }: { entry: EvalTimeline }) {
  switch (entry.kind) {
    case "thinking":
      return (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="relative pl-4 py-3 rounded-lg bg-accent-green/5 border-l-2 border-accent-green/40">
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
        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2.5">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-blue-500/15 text-blue-400 border-blue-500/25 shrink-0">TOOL</span>
          {entry.data.status === "running"
            ? <Loader2 className="w-3.5 h-3.5 text-accent-green-light animate-spin shrink-0" />
            : <CheckCircle2 className="w-3.5 h-3.5 text-accent-green-light shrink-0" />}
          <span className="text-xs text-text-secondary font-mono">{entry.data.toolName}</span>
          {entry.data.finding && entry.data.status === "complete" && (
            <span className={`text-xs truncate flex-1 ${
              entry.data.severity === "critical" ? "text-accent-red" : entry.data.severity === "warning" ? "text-accent-yellow" : "text-text-tertiary"
            }`}>{entry.data.finding}</span>
          )}
        </motion.div>
      );
    case "condition":
      return (
        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2.5">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
            entry.data.triggered ? "bg-red-500/15 text-red-400 border-red-500/25" : "bg-green-500/15 text-green-400 border-green-500/25"
          }`}>{entry.data.triggered ? "TRIG" : "OK"}</span>
          {entry.data.triggered
            ? <AlertTriangle className="w-3.5 h-3.5 text-accent-red shrink-0" />
            : <CheckCircle2 className="w-3.5 h-3.5 text-accent-green-light shrink-0" />}
          <span className="text-xs text-text-secondary">{entry.data.condition}</span>
          <span className="text-[10px] text-text-tertiary font-mono">{entry.data.currentValue} vs {entry.data.threshold}</span>
        </motion.div>
      );
    case "signal":
      return (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className={`p-3 rounded-lg border ${
            entry.data.recommendation === "URGENT_SELL" || entry.data.recommendation === "SELL"
              ? "bg-accent-red/5 border-accent-red/20"
              : entry.data.recommendation === "BUY"
                ? "bg-accent-green/5 border-accent-green/20"
                : "bg-accent-yellow/5 border-accent-yellow/20"
          }`}>
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-3.5 h-3.5" />
            <span className="text-xs font-bold">{entry.data.recommendation}</span>
            <span className="text-[10px] text-text-tertiary font-mono">Score: {entry.data.score} | Risk: {entry.data.riskScore}</span>
          </div>
          <p className="text-xs text-text-secondary">{entry.data.reasoning}</p>
        </motion.div>
      );
  }
}

function RecommendationIcon({ rec }: { rec: string }) {
  switch (rec) {
    case "URGENT_SELL": return <div className="w-8 h-8 rounded-lg bg-accent-red/20 flex items-center justify-center"><ArrowDownRight className="w-4 h-4 text-accent-red" /></div>;
    case "SELL": return <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center"><TrendingDown className="w-4 h-4 text-orange-400" /></div>;
    case "BUY": return <div className="w-8 h-8 rounded-lg bg-accent-green/20 flex items-center justify-center"><TrendingUp className="w-4 h-4 text-accent-green-light" /></div>;
    default: return <div className="w-8 h-8 rounded-lg bg-accent-yellow/20 flex items-center justify-center"><Activity className="w-4 h-4 text-accent-yellow" /></div>;
  }
}

// === Create Strategy Modal ===

function CreateStrategyModal({ address, onClose, onCreated }: { address: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [checkInterval, setCheckInterval] = useState<string>("1h");
  const [scoreThreshold, setScoreThreshold] = useState("40");
  const [riskThreshold, setRiskThreshold] = useState("70");
  const [priceDropPercent, setPriceDropPercent] = useState("15");
  const [volumeSpikeFactor, setVolumeSpikeFactor] = useState("3");
  const [holderDropPercent, setHolderDropPercent] = useState("10");
  const [alertOnTrigger, setAlertOnTrigger] = useState(true);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [recommendSell, setRecommendSell] = useState(true);
  const [recommendBuy, setRecommendBuy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fetch token info
  const fetchTokenInfo = async () => {
    if (!tokenAddress || tokenAddress.length < 10) return;
    try {
      const res = await fetch(`/api/tokens/${tokenAddress}`);
      if (res.ok) {
        const data = await res.json();
        if (data.symbol) setTokenSymbol(data.symbol);
        if (data.name) setTokenName(data.name);
        if (!name) setName(`Monitor ${data.symbol}`);
      }
    } catch { /* ignore */ }
  };

  const submit = async () => {
    if (!name || !tokenAddress) { setError("Name and token address required"); return; }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/trading/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          tokenAddress,
          tokenSymbol: tokenSymbol || "???",
          tokenName: tokenName || "Unknown",
          createdBy: address,
          conditions: {
            checkInterval,
            scoreThreshold: Number(scoreThreshold),
            riskThreshold: Number(riskThreshold),
            priceDropPercent: Number(priceDropPercent),
            volumeSpikeFactor: Number(volumeSpikeFactor),
            holderDropPercent: Number(holderDropPercent),
          },
          actions: { alertOnTrigger, autoAnalyze, recommendSell, recommendBuy },
        }),
      });
      if (res.ok) {
        onCreated();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-bg-secondary border border-border rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bot className="w-5 h-5 text-accent-green-light" />
            New Trading Strategy
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded-lg"><X className="w-5 h-5 text-text-tertiary" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Basic */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-text-tertiary uppercase tracking-wider mb-1 block">Strategy Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monitor $PEPE"
                className="w-full px-3 py-2.5 bg-bg-tertiary border border-border rounded-xl text-sm focus:outline-none focus:border-accent-green/40" />
            </div>
            <div>
              <label className="text-xs text-text-tertiary uppercase tracking-wider mb-1 block">Token Address</label>
              <input value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} onBlur={fetchTokenInfo} placeholder="0x..."
                className="w-full px-3 py-2.5 bg-bg-tertiary border border-border rounded-xl text-sm font-mono focus:outline-none focus:border-accent-green/40" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-tertiary uppercase tracking-wider mb-1 block">Symbol</label>
                <input value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value)} placeholder="PEPE"
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border rounded-xl text-sm font-mono focus:outline-none focus:border-accent-green/40" />
              </div>
              <div>
                <label className="text-xs text-text-tertiary uppercase tracking-wider mb-1 block">Token Name</label>
                <input value={tokenName} onChange={(e) => setTokenName(e.target.value)} placeholder="Pepe Token"
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border rounded-xl text-sm focus:outline-none focus:border-accent-green/40" />
              </div>
            </div>
          </div>

          {/* Conditions */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Settings2 className="w-4 h-4 text-text-tertiary" />
              Alert Conditions
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-text-tertiary mb-1 block">Check Interval</label>
                <select value={checkInterval} onChange={(e) => setCheckInterval(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm focus:outline-none">
                  <option value="30m">Every 30 min</option>
                  <option value="1h">Every 1 hour</option>
                  <option value="4h">Every 4 hours</option>
                  <option value="12h">Every 12 hours</option>
                  <option value="24h">Every 24 hours</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-text-tertiary mb-1 block">Alert if Score below</label>
                <input type="number" value={scoreThreshold} onChange={(e) => setScoreThreshold(e.target.value)} min="0" max="100"
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm font-mono focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] text-text-tertiary mb-1 block">Alert if Risk above</label>
                <input type="number" value={riskThreshold} onChange={(e) => setRiskThreshold(e.target.value)} min="0" max="100"
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm font-mono focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] text-text-tertiary mb-1 block">Price Drop % Alert</label>
                <input type="number" value={priceDropPercent} onChange={(e) => setPriceDropPercent(e.target.value)} min="1" max="100"
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm font-mono focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] text-text-tertiary mb-1 block">Volume Spike Factor</label>
                <input type="number" value={volumeSpikeFactor} onChange={(e) => setVolumeSpikeFactor(e.target.value)} min="1" max="100"
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm font-mono focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] text-text-tertiary mb-1 block">Holder Drop % Alert</label>
                <input type="number" value={holderDropPercent} onChange={(e) => setHolderDropPercent(e.target.value)} min="1" max="100"
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm font-mono focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-text-tertiary" />
              Agent Actions
            </h3>
            <div className="space-y-2">
              {[
                { label: "Alert when conditions trigger", checked: alertOnTrigger, set: setAlertOnTrigger, icon: Bell },
                { label: "Auto-run full analysis", checked: autoAnalyze, set: setAutoAnalyze, icon: Brain },
                { label: "Include sell recommendations", checked: recommendSell, set: setRecommendSell, icon: ArrowDownRight },
                { label: "Include buy recommendations", checked: recommendBuy, set: setRecommendBuy, icon: ArrowUpRight },
              ].map((item) => (
                <label key={item.label} className="flex items-center gap-3 p-2 hover:bg-bg-tertiary rounded-lg cursor-pointer transition-all">
                  <input type="checkbox" checked={item.checked} onChange={(e) => item.set(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-bg-tertiary accent-accent-green" />
                  <item.icon className="w-3.5 h-3.5 text-text-tertiary" />
                  <span className="text-xs text-text-secondary">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-accent-red">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 py-3 bg-bg-tertiary hover:bg-border text-text-primary border border-border rounded-xl transition-all">
              Cancel
            </button>
            <button onClick={submit} disabled={creating}
              className="flex-1 py-3 bg-accent-green hover:bg-accent-green-light disabled:opacity-60 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2">
              {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><Bot className="w-4 h-4" /> Create Strategy</>}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
