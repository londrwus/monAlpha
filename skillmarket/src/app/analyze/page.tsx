"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Loader2, CheckCircle2, Zap, Check, Sparkles, AlertTriangle,
  XCircle, Terminal, ChevronRight, Brain, Info, Shield, ChevronDown, Coins, Wallet,
} from "lucide-react";
import { useAccount, useConnect } from "wagmi";
import AnalysisCard from "@/components/AnalysisCard";
import { useAgentAnalysis } from "@/hooks/useAgentAnalysis";
import { useSkillRegistry } from "@/hooks/useSkillRegistry";
import type { TimelineEntry } from "@/hooks/useAgentAnalysis";
import type {
  AgentStepEvent,
  AgentToolCallEvent,
  AgentThinkingEvent,
  AgentConfidenceEvent,
  AgentResultEvent,
  AgentInvestigationEvent,
} from "@/lib/analysis/agent-types";

interface AvailableModel {
  id: string;
  name: string;
  description: string;
  accuracy: number;
  usageCount: number;
  modelType?: string;
  price?: number;
}

export default function AnalyzePage() {
  const [tokenAddress, setTokenAddress] = useState("");
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  const agent = useAgentAnalysis();
  const { isConnected, address } = useAccount();
  const { connect, connectors } = useConnect();
  const { payForAnalysis, paymentState, resetPayment, isWrongNetwork, ensureMonadChain } = useSkillRegistry();

  // Total cost of selected models
  const totalCost = selectedModels.reduce((sum, id) => {
    const m = models.find((model) => model.id === id);
    return sum + (m?.price || 0);
  }, 0);

  // Fetch real models on mount
  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((data) => {
        const skills: AvailableModel[] = (data.skills || []).map(
          (s: { id: string; name: string; description: string; accuracy: number; usageCount: number; modelType?: string; price?: number }) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            accuracy: s.accuracy,
            usageCount: s.usageCount,
            modelType: s.modelType,
            price: s.price || 0,
          })
        );
        setModels(skills);
        setSelectedModels(skills.map((s) => s.id));
      })
      .catch(() => {
        const fallback = [
          { id: "rug-detector", name: "Rug Detector", description: "Detects potential scams by analyzing creator reputation, trading patterns, liquidity depth, and lock status.", accuracy: 0, usageCount: 0, price: 5 },
          { id: "whale-tracker", name: "Whale Tracker", description: "Tracks whale wallet activity, holder concentration, and trading pressure patterns.", accuracy: 0, usageCount: 0, price: 5 },
          { id: "liquidity-scout", name: "Liquidity Scout", description: "Evaluates liquidity depth, price impact, and bonding curve health.", accuracy: 0, usageCount: 0, price: 5 },
        ];
        setModels(fallback);
        setSelectedModels(fallback.map((m) => m.id));
      });
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [agent.timeline]);

  const toggleModel = (id: string) => {
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const [payError, setPayError] = useState<string | null>(null);

  const runAnalysis = async () => {
    if (!tokenAddress || selectedModels.length === 0) return;
    setPayError(null);

    if (!isConnected) {
      const injected = connectors.find((c) => c.id === "injected") || connectors[0];
      if (injected) connect({ connector: injected });
      return;
    }

    if (isWrongNetwork) {
      const switched = await ensureMonadChain();
      if (!switched) {
        setPayError("Please switch to Monad network");
        return;
      }
    }

    resetPayment();

    // Charge for analysis
    let payTxHash: string | null = null;
    if (totalCost > 0) {
      payTxHash = await payForAnalysis(totalCost);
      if (!payTxHash) {
        // User rejected or payment failed
        return;
      }
    }

    // Payment successful — run analysis with payment info for payout ledger
    const paymentInfo = payTxHash && address
      ? { txHash: payTxHash, userWallet: address }
      : undefined;
    agent.run(tokenAddress, selectedModels, paymentInfo);
  };

  const isRunning = agent.state === "running";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Analyze Token</h1>
        <p className="text-sm text-text-tertiary">Autonomous AI agent investigates any nad.fun token with tiered investigation</p>
      </div>

      {/* Input Section */}
      <div className="bg-bg-secondary border border-border rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <label className="text-xs text-text-tertiary uppercase tracking-wider mb-2 block">Token Address</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runAnalysis()}
                placeholder="0x1234...5678 or paste nad.fun URL"
                className="w-full pl-10 pr-4 py-3 bg-bg-tertiary border border-border rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-green/40 focus:ring-1 focus:ring-accent-green/20 transition-all font-mono"
              />
            </div>
          </div>
          <div className="lg:w-auto flex flex-col items-end gap-1">
            <button
              onClick={runAnalysis}
              disabled={!tokenAddress || selectedModels.length === 0 || isRunning || paymentState.status === "pending" || paymentState.status === "confirming"}
              className="w-full lg:w-auto px-6 py-3 bg-accent-green hover:bg-accent-green-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 glow-green-subtle"
            >
              {paymentState.status === "pending" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Confirm in Wallet...
                </>
              ) : paymentState.status === "confirming" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Confirming payment...
                </>
              ) : isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Agent Running...
                </>
              ) : !isConnected ? (
                <>
                  <Wallet className="w-4 h-4" />
                  Connect Wallet
                </>
              ) : isWrongNetwork ? (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Switch to Monad
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Run Analysis{totalCost > 0 ? ` (${totalCost} MON)` : ""}
                </>
              )}
            </button>
            {(payError || paymentState.error) && (
              <p className="text-xs text-accent-red">{payError || paymentState.error}</p>
            )}
          </div>
        </div>

        {/* Model Selection — Card Grid */}
        <div className="mt-5">
          <label className="text-xs text-text-tertiary uppercase tracking-wider mb-3 block">Select Models</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {models.map((model, i) => {
              const selected = selectedModels.includes(model.id);
              return (
                <motion.button
                  key={model.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => toggleModel(model.id)}
                  className={`relative text-left p-4 rounded-xl border transition-all ${
                    selected
                      ? "bg-accent-green/5 border-accent-green/30 ring-1 ring-accent-green/20"
                      : "bg-bg-tertiary border-border hover:border-border-light"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-medium text-text-primary">{model.name}</h4>
                      {model.modelType === "DEEP_RESEARCH" && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <Sparkles className="w-2.5 h-2.5" />
                          AI
                        </span>
                      )}
                    </div>
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                      selected
                        ? "bg-accent-green border-accent-green"
                        : "border-border"
                    }`}>
                      {selected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <p className="text-xs text-text-tertiary line-clamp-2 mb-2">{model.description}</p>
                  <div className="flex items-center justify-between text-[10px] text-text-tertiary">
                    <div className="flex items-center gap-3">
                      {model.accuracy > 0 && (
                        <span className="text-accent-green-light font-medium">{model.accuracy.toFixed(1)}% accuracy</span>
                      )}
                      {model.usageCount > 0 && (
                        <span>{model.usageCount} uses</span>
                      )}
                    </div>
                    {(model.price ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5 text-accent-yellow font-medium">
                        <Coins className="w-2.5 h-2.5" />
                        {model.price} MON
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
            {models.length === 0 && (
              <span className="text-xs text-text-tertiary col-span-full">Loading models...</span>
            )}
          </div>
        </div>
      </div>

      {/* Agent Terminal */}
      {agent.state !== "idle" && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="bg-bg-secondary border border-border rounded-2xl overflow-hidden"
        >
          {/* Terminal Header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-bg-tertiary/50">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <Terminal className="w-3.5 h-3.5 text-text-tertiary" />
              <span className="text-xs text-text-tertiary font-mono">monAlpha agent</span>
              {agent.toolCalls.length > 0 && (
                <span className="text-[10px] text-text-tertiary font-mono ml-2">
                  [{agent.toolCalls.filter((t) => t.status === "complete").length}/{agent.toolCalls.length} tools]
                </span>
              )}
            </div>
            {isRunning && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
                <span className="text-[10px] text-accent-green-light font-mono">investigating</span>
              </div>
            )}
            {agent.state === "complete" && (
              <span className="text-[10px] text-accent-green-light font-mono">investigation complete</span>
            )}
            {agent.state === "error" && (
              <span className="text-[10px] text-accent-red font-mono">error</span>
            )}
          </div>

          {/* Terminal Body — Unified Timeline */}
          <div ref={terminalRef} className="p-5 space-y-3 max-h-[600px] overflow-y-auto font-mono text-sm">
            <AnimatePresence mode="popLayout">
              {agent.timeline.map((entry, i) => (
                <TimelineRow key={`${entry.kind}-${i}`} entry={entry} />
              ))}
            </AnimatePresence>

            {/* Error */}
            {agent.error && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 p-3 bg-accent-red/10 border border-accent-red/20 rounded-lg"
              >
                <XCircle className="w-4 h-4 text-accent-red shrink-0 mt-0.5" />
                <span className="text-sm text-accent-red">{agent.error}</span>
              </motion.div>
            )}
          </div>

          {/* Sticky Confidence Meter */}
          {agent.confidence && (
            <div className="border-t border-border bg-bg-tertiary/30 px-5 py-3">
              <ConfidenceMeter confidence={agent.confidence} />
            </div>
          )}
        </motion.div>
      )}

      {/* Results stream in one-by-one */}
      {agent.results.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider">Model Scores</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {agent.results.map((result, i) => (
              <motion.div
                key={result.modelId}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.35, ease: [0.25, 0.4, 0.25, 1] }}
              >
                <AnalysisCard
                  signal={result.signal}
                  score={result.score}
                  model={result.modelName}
                  reasoning={result.reasoning}
                  risks={result.risks}
                  confidence={result.confidence}
                  breakdown={result.breakdown}
                  tokenData={agent.tokenData ?? undefined}
                  isAIPowered={result.isAIPowered}
                />
              </motion.div>
            ))}
          </div>

          {/* Composite Score */}
          {agent.results.length >= 2 && agent.state === "complete" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="bg-bg-secondary border border-accent-green/20 rounded-2xl p-6 glow-green-subtle"
            >
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-accent-green-light" />
                <h3 className="font-semibold">Composite Score</h3>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-text-tertiary mb-1">Avg Score</p>
                  <p className="text-3xl font-bold font-mono">
                    {Math.round(agent.results.reduce((s, r) => s + r.score, 0) / agent.results.length)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-tertiary mb-1">Consensus</p>
                  <p className={`text-3xl font-bold font-mono ${
                    agent.results.filter((r) => r.signal === "AVOID").length >= agent.results.length / 2
                      ? "text-accent-red"
                      : agent.results.filter((r) => r.signal === "BUY").length >= agent.results.length / 2
                      ? "text-accent-green-light"
                      : "text-accent-yellow"
                  }`}>
                    {agent.results.filter((r) => r.signal === "AVOID").length >= agent.results.length / 2
                      ? "AVOID"
                      : agent.results.filter((r) => r.signal === "BUY").length >= agent.results.length / 2
                      ? "BUY"
                      : "WATCH"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-tertiary mb-1">Models Run</p>
                  <p className="text-3xl font-bold font-mono">{agent.results.length}</p>
                </div>
                <div>
                  <p className="text-xs text-text-tertiary mb-1">Tools Used</p>
                  <p className="text-3xl font-bold font-mono text-blue-400">
                    {agent.toolCalls.filter((t) => t.status === "complete").length}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Empty state */}
      {agent.state === "idle" && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-center py-16"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-bg-secondary border border-border flex items-center justify-center">
            <Search className="w-8 h-8 text-text-tertiary" />
          </div>
          <h3 className="text-lg font-medium mb-2">Enter a token address</h3>
          <p className="text-sm text-text-tertiary max-w-md mx-auto">
            The monAlpha agent will autonomously investigate the token using tiered investigation tools,
            dynamically deciding what to analyze based on its findings.
          </p>
        </motion.div>
      )}
    </div>
  );
}

