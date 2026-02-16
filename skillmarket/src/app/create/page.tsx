"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, CheckCircle2, AlertTriangle, Eye, Coins, Zap, Loader2,
  Shield, TrendingUp, Droplets, Activity, BarChart3, Brain, ChevronDown, Settings2, Sparkles, Wallet,
} from "lucide-react";
import { useConnect } from "wagmi";
import { useSkillRegistry } from "@/hooks/useSkillRegistry";
import { REGISTRATION_FEE_MON } from "@/lib/constants";

// === 6 distinct templates ===

const TEMPLATES = [
  {
    id: "safety-first",
    name: "Safety First",
    icon: Shield,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    desc: "Conservative scam detection — prioritizes safety and creator trust.",
    markdown: `# Safety First Scanner

## Type
RESEARCH

## Data Sources
- Creator wallet history
- Liquidity lock status
- Trading patterns
- Holder distribution

## Analysis Steps
1. Check creator reputation and past tokens
2. Analyze liquidity lock status
3. Detect suspicious trading patterns
4. Evaluate holder concentration

## Scoring Breakdown
Creator Trust: 35 points
Liquidity Depth: 30 points
Trading Health: 20 points
Holder Distribution: 15 points

## Signal Logic
- BUY: Total score > 80
- WATCH: Total score 55-80
- AVOID: Total score < 55

## AI System Prompt
"You are a conservative on-chain safety analyst. Prioritize creator reputation and liquidity safety. Flag any red flags aggressively. Only recommend BUY for tokens with excellent safety profiles. When in doubt, recommend AVOID."`,
  },
  {
    id: "whale-watcher",
    name: "Whale Watcher",
    icon: TrendingUp,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    desc: "Tracks whale activity, holder concentration, and buy pressure.",
    markdown: `# Whale Watcher

## Type
RESEARCH

## Data Sources
- Top holder distribution
- Buy/sell pressure ratio
- Unique trader count
- Volume-to-market-cap ratio

## Analysis Steps
1. Analyze top holder concentration
2. Calculate buy/sell pressure
3. Evaluate trader diversity
4. Assess volume relative to market cap

## Scoring Breakdown
Whale Concentration: 30 points
Buy Sell Ratio: 25 points
Trader Diversity: 25 points
Volume MCap Ratio: 20 points

## Signal Logic
- BUY: Total score > 70
- WATCH: Total score 45-70
- AVOID: Total score < 45

## AI System Prompt
"You are a whale activity analyst. Focus on holder distribution patterns, buy/sell ratios, and trading volume. Healthy tokens have distributed holders, strong buy pressure, and growing trader counts."`,
  },
  {
    id: "liquidity-hunter",
    name: "Liquidity Hunter",
    icon: Droplets,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
    desc: "Deep liquidity analysis — reserves, price impact, graduation progress.",
    markdown: `# Liquidity Hunter

## Type
RESEARCH

## Data Sources
- Bonding curve reserves
- Price impact at various levels
- Graduation progress
- Reserve utilization

## Analysis Steps
1. Evaluate bonding curve reserve depth
2. Test price impact at 1/10/100 MON levels
3. Check graduation progress
4. Calculate reserve utilization efficiency

## Scoring Breakdown
Liquidity Depth: 30 points
Price Impact: 25 points
Graduation Progress: 25 points
Reserve Utilization: 20 points

## Signal Logic
- BUY: Total score > 65
- WATCH: Total score 40-65
- AVOID: Total score < 40

## AI System Prompt
"You are a liquidity analyst specializing in bonding curve mechanics. Focus on reserve depth, price impact, and graduation progress. Good liquidity means low slippage and healthy reserves."`,
  },
  {
    id: "momentum-trader",
    name: "Momentum Trader",
    icon: Activity,
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
    desc: "Aggressive growth-focused — volume momentum, growth signals, age.",
    markdown: `# Momentum Trader

## Type
RESEARCH

## Data Sources
- Volume growth patterns
- Price momentum
- Token age
- Trading frequency

## Analysis Steps
1. Measure volume growth trajectory
2. Evaluate price momentum signals
3. Check token age and maturity
4. Assess trading frequency and consistency

## Scoring Breakdown
Growth Signal: 35 points
Volume MCap Ratio: 25 points
Trading Health: 25 points
Token Age: 15 points

## Signal Logic
- BUY: Total score > 60
- WATCH: Total score 35-60
- AVOID: Total score < 35

## AI System Prompt
"You are an aggressive momentum trader. Focus on growth signals, volume patterns, and trading activity. Young tokens with strong volume growth and consistent trading get higher scores. Don't worry too much about safety — prioritize momentum."`,
  },
  {
    id: "balanced-analyst",
    name: "Balanced Analyst",
    icon: BarChart3,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    desc: "Well-rounded model — equal weight across all major metrics.",
    markdown: `# Balanced Analyst

## Type
RESEARCH

## Data Sources
- Holder distribution
- Liquidity metrics
- Creator wallet history
- Trading patterns
- Price impact data

## Analysis Steps
1. Evaluate holder distribution health
2. Check liquidity depth and reserves
3. Analyze creator reputation
4. Review trading volume and patterns
5. Assess price impact at multiple levels

## Scoring Breakdown
Holder Distribution: 20 points
Liquidity Depth: 20 points
Creator Trust: 20 points
Trading Health: 20 points
Price Impact: 20 points

## Signal Logic
- BUY: Total score > 70
- WATCH: Total score 45-70
- AVOID: Total score < 45

## AI System Prompt
"You are a balanced on-chain analyst. Give equal consideration to all metrics: holders, liquidity, creator trust, trading activity, and price impact. A good token scores well across all categories."`,
  },
  {
    id: "deep-research",
    name: "Deep Research (AI)",
    icon: Brain,
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
    desc: "AI-powered deep analysis using DeepSeek V3. Costs extra per query.",
    markdown: `# Deep Research AI

## Type
DEEP_RESEARCH

## Data Sources
- All on-chain data
- Holder distribution
- Liquidity metrics
- Creator history
- Trading patterns
- Price impact analysis

## Analysis Steps
1. Gather all available on-chain data
2. Feed complete token profile to DeepSeek V3
3. AI performs holistic analysis
4. Generate detailed reasoning and risk assessment

## Scoring Breakdown
Overall Quality: 25 points
Safety Profile: 25 points
Growth Potential: 25 points
Liquidity Health: 25 points

## Signal Logic
- BUY: Total score > 70
- WATCH: Total score 40-70
- AVOID: Total score < 40

## AI System Prompt
"You are an expert crypto research analyst powered by DeepSeek V3. Perform a comprehensive analysis of this token considering ALL available data points. Provide nuanced reasoning that considers both opportunities and risks. Look for patterns that simple scoring might miss: unusual trading patterns, creator behavior, liquidity traps, organic vs artificial growth. Be thorough but decisive in your signal recommendation."`,
  },
];

