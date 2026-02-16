"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, CheckCircle2, TrendingUp, Shield, Eye, Zap } from "lucide-react";
import ScoreGauge from "./ScoreGauge";

type Phase = "input" | "scanning" | "analyzing" | "result";

const steps = [
  { label: "Fetching holder data...", icon: "scan", duration: 800 },
  { label: "Analyzing distribution...", icon: "scan", duration: 600 },
  { label: "Checking creator wallet...", icon: "check", duration: 700 },
  { label: "Running AI model...", icon: "ai", duration: 1000 },
  { label: "Generating signal...", icon: "signal", duration: 500 },
];

export default function InteractiveDemo() {
  const [phase, setPhase] = useState<Phase>("input");
  const [currentStep, setCurrentStep] = useState(0);
  const [tokenInput, setTokenInput] = useState("");

  const runDemo = async () => {
    setPhase("scanning");
    setCurrentStep(0);

    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      await new Promise((r) => setTimeout(r, steps[i].duration));
    }

    setPhase("analyzing");
    await new Promise((r) => setTimeout(r, 800));
    setPhase("result");
  };

  const reset = () => {
    setPhase("input");
    setCurrentStep(0);
    setTokenInput("");
  };

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-bg-tertiary/50">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-accent-red/50" />
          <div className="w-3 h-3 rounded-full bg-accent-yellow/50" />
          <div className="w-3 h-3 rounded-full bg-accent-green/50" />
        </div>
        <span className="text-xs text-text-tertiary font-mono ml-2">monAlpha — live demo</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse-live" />
          <span className="text-[10px] text-text-tertiary">Interactive</span>
        </div>
      </div>

      <div className="p-6 min-h-[320px] flex flex-col">
        <AnimatePresence mode="wait">
          {/* Input Phase */}
          {phase === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col justify-center"
            >
              <p className="text-xs text-text-tertiary mb-3 font-mono">$ Enter token to analyze:</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="0x1234...5678"
                    className="w-full pl-10 pr-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-green/40 font-mono"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && tokenInput) runDemo();
                    }}
                  />
                </div>
                <motion.button
                  onClick={() => {
                    if (!tokenInput) setTokenInput("0xMEME...1234");
                    setTimeout(runDemo, 200);
                  }}
                  className="px-4 py-2.5 bg-accent-green hover:bg-accent-green-light text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Zap className="w-4 h-4" />
                  Analyze
                </motion.button>
              </div>
              <p className="text-[10px] text-text-tertiary mt-2">Try it — click Analyze or press Enter</p>
            </motion.div>
          )}

          {/* Scanning Phase */}
          {phase === "scanning" && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1"
            >
              <div className="flex items-center gap-2 mb-4">
                <Loader2 className="w-4 h-4 text-accent-green-light animate-spin" />
                <span className="text-sm font-medium">Analyzing {tokenInput || "0xMEME...1234"}</span>
              </div>
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={i <= currentStep ? { opacity: 1, x: 0 } : { opacity: 0.3, x: 0 }}
                    transition={{ delay: 0.1, duration: 0.3 }}
                    className="flex items-center gap-3 text-sm font-mono"
                  >
                    {i < currentStep ? (
                      <CheckCircle2 className="w-4 h-4 text-accent-green-light shrink-0" />
                    ) : i === currentStep ? (
                      <Loader2 className="w-4 h-4 text-accent-green-light animate-spin shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-border shrink-0" />
                    )}
                    <span className={i <= currentStep ? "text-text-primary" : "text-text-tertiary"}>
                      {step.label}
                    </span>
                    {i < currentStep && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xs text-accent-green-light ml-auto"
                      >
                        {(steps[i].duration / 1000).toFixed(1)}s
                      </motion.span>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="mt-4 h-1 bg-bg-tertiary rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-accent-green rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          )}

          {/* Analyzing Phase */}
          {phase === "analyzing" && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-1 flex items-center justify-center"
            >
              <div className="text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-12 h-12 mx-auto mb-3 rounded-full border-2 border-accent-green/20 border-t-accent-green"
                />
                <p className="text-sm text-text-secondary">Generating AI signal...</p>
              </div>
            </motion.div>
          )}

          {/* Result Phase */}
          {phase === "result" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1"
            >
              <div className="flex items-start gap-6">
                <ScoreGauge score={78} size={140} />
                <div className="flex-1 pt-2">
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-2 mb-3"
                  >
                    <div className="px-2.5 py-1 bg-accent-green/15 border border-accent-green/30 rounded-lg flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-accent-green-light" />
                      <span className="text-sm font-bold text-accent-green-light">BUY</span>
                    </div>
                    <span className="text-xs text-text-tertiary">HIGH confidence</span>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="space-y-2 mb-3"
                  >
                    <BarResult label="Liquidity" value={85} />
                    <BarResult label="Safety" value={82} />
                    <BarResult label="Holders" value={67} />
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="text-xs text-text-secondary leading-relaxed"
                  >
                    Strong organic holder growth. Top 10 wallets hold 35%. No honeypot detected.
                  </motion.p>
                </div>
              </div>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                onClick={reset}
                className="mt-4 w-full py-2 text-xs text-text-secondary hover:text-text-primary bg-bg-tertiary hover:bg-border rounded-lg transition-all"
              >
                Try another token
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function BarResult({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? "bg-accent-green" : value >= 50 ? "bg-accent-yellow" : "bg-accent-red";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-text-tertiary w-14">{label}</span>
      <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
        />
      </div>
      <span className="text-[10px] font-mono text-text-secondary w-6 text-right blur-[4px] select-none">{value}</span>
    </div>
  );
}