// === Timeline Row Dispatcher ===

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  switch (entry.kind) {
    case "step":
      return <TerminalStep step={entry.data} />;
    case "thinking":
      return <ThinkingBubble thinking={entry.data} />;
    case "tool_call":
      return <ToolCallRow tool={entry.data} />;
    case "investigation":
      return <InvestigationCard investigation={entry.data} />;
    case "confidence":
      return <ConfidenceRow confidence={entry.data} />;
    case "result":
      return <ResultRow result={entry.data} />;
  }
}

// === Terminal Sub-components ===

function TerminalStep({ step }: { step: AgentStepEvent }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="flex items-start gap-3"
    >
      <div className="mt-0.5 shrink-0">
        {step.status === "running" && <Loader2 className="w-4 h-4 text-accent-green-light animate-spin" />}
        {step.status === "complete" && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}>
            <CheckCircle2 className="w-4 h-4 text-accent-green-light" />
          </motion.div>
        )}
        {step.status === "error" && <XCircle className="w-4 h-4 text-accent-red" />}
        {step.status === "pending" && <div className="w-4 h-4 rounded-full border border-border" />}
      </div>
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${step.status === "complete" ? "text-text-primary" : step.status === "error" ? "text-accent-red" : "text-text-secondary"}`}>
          {step.step}
        </span>
        {step.detail && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-xs text-text-tertiary mt-0.5 truncate"
          >
            {step.detail}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}

function ThinkingBubble({ thinking }: { thinking: AgentThinkingEvent }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative pl-4 py-3 rounded-lg bg-accent-green/5 border-l-2 border-accent-green/40"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className="relative">
          <Brain className="w-3.5 h-3.5 text-accent-green-light" />
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent-green animate-pulse" />
        </div>
        <span className="text-[10px] text-accent-green-light font-semibold uppercase tracking-wider">Agent Thinking</span>
      </div>
      <p className="text-xs text-text-secondary leading-relaxed italic">{thinking.reasoning}</p>
      {thinking.nextTools.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <ChevronRight className="w-3 h-3 text-accent-green/50" />
          {thinking.nextTools.map((tool) => (
            <span key={tool} className="text-[9px] px-1.5 py-0.5 rounded bg-accent-green/10 text-accent-green-light font-mono">
              {tool}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function ToolCallRow({ tool }: { tool: AgentToolCallEvent }) {
  const [expanded, setExpanded] = useState(false);
  const tierColors = {
    1: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    2: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    3: "bg-red-500/15 text-red-400 border-red-500/25",
  };
  const tierLabel = `T${tool.tier}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-1"
    >
      <button
        onClick={() => tool.status === "complete" && tool.details && tool.details.length > 0 && setExpanded(!expanded)}
        className="flex items-center gap-2.5 w-full text-left group"
      >
        {/* Tier badge */}
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${tierColors[tool.tier]}`}>
          {tierLabel}
        </span>

        {/* Status icon */}
        <div className="shrink-0">
          {tool.status === "running" && <Loader2 className="w-3.5 h-3.5 text-accent-green-light animate-spin" />}
          {tool.status === "complete" && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}>
              <CheckCircle2 className="w-3.5 h-3.5 text-accent-green-light" />
            </motion.div>
          )}
          {tool.status === "skipped" && <div className="w-3.5 h-3.5 rounded-full border border-border" />}
        </div>

        {/* Tool name */}
        <span className="text-xs text-text-secondary font-mono">{tool.toolName}</span>

        {/* Finding summary */}
        {tool.finding && tool.status === "complete" && (
          <span className={`text-xs truncate flex-1 ${
            tool.severity === "critical" ? "text-accent-red" :
            tool.severity === "warning" ? "text-accent-yellow" :
            "text-text-tertiary"
          }`}>
            {tool.finding}
          </span>
        )}

        {/* Risk delta */}
        {tool.riskDelta !== undefined && tool.riskDelta !== 0 && tool.status === "complete" && (
          <span className={`text-[10px] font-mono shrink-0 ${
            tool.riskDelta > 0 ? "text-accent-red" : "text-accent-green-light"
          }`}>
            {tool.riskDelta > 0 ? "+" : ""}{tool.riskDelta}
          </span>
        )}

        {/* Expand chevron */}
        {tool.details && tool.details.length > 0 && tool.status === "complete" && (
          <ChevronDown className={`w-3 h-3 text-text-tertiary transition-transform shrink-0 ${expanded ? "rotate-180" : ""}`} />
        )}
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && tool.details && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-[72px] pl-3 border-l border-border/50 space-y-0.5 py-1">
              {tool.details.map((detail, j) => (
                <p key={j} className="text-[11px] text-text-tertiary leading-relaxed">
                  {detail}
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function InvestigationCard({ investigation }: { investigation: AgentInvestigationEvent }) {
  const severityColors = {
    info: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    warning: "bg-accent-yellow/10 border-accent-yellow/20 text-accent-yellow",
    critical: "bg-accent-red/10 border-accent-red/20 text-accent-red",
  };

  const SeverityIcon = investigation.severity === "critical" ? AlertTriangle : investigation.severity === "warning" ? AlertTriangle : Info;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`ml-7 p-3 rounded-lg border ${severityColors[investigation.severity]}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <SeverityIcon className="w-3.5 h-3.5" />
        <span className="text-xs font-semibold uppercase tracking-wider">{investigation.title}</span>
      </div>
      <p className="text-xs opacity-80 leading-relaxed">{investigation.finding}</p>
    </motion.div>
  );
}