export default function CreatePage() {
  const [skillContent, setSkillContent] = useState("");
  const [price, setPrice] = useState("0.5");
  const [step, setStep] = useState<"templates" | "edit" | "preview" | "deploy">("templates");
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployedModel, setDeployedModel] = useState<{ id: string; name: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { registerSkill, paymentState, resetPayment, isConnected, isWrongNetwork, ensureMonadChain, address } = useSkillRegistry();
  const { connect, connectors } = useConnect();

  // Advanced settings state
  const [riskTolerance, setRiskTolerance] = useState<"conservative" | "moderate" | "aggressive">("moderate");
  const [requireApiData, setRequireApiData] = useState(false);
  const [minTrades, setMinTrades] = useState("0");
  const [customBuyThreshold, setCustomBuyThreshold] = useState("");
  const [customAvoidThreshold, setCustomAvoidThreshold] = useState("");

  const isDeepResearch = skillContent.includes("DEEP_RESEARCH");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSkillContent(ev.target?.result as string);
      validateContent(ev.target?.result as string);
      setStep("edit");
    };
    reader.readAsText(file);
  };

  const validateContent = (content: string) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!content.includes("## Type")) errors.push("Missing ## Type section");
    if (!content.includes("## Signal Logic")) errors.push("Missing ## Signal Logic section");
    if (!content.includes("## AI System Prompt")) errors.push("Missing ## AI System Prompt section");
    if (!content.includes("## Scoring Breakdown") && !content.includes("DEEP_RESEARCH")) warnings.push("No scoring breakdown defined");
    if (!content.includes("## Data Sources")) warnings.push("No data sources specified");
    if (content.length < 100) errors.push("Content too short — add more detail");

    setValidation({ valid: errors.length === 0, errors, warnings });
  };

  const selectTemplate = (template: typeof TEMPLATES[0]) => {
    setSkillContent(template.markdown);
    validateContent(template.markdown);
    setStep("edit");
  };

  const buildAdvancedSettings = () => {
    const settings: Record<string, unknown> = {
      riskTolerance,
      requireApiData,
      minTradesRequired: parseInt(minTrades) || 0,
      customBuyThreshold: customBuyThreshold ? parseInt(customBuyThreshold) : null,
      customAvoidThreshold: customAvoidThreshold ? parseInt(customAvoidThreshold) : null,
    };
    return settings;
  };

  const deployModel = async () => {
    if (!isConnected || !address) {
      setDeployError("Wallet not connected — please connect and try again");
      return;
    }
    setDeploying(true);
    setDeployError(null);
    resetPayment();

    try {
      // Step 1: On-chain payment (registerSkill)
      const modelName = skillContent.match(/^#\s+(.+)/m)?.[1] || "Unnamed Model";
      const txHash = await registerSkill(modelName, "", Number(price));

      if (!txHash) {
        // User rejected or payment failed — paymentState has the error
        setDeploying(false);
        return;
      }

      // Step 2: Register in backend with tx proof
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillMarkdown: skillContent,
          price: Number(price),
          creator: address,
          advancedSettings: buildAdvancedSettings(),
          modelType: isDeepResearch ? "DEEP_RESEARCH" : "RESEARCH",
          txHash: txHash === "dev-mode" ? undefined : txHash,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeployError(data.errors?.join(", ") || data.error || "Deploy failed");
      } else {
        setDeployedModel({ id: data.model.id, name: data.model.name });
        setStep("deploy");
      }
    } catch (err) {
      setDeployError(String(err));
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Create Model</h1>
          <p className="text-sm text-text-tertiary">Choose a template or write a custom SKILL.md</p>
        </div>
        <div className="flex items-center gap-2">
          <StepIndicator step={1} label="Template" active={step === "templates"} />
          <div className="w-6 h-px bg-border" />
          <StepIndicator step={2} label="Edit" active={step === "edit"} />
          <div className="w-6 h-px bg-border" />
          <StepIndicator step={3} label="Preview" active={step === "preview"} />
          <div className="w-6 h-px bg-border" />
          <StepIndicator step={4} label="Deploy" active={step === "deploy"} />
        </div>
      </div>

      {/* Step 1: Template Selection */}
      {step === "templates" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">Pick a starting template or start from scratch</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setSkillContent(""); setValidation(null); setStep("edit"); }}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary bg-bg-secondary hover:bg-bg-tertiary border border-border rounded-xl transition-all"
              >
                Start from Scratch
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 text-sm text-accent-green-light bg-accent-green/10 hover:bg-accent-green/20 border border-accent-green/20 rounded-xl transition-all flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload .md
              </button>
              <input ref={fileInputRef} type="file" accept=".md" onChange={handleFileUpload} className="hidden" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TEMPLATES.map((t, i) => {
              const Icon = t.icon;
              return (
                <motion.button
                  key={t.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.35, ease: [0.25, 0.4, 0.25, 1] }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => selectTemplate(t)}
                  className="group text-left p-5 bg-bg-secondary border border-border rounded-2xl hover:border-accent-green/30 transition-all"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${t.bg}`}>
                      <Icon className={`w-5 h-5 ${t.color}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary group-hover:text-white transition-colors">{t.name}</h3>
                      {t.id === "deep-research" && (
                        <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 w-fit">
                          <Sparkles className="w-2.5 h-2.5" />
                          DeepSeek V3
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-text-tertiary leading-relaxed mb-4">{t.desc}</p>
                  <div className="text-xs text-accent-green-light opacity-0 group-hover:opacity-100 transition-all">
                    Use this template →
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Edit */}
      {step === "edit" && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Editor */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-tertiary/50">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-text-tertiary" />
                  <span className="text-xs text-text-tertiary font-mono">SKILL.md</span>
                  {isDeepResearch && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Sparkles className="w-2.5 h-2.5" />
                      DEEP_RESEARCH
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStep("templates")}
                    className="px-3 py-1 text-xs text-text-secondary hover:text-text-primary bg-bg-tertiary hover:bg-border rounded-lg transition-all border border-border"
                  >
                    Templates
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1 text-xs text-accent-green-light bg-accent-green/10 hover:bg-accent-green/20 rounded-lg transition-all border border-accent-green/20"
                  >
                    <Upload className="w-3 h-3 inline mr-1" />
                    Upload
                  </button>
                  <input ref={fileInputRef} type="file" accept=".md" onChange={handleFileUpload} className="hidden" />
                </div>
              </div>
              <textarea
                value={skillContent}
                onChange={(e) => {
                  setSkillContent(e.target.value);
                  if (e.target.value.length > 50) validateContent(e.target.value);
                }}
                placeholder="# Your Model Name&#10;&#10;## Type&#10;RESEARCH&#10;&#10;## Data Sources&#10;- ...&#10;&#10;## Signal Logic&#10;- BUY: ...&#10;- WATCH: ...&#10;- AVOID: ...&#10;&#10;## AI System Prompt&#10;&quot;...&quot;"
                className="w-full h-[500px] p-5 bg-bg-secondary text-sm font-mono text-text-primary placeholder:text-text-tertiary resize-none focus:outline-none leading-relaxed"
              />
            </div>

            {/* Validation */}
            {validation && (
              <div className={`p-4 rounded-xl border ${validation.valid ? "bg-accent-green/5 border-accent-green/20" : "bg-accent-red/5 border-accent-red/20"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {validation.valid ? (
                    <CheckCircle2 className="w-4 h-4 text-accent-green-light" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-accent-red" />
                  )}
                  <span className={`text-sm font-medium ${validation.valid ? "text-accent-green-light" : "text-accent-red"}`}>
                    {validation.valid ? "Valid SKILL.md" : "Validation errors found"}
                  </span>
                </div>
                {validation.errors.map((e, i) => (
                  <p key={i} className="text-xs text-accent-red ml-6">- {e}</p>
                ))}
                {validation.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-accent-yellow ml-6">- {w}</p>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Settings */}
            <div className="bg-bg-secondary border border-border rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Coins className="w-4 h-4 text-text-tertiary" />
                Model Settings
              </h3>
              <div>
                <label className="text-xs text-text-tertiary uppercase tracking-wider mb-1 block">Price per Analysis</label>
                <div className="relative">
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    step="0.1"
                    min="0"
                    className="w-full pl-3 pr-14 py-2.5 bg-bg-tertiary border border-border rounded-xl text-sm font-mono focus:outline-none focus:border-accent-green/40 transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-tertiary">MON</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-text-tertiary uppercase tracking-wider mb-1 block">Required Stake</label>
                <div className="px-3 py-2.5 bg-bg-tertiary border border-border rounded-xl text-sm font-mono text-text-secondary">
                  100 $MALPHA
                </div>
                <p className="text-[10px] text-text-tertiary mt-1">Returned if accuracy stays above 70%</p>
              </div>

              {isDeepResearch && (
                <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-xl">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs font-medium text-purple-400">AI-Powered Model</span>
                  </div>
                  <p className="text-[10px] text-text-tertiary leading-relaxed">
                    This model uses DeepSeek V3 for deep analysis. Each analysis costs ~$0.001 in API fees. Requires DEEPSEEK_API_KEY in .env.local.
                  </p>
                </div>
              )}
            </div>

            {/* Advanced Settings */}
            <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-bg-tertiary/50 transition-all"
              >
                <span className="text-sm font-semibold flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-text-tertiary" />
                  Advanced Settings
                </span>
                <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
                  className="overflow-hidden"
                >
                <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                  {/* Risk Tolerance */}
                  <div>
                    <label className="text-xs text-text-tertiary uppercase tracking-wider mb-2 block">Risk Tolerance</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["conservative", "moderate", "aggressive"] as const).map((level) => (
                        <button
                          key={level}
                          onClick={() => setRiskTolerance(level)}
                          className={`py-2 text-xs font-medium rounded-lg border transition-all capitalize ${
                            riskTolerance === level
                              ? level === "conservative" ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                              : level === "aggressive" ? "bg-red-500/10 border-red-500/30 text-red-400"
                              : "bg-accent-green/10 border-accent-green/30 text-accent-green-light"
                              : "bg-bg-tertiary border-border text-text-tertiary hover:text-text-secondary"
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-text-tertiary mt-1.5">
                      {riskTolerance === "conservative" && "Higher thresholds. Only recommends BUY for top-scoring tokens."}
                      {riskTolerance === "moderate" && "Balanced thresholds. Standard scoring behavior."}
                      {riskTolerance === "aggressive" && "Lower thresholds. More willing to recommend BUY signals."}
                    </p>
                  </div>

                  {/* Data Requirements */}
                  <div>
                    <label className="text-xs text-text-tertiary uppercase tracking-wider mb-2 block">Data Requirements</label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={requireApiData}
                        onChange={(e) => setRequireApiData(e.target.checked)}
                        className="w-4 h-4 rounded border-border bg-bg-tertiary accent-accent-green"
                      />
                      <span className="text-xs text-text-secondary">Require full API data</span>
                    </label>
                    <p className="text-[10px] text-text-tertiary mt-1 ml-6">Returns AVOID if nad.fun data unavailable</p>
                  </div>

                  {/* Min Trades */}
                  <div>
                    <label className="text-xs text-text-tertiary uppercase tracking-wider mb-1 block">Min Trades Required</label>
                    <input
                      type="number"
                      value={minTrades}
                      onChange={(e) => setMinTrades(e.target.value)}
                      min="0"
                      className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm font-mono focus:outline-none focus:border-accent-green/40 transition-all"
                    />
                    <p className="text-[10px] text-text-tertiary mt-1">0 = no minimum</p>
                  </div>

                  {/* Custom Thresholds */}
                  <div>
                    <label className="text-xs text-text-tertiary uppercase tracking-wider mb-2 block">Custom Thresholds</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-text-tertiary mb-1 block">BUY above</label>
                        <input
                          type="number"
                          value={customBuyThreshold}
                          onChange={(e) => setCustomBuyThreshold(e.target.value)}
                          placeholder="From SKILL.md"
                          min="30"
                          max="95"
                          className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-xs font-mono focus:outline-none focus:border-accent-green/40 transition-all placeholder:text-text-tertiary"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-text-tertiary mb-1 block">AVOID below</label>
                        <input
                          type="number"
                          value={customAvoidThreshold}
                          onChange={(e) => setCustomAvoidThreshold(e.target.value)}
                          placeholder="From SKILL.md"
                          min="10"
                          max="80"
                          className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-xs font-mono focus:outline-none focus:border-accent-green/40 transition-all placeholder:text-text-tertiary"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-text-tertiary mt-1">Leave empty to use SKILL.md defaults</p>
                  </div>
                </div>
                </motion.div>
              )}
              </AnimatePresence>
            </div>

            {/* Deployment Cost */}
            <div className="bg-bg-secondary border border-border rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Wallet className="w-4 h-4 text-accent-green-light" />
                Deployment Cost
              </h3>
              <div className="space-y-2">
                <RevenueLine label="Registration fee" value={`${REGISTRATION_FEE_MON} MON`} highlight />
                <RevenueLine label="→ Platform (50%)" value={`${REGISTRATION_FEE_MON / 2} MON`} />
                <RevenueLine label="→ Buyback fund (50%)" value={`${REGISTRATION_FEE_MON / 2} MON`} />
              </div>
              <div className="pt-2 border-t border-border space-y-2">
                <p className="text-[10px] text-text-tertiary font-semibold uppercase tracking-wider">Per analysis revenue</p>
                <RevenueLine label="You earn (50%)" value={`${(Number(price) * 0.5).toFixed(2)} MON`} highlight />
                <RevenueLine label="Buyback fund (50%)" value={`${(Number(price) * 0.5).toFixed(2)} MON`} />
              </div>
            </div>

            {/* Next Step */}
            <button
              onClick={() => { if (validation?.valid) setStep("preview"); }}
              disabled={!validation?.valid}
              className="w-full py-3 bg-accent-green hover:bg-accent-green-light disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Preview Model
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === "preview" && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-bg-tertiary/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">SKILL.md Preview</span>
                {isDeepResearch && (
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Sparkles className="w-2.5 h-2.5" />
                    AI-Powered
                  </span>
                )}
              </div>
              <button onClick={() => setStep("edit")} className="text-xs text-text-secondary hover:text-text-primary">
                Edit
              </button>
            </div>
            <pre className="p-5 text-sm font-mono text-text-secondary leading-relaxed whitespace-pre-wrap">
              {skillContent}
            </pre>
          </div>

          {/* Settings Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-bg-secondary border border-border rounded-xl">
              <p className="text-[10px] text-text-tertiary mb-1">Price</p>
              <p className="text-sm font-bold font-mono">{price} MON</p>
            </div>
            <div className="p-3 bg-bg-secondary border border-border rounded-xl">
              <p className="text-[10px] text-text-tertiary mb-1">Stake</p>
              <p className="text-sm font-bold font-mono">100 $MALPHA</p>
            </div>
            <div className="p-3 bg-bg-secondary border border-border rounded-xl">
              <p className="text-[10px] text-text-tertiary mb-1">Risk</p>
              <p className="text-sm font-bold font-mono capitalize">{riskTolerance}</p>
            </div>
            <div className="p-3 bg-bg-secondary border border-border rounded-xl">
              <p className="text-[10px] text-text-tertiary mb-1">Type</p>
              <p className="text-sm font-bold font-mono">{isDeepResearch ? "AI Deep" : "Standard"}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("edit")}
              className="flex-1 py-3 bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border rounded-xl transition-all"
            >
              Back to Edit
            </button>
            <button
              onClick={async () => {
                if (!isConnected) {
                  const injected = connectors.find((c) => c.id === "injected") || connectors[0];
                  if (injected) connect({ connector: injected });
                  return;
                }
                if (isWrongNetwork) {
                  const switched = await ensureMonadChain();
                  if (!switched) return;
                }
                deployModel();
              }}
              disabled={deploying}
              className="flex-1 py-3 bg-accent-green hover:bg-accent-green-light disabled:opacity-60 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 glow-green-subtle"
            >
              {!isConnected ? (
                <><Wallet className="w-4 h-4" /> Connect Wallet to Deploy</>
              ) : isWrongNetwork ? (
                <><AlertTriangle className="w-4 h-4" /> Switch to Monad</>
              ) : paymentState.status === "pending" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Confirm in Wallet...</>
              ) : paymentState.status === "confirming" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Confirming tx...</>
              ) : deploying ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Registering model...</>
              ) : (
                <><Zap className="w-4 h-4" /> Pay {REGISTRATION_FEE_MON} MON & Deploy</>
              )}
            </button>
          </div>
          {(deployError || paymentState.error) && (
            <p className="text-xs text-accent-red text-center">{deployError || paymentState.error}</p>
          )}
        </div>
      )}

      {/* Step 4: Success */}
      {step === "deploy" && (
        <div className="max-w-lg mx-auto text-center space-y-6 py-12">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="w-20 h-20 mx-auto rounded-2xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center"
          >
            <CheckCircle2 className="w-10 h-10 text-accent-green-light" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <h2 className="text-2xl font-semibold mb-2">Model Deployed!</h2>
            <p className="text-text-secondary">Your research model is now live on the marketplace.</p>
          </motion.div>
          <div className="bg-bg-secondary border border-border rounded-xl p-4 space-y-3 text-left">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-tertiary">Model Name</span>
              <span className="font-mono text-text-secondary">{deployedModel?.name || "—"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-tertiary">Model ID</span>
              <span className="font-mono text-text-secondary text-xs">{deployedModel?.id || "—"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-tertiary">Creator</span>
              <span className="font-mono text-text-secondary text-xs">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "—"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-tertiary">Price</span>
              <span className="font-mono text-text-secondary">{price} MON</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-tertiary">Type</span>
              <span className={`font-mono text-sm ${isDeepResearch ? "text-purple-400" : "text-text-secondary"}`}>
                {isDeepResearch ? "Deep Research (AI)" : "Standard Research"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-tertiary">Risk</span>
              <span className="font-mono text-text-secondary capitalize">{riskTolerance}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-tertiary">Status</span>
              <span className="text-accent-green-light font-medium">Active</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setStep("templates");
                setSkillContent("");
                setValidation(null);
                setDeployedModel(null);
                setRiskTolerance("moderate");
                setRequireApiData(false);
                setMinTrades("0");
                setCustomBuyThreshold("");
                setCustomAvoidThreshold("");
              }}
              className="flex-1 py-3 bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border rounded-xl transition-all"
            >
              Create Another
            </button>
            <a
              href="/marketplace"
              className="flex-1 py-3 bg-accent-green/10 hover:bg-accent-green/20 text-accent-green-light border border-accent-green/20 rounded-xl transition-all flex items-center justify-center"
            >
              View on Marketplace
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ step, label, active }: { step: number; label: string; active: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${active ? "bg-accent-green/10 border border-accent-green/20" : ""}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
        active ? "bg-accent-green text-white" : "bg-bg-tertiary text-text-tertiary"
      }`}>
        {step}
      </div>
      <span className={`text-xs font-medium ${active ? "text-accent-green-light" : "text-text-tertiary"}`}>{label}</span>
    </div>
  );
}

function RevenueLine({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${highlight ? "text-accent-green-light font-medium" : "text-text-tertiary"}`}>{label}</span>
      <span className={`text-sm font-mono ${highlight ? "text-accent-green-light font-semibold" : "text-text-secondary"}`}>{value}</span>
    </div>
  );
}