function ConfidenceRow({ confidence }: { confidence: AgentConfidenceEvent }) {
  const signalColors = {
    SAFE: "text-accent-green-light",
    CAUTION: "text-accent-yellow",
    DANGER: "text-accent-red",
  };
  const barColors = {
    SAFE: "bg-accent-green",
    CAUTION: "bg-accent-yellow",
    DANGER: "bg-accent-red",
  };

  // Invert: risk 0 = safest → show as full green. risk 100 = most dangerous → full red
  const safetyScore = 100 - confidence.riskScore;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-3 py-1"
    >
      <Shield className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${safetyScore}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className={`h-full rounded-full ${barColors[confidence.signal]}`}
          />
        </div>
        <span className={`text-[10px] font-mono font-bold shrink-0 ${signalColors[confidence.signal]}`}>
          {safetyScore}/100 {confidence.signal}
        </span>
      </div>
    </motion.div>
  );
}

function ResultRow({ result }: { result: AgentResultEvent }) {
  const signalColors = {
    BUY: "text-accent-green-light",
    WATCH: "text-accent-yellow",
    AVOID: "text-accent-red",
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="flex items-center gap-3"
    >
      <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
      <span className="text-xs text-text-secondary">
        {result.modelName}:
      </span>
      <span className={`text-xs font-bold ${signalColors[result.signal]}`}>
        {result.signal}
      </span>
      <span className="text-xs text-text-tertiary font-mono">
        {result.score}/100
      </span>
      {result.isAIPowered && (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
          AI
        </span>
      )}
    </motion.div>
  );
}

function ConfidenceMeter({ confidence }: { confidence: AgentConfidenceEvent }) {
  const signalColors = {
    SAFE: "text-accent-green-light",
    CAUTION: "text-accent-yellow",
    DANGER: "text-accent-red",
  };
  const barColors = {
    SAFE: "bg-accent-green",
    CAUTION: "bg-accent-yellow",
    DANGER: "bg-accent-red",
  };

  const safetyScore = 100 - confidence.riskScore;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Shield className="w-4 h-4 text-text-tertiary" />
        <span className="text-xs text-text-tertiary font-mono">Safety Score</span>
        <div className="flex-1 h-2 rounded-full bg-bg-tertiary overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${safetyScore}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`h-full rounded-full ${barColors[confidence.signal]}`}
          />
        </div>
        <span className={`text-sm font-mono font-bold ${signalColors[confidence.signal]}`}>
          {safetyScore}/100
        </span>
        <span className={`text-[10px] font-bold uppercase ${signalColors[confidence.signal]}`}>
          {confidence.signal}
        </span>
      </div>
      {Object.keys(confidence.components).length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap ml-7">
          {Object.entries(confidence.components).map(([tool, delta]) => (
            <span
              key={tool}
              className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                delta > 0
                  ? "bg-accent-red/10 text-accent-red"
                  : delta < 0
                    ? "bg-accent-green/10 text-accent-green-light"
                    : "bg-bg-tertiary text-text-tertiary"
              }`}
            >
              {tool.replace("scan_", "").replace("investigate_", "")}:{delta > 0 ? "+" : ""}{delta}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
