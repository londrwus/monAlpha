"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Zap,
  Search,
  Upload,
  BarChart3,
  Shield,
  Users,
  Brain,
  Layers,
  Eye,
  ChevronRight,
  Sparkles,
  Target,
  Network,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StatsBar from "@/components/StatsBar";
import FadeIn from "@/components/animations/FadeIn";
import { StaggerContainer, StaggerItem } from "@/components/animations/StaggerContainer";
import TiltCard from "@/components/animations/TiltCard";
import MorphingText from "@/components/animations/MorphingText";
import InteractiveDemo from "@/components/interactive/InteractiveDemo";
import NetworkGraph from "@/components/interactive/NetworkGraph";
import TokenTicker from "@/components/TokenTicker";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar variant="landing" />

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="absolute inset-0 radial-glow" />

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          {/* Badge */}
          <FadeIn delay={0.2} direction="none">
            <div className="flex justify-center mb-8">
              <motion.div
                className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent-green/10 border border-accent-green/20 rounded-full"
                whileHover={{ scale: 1.05, borderColor: "rgba(74,155,114,0.4)" }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse-live" />
                <span className="text-xs text-accent-green-light font-medium">Live on Monad</span>
              </motion.div>
            </div>
          </FadeIn>

          {/* Headline */}
          <div className="text-center max-w-4xl mx-auto mb-8">
            <FadeIn delay={0.4} duration={0.8}>
              <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl leading-[1.1] tracking-tight mb-6">
                <motion.span
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.7, ease: [0.25, 0.4, 0.25, 1] }}
                >
                  AI Research Intelligence
                </motion.span>
                <br />
                <motion.span
                  className="italic text-accent-green-light"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.7, ease: [0.25, 0.4, 0.25, 1] }}
                >
                  for Monad{" "}
                  <MorphingText
                    words={["Memecoins.", "Tokens.", "DeFi.", "Traders."]}
                    interval={3000}
                    className="text-accent-green-light"
                  />
                </motion.span>
              </h1>
            </FadeIn>
            <FadeIn delay={0.9}>
              <p className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed">
                Community-powered research agents analyze every new token on nad.fun.
                Create your own strategies. Earn from every usage.
              </p>
            </FadeIn>
          </div>

          {/* CTA */}
          <FadeIn delay={1.1}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="/analyze"
                  className="group px-8 py-3.5 bg-accent-green hover:bg-accent-green-light text-white font-medium rounded-xl transition-all glow-green flex items-center gap-2"
                >
                  Request Analysis
                  <motion.span
                    animate={{ x: [0, 3, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </motion.span>
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="/marketplace"
                  className="px-8 py-3.5 bg-bg-secondary hover:bg-bg-tertiary text-text-primary font-medium rounded-xl border border-border hover:border-border-light transition-all flex items-center gap-2"
                >
                  Browse Models
                  <Layers className="w-4 h-4 text-text-tertiary" />
                </Link>
              </motion.div>
            </div>
          </FadeIn>

          {/* $MALPHA Contract */}
          <FadeIn delay={1.3}>
            <ContractBadge />
          </FadeIn>

          {/* Stats */}
          <FadeIn delay={1.5}>
            <StatsBar />
          </FadeIn>
        </div>
      </section>

      {/* Scrolling ticker — fetches real tokens from nad.fun */}
      <TokenTicker />

      {/* Interactive Demo + Network Graph */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-xs text-accent-green-light uppercase tracking-widest mb-3 font-medium">Try It Now</p>
              <h2 className="font-serif text-4xl sm:text-5xl mb-4">
                See it <span className="italic">in action.</span>
              </h2>
              <p className="text-text-secondary max-w-xl mx-auto">
                Run a live analysis demo. Watch the AI process on-chain data in real time.
              </p>
            </div>
          </FadeIn>

          <div className="grid lg:grid-cols-2 gap-8 items-start">
            <FadeIn delay={0.2} direction="left">
              <InteractiveDemo />
            </FadeIn>
            <FadeIn delay={0.4} direction="right">
              <div className="bg-bg-secondary border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Network className="w-4 h-4 text-accent-green-light" />
                  <h3 className="text-sm font-semibold">Token Relationship Graph</h3>
                  <span className="text-[10px] text-text-tertiary ml-auto">Hover to explore</span>
                </div>
                <NetworkGraph />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* How It Works — Vertical Timeline */}
      <section id="how-it-works" className="py-24 relative bg-bg-secondary/30 border-y border-border/50">
        <div className="max-w-4xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-20">
              <p className="text-xs text-accent-green-light uppercase tracking-widest mb-3 font-medium">How It Works</p>
              <h2 className="font-serif text-4xl sm:text-5xl mb-4">
                Three steps to <span className="italic">alpha.</span>
              </h2>
              <p className="text-text-secondary max-w-xl mx-auto">
                From token address to actionable intelligence in under 30 seconds.
              </p>
            </div>
          </FadeIn>

          <div className="relative">
            {/* Animated vertical line */}
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px md:-translate-x-px">
              <motion.div
                className="w-full h-full bg-gradient-to-b from-accent-green/60 via-accent-green/30 to-transparent"
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                style={{ transformOrigin: "top" }}
              />
            </div>

            {/* Pulse traveling down the line */}
            <motion.div
              className="absolute left-6 md:left-1/2 w-1 h-8 -translate-x-[1px] md:-translate-x-[2px] rounded-full bg-accent-green/80 blur-[3px]"
              animate={{ top: ["0%", "100%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
            />

            <div className="space-y-16 md:space-y-24">
              {/* Step 1 */}
              <TimelineStep
                step="01"
                icon={<Search className="w-5 h-5" />}
                title="Submit Token"
                description="Paste any token address from nad.fun. Select one or multiple research models to analyze it."
                detail="0x1a2b...3c4d"
                side="right"
                delay={0}
              />

              {/* Step 2 */}
              <TimelineStep
                step="02"
                icon={<Brain className="w-5 h-5" />}
                title="AI Analyzes"
                description="On-chain data is collected and fed through community-created research strategies powered by DeepSeek."
                detail="Processing..."
                side="left"
                delay={0.2}
              />

              {/* Step 3 */}
              <TimelineStep
                step="03"
                icon={<Target className="w-5 h-5" />}
                title="Get Signal"
                description="Receive BUY, WATCH, or AVOID signals with confidence scores, risk flags, and detailed reasoning."
                detail="Signal Ready"
                side="right"
                delay={0.4}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-xs text-accent-green-light uppercase tracking-widest mb-3 font-medium">Features</p>
              <h2 className="font-serif text-4xl sm:text-5xl mb-4">
                Intelligence, <span className="italic">decentralized.</span>
              </h2>
            </div>
          </FadeIn>

          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-5" staggerDelay={0.08}>
            {[
              { icon: <Shield className="w-5 h-5" />, title: "Rug Detection", description: "Automated honeypot checks, creator wallet history analysis, and smart contract verification." },
              { icon: <BarChart3 className="w-5 h-5" />, title: "Holder Analytics", description: "Distribution scoring, whale tracking, wallet clustering, and organic growth detection." },
              { icon: <Eye className="w-5 h-5" />, title: "Liquidity Depth", description: "Real-time liquidity metrics, price impact simulation, and pool health monitoring." },
              { icon: <Network className="w-5 h-5" />, title: "Composable Models", description: "Run multiple research models on the same token. Compare signals. Build conviction." },
              { icon: <Users className="w-5 h-5" />, title: "Creator Economics", description: "Upload your SKILL.md research strategy. Earn 70% of every analysis fee. Build reputation." },
              { icon: <Sparkles className="w-5 h-5" />, title: "On-Chain Accuracy", description: "Every model's predictions tracked transparently. 7-day settlement. Trust through data." },
            ].map((f, i) => (
              <StaggerItem key={i}>
                <TiltCard className="h-full" intensity={6} glare>
                  <FeatureCard {...f} />
                </TiltCard>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* SKILL.md section */}
      <section id="creators" className="py-24 relative overflow-hidden bg-bg-secondary/30 border-y border-border/50">
        <div className="absolute inset-0 radial-glow opacity-50" />
        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <FadeIn direction="left">
              <div>
                <p className="text-xs text-accent-green-light uppercase tracking-widest mb-3 font-medium">For Creators</p>
                <h2 className="font-serif text-4xl sm:text-5xl mb-6 leading-tight">
                  Your research,
                  <br />
                  <span className="italic">your revenue.</span>
                </h2>
                <p className="text-text-secondary leading-relaxed mb-8 max-w-lg">
                  Create a SKILL.md file with your research methodology.
                  Every time someone uses your model, you earn 70% of the analysis fee.
                  The best strategies rise to the top.
                </p>
                <StaggerContainer className="space-y-4 mb-8" staggerDelay={0.1}>
                  <StaggerItem><RevenueStep label="User pays 1 MON for analysis" /></StaggerItem>
                  <StaggerItem><RevenueStep label="70% goes to model creator" highlight /></StaggerItem>
                  <StaggerItem><RevenueStep label="10% to platform treasury" /></StaggerItem>
                  <StaggerItem><RevenueStep label="20% auto-buyback $MALPHA token" /></StaggerItem>
                </StaggerContainer>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    href="/create"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-accent-green/10 hover:bg-accent-green/20 text-accent-green-light border border-accent-green/20 hover:border-accent-green/40 rounded-xl transition-all font-medium"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Your SKILL.md
                  </Link>
                </motion.div>
              </div>
            </FadeIn>

            {/* Animated Code preview */}
            <FadeIn direction="right" delay={0.2}>
              <AnimatedCodeBlock />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Models preview */}
      <section id="models" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-xs text-accent-green-light uppercase tracking-widest mb-3 font-medium">Top Models</p>
              <h2 className="font-serif text-4xl sm:text-5xl mb-4">
                Proven <span className="italic">track records.</span>
              </h2>
              <p className="text-text-secondary max-w-xl mx-auto">
                Every model&apos;s accuracy is tracked on-chain. Transparent. Verifiable. Community-driven.
              </p>
            </div>
          </FadeIn>

          <StaggerContainer className="grid md:grid-cols-3 gap-5 mb-8" staggerDelay={0.12}>
            {[
              { rank: 1, name: "Rug Detector Pro", creator: "@SafeBoi", accuracy: 91.2, analyses: 456 },
              { rank: 2, name: "Whale Tracker v2", creator: "@CryptoWiz", accuracy: 82.5, analyses: 234 },
              { rank: 3, name: "Social Sniffer", creator: "@MemeKing", accuracy: 78.9, analyses: 198 },
            ].map((model) => (
              <StaggerItem key={model.rank}>
                <TiltCard intensity={7} glare>
                  <ModelPreview {...model} />
                </TiltCard>
              </StaggerItem>
            ))}
          </StaggerContainer>

          <FadeIn delay={0.5}>
            <div className="text-center">
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent-green-light transition-colors"
              >
                View all 47 models <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 radial-glow" />
        <div className="absolute inset-0 grid-pattern opacity-20" />
        <FadeIn>
          <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
            <h2 className="font-serif text-4xl sm:text-5xl mb-6 leading-tight">
              Stop guessing.
              <br />
              <span className="italic text-accent-green-light">Start researching.</span>
            </h2>
            <p className="text-text-secondary text-lg mb-10 max-w-xl mx-auto">
              Join the first community-powered research marketplace for Monad memecoins.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/analyze"
                  className="group px-8 py-3.5 bg-accent-green hover:bg-accent-green-light text-white font-medium rounded-xl transition-all glow-green flex items-center gap-2"
                >
                  Analyze a Token
                  <Zap className="w-4 h-4" />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/create"
                  className="px-8 py-3.5 bg-bg-secondary hover:bg-bg-tertiary text-text-primary font-medium rounded-xl border border-border hover:border-border-light transition-all"
                >
                  Become a Creator
                </Link>
              </motion.div>
            </div>
          </div>
        </FadeIn>
      </section>

      <Footer />
    </div>
  );
}

/* ---------- Sub-components ---------- */

function TimelineStep({ step, icon, title, description, detail, side, delay }: { step: string; icon: React.ReactNode; title: string; description: string; detail: string; side: "left" | "right"; delay: number }) {
  const isRight = side === "right";
  return (
    <div className={`relative flex items-start gap-6 md:gap-0 ${isRight ? "md:flex-row" : "md:flex-row-reverse"}`}>
      {/* Node on the line */}
      <div className="absolute left-6 md:left-1/2 -translate-x-1/2 z-10">
        <motion.div
          className="relative"
          initial={{ scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: delay + 0.3, duration: 0.5, type: "spring", stiffness: 200 }}
        >
          {/* Outer glow ring */}
          <motion.div
            className="absolute -inset-2 rounded-full bg-accent-green/20"
            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, delay: delay }}
          />
          {/* Node circle */}
          <div className="w-12 h-12 rounded-full bg-bg-primary border-2 border-accent-green/50 flex items-center justify-center text-accent-green-light shadow-[0_0_20px_rgba(74,155,114,0.15)]">
            {icon}
          </div>
        </motion.div>
      </div>

      {/* Content — offset from center */}
      <motion.div
        className={`pl-20 md:pl-0 md:w-1/2 ${isRight ? "md:pl-16 md:pr-0" : "md:pr-16 md:pl-0 md:text-right"}`}
        initial={{ opacity: 0, x: isRight ? 30 : -30 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ delay: delay + 0.4, duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
      >
        <div className={`flex items-center gap-3 mb-2 ${!isRight ? "md:justify-end" : ""}`}>
          <span className="text-[10px] font-mono text-accent-green/60 uppercase tracking-widest">Step {step}</span>
          <motion.div
            className="h-px flex-1 max-w-[60px] bg-gradient-to-r from-accent-green/30 to-transparent"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ delay: delay + 0.6, duration: 0.5 }}
            style={{ transformOrigin: isRight ? "left" : "right" }}
          />
        </div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-sm text-text-secondary leading-relaxed mb-3">{description}</p>
        <motion.div
          className={`inline-flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary/80 border border-border rounded-lg font-mono text-xs text-text-tertiary ${!isRight ? "md:ml-auto" : ""}`}
          whileHover={{ borderColor: "rgba(74,155,114,0.3)", color: "rgba(74,155,114,0.8)" }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-accent-green/50" />
          {detail}
        </motion.div>
      </motion.div>

      {/* Empty spacer for the other side on desktop */}
      <div className="hidden md:block md:w-1/2" />
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-5 bg-bg-secondary/60 border border-border rounded-2xl hover:border-border-light transition-all h-full">
      <motion.div
        className="w-10 h-10 rounded-xl bg-bg-tertiary border border-border flex items-center justify-center text-text-secondary mb-4"
        whileHover={{ scale: 1.15, rotate: -5, borderColor: "rgba(74,155,114,0.3)" }}
      >
        {icon}
      </motion.div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
    </div>
  );
}

function RevenueStep({ label, highlight = false }: { label: string; highlight?: boolean }) {
  return (
    <motion.div
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg ${highlight ? "bg-accent-green/10 border border-accent-green/20" : "bg-bg-secondary/50"}`}
      whileHover={{ x: 4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <motion.div
        className={`w-1.5 h-1.5 rounded-full ${highlight ? "bg-accent-green-light" : "bg-text-tertiary"}`}
        animate={highlight ? { scale: [1, 1.5, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <span className={`text-sm ${highlight ? "text-accent-green-light font-medium" : "text-text-secondary"}`}>{label}</span>
    </motion.div>
  );
}

function ModelPreview({ rank, name, creator, accuracy, analyses }: { rank: number; name: string; creator: string; accuracy: number; analyses: number }) {
  return (
    <div className="p-6 bg-bg-secondary border border-border rounded-2xl hover:border-accent-green/30 transition-all">
      <div className="flex items-center gap-3 mb-5">
        <motion.div
          className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono text-sm font-bold ${
            rank === 1 ? "bg-accent-yellow/15 text-accent-yellow border border-accent-yellow/20" :
            rank === 2 ? "bg-text-secondary/10 text-text-secondary border border-border" :
            "bg-amber-900/15 text-amber-600 border border-amber-900/20"
          }`}
          whileHover={{ scale: 1.15, rotate: 10 }}
        >
          #{rank}
        </motion.div>
        <div>
          <h3 className="font-medium">{name}</h3>
          <p className="text-xs text-text-tertiary font-mono">{creator}</p>
        </div>
      </div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-text-tertiary mb-0.5">Accuracy</p>
          <p className="text-xl font-bold font-mono text-accent-green-light blur-[5px] select-none">{accuracy}%</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-tertiary mb-0.5">Analyses</p>
          <p className="text-xl font-bold font-mono blur-[5px] select-none">{analyses}</p>
        </div>
      </div>
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Link
          href={`/analyze?model=${encodeURIComponent(name)}`}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-accent-green-light bg-accent-green/10 hover:bg-accent-green/20 border border-accent-green/20 rounded-xl transition-all"
        >
          Run Analysis <ArrowRight className="w-4 h-4" />
        </Link>
      </motion.div>
    </div>
  );
}

const MONA_CONTRACT = "0x261765ecB97ea10E0d7ECBcA6220D77fAc437777";

function ContractBadge() {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(MONA_CONTRACT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex justify-center mb-10">
      <motion.div
        className="inline-flex items-center gap-3 px-5 py-3 bg-bg-secondary/80 border border-border rounded-xl backdrop-blur-sm"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.3, duration: 0.5 }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-accent-green-light uppercase tracking-wider">$MALPHA</span>
          <span className="text-[10px] text-text-tertiary px-1.5 py-0.5 bg-bg-tertiary rounded">CA</span>
        </div>
        <span className="text-xs font-mono text-text-secondary hidden sm:inline">
          {MONA_CONTRACT.slice(0, 6)}...{MONA_CONTRACT.slice(-4)}
        </span>
        <span className="text-xs font-mono text-text-secondary sm:hidden">
          {MONA_CONTRACT.slice(0, 6)}...{MONA_CONTRACT.slice(-4)}
        </span>
        <motion.button
          onClick={copyAddress}
          className="p-1.5 rounded-lg bg-bg-tertiary hover:bg-accent-green/10 border border-border hover:border-accent-green/30 transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="Copy contract address"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-accent-green-light" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-text-tertiary" />
          )}
        </motion.button>
        <a
          href={`https://testnet.monadexplorer.com/token/${MONA_CONTRACT}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg bg-bg-tertiary hover:bg-accent-green/10 border border-border hover:border-accent-green/30 transition-colors"
          title="View on explorer"
        >
          <ExternalLink className="w-3.5 h-3.5 text-text-tertiary" />
        </a>
      </motion.div>
    </div>
  );
}

/* Animated SKILL.md code block with typing effect */
function AnimatedCodeBlock() {
  const lines = [
    { text: "# Whale Tracker v2", color: "text-text-primary", bold: true },
    { text: "", color: "" },
    { text: "## Type", color: "text-accent-green-light" },
    { text: "RESEARCH", color: "text-text-secondary" },
    { text: "", color: "" },
    { text: "## Data Sources", color: "text-accent-green-light" },
    { text: "- On-chain holder distribution", color: "text-text-secondary" },
    { text: "- Liquidity metrics", color: "text-text-secondary" },
    { text: "- Creator wallet history", color: "text-text-secondary" },
    { text: "- Trading patterns", color: "text-text-secondary" },
    { text: "", color: "" },
    { text: "## Scoring Breakdown", color: "text-accent-green-light" },
    { text: "Holder Distribution: 40 points", color: "text-text-secondary" },
    { text: "Liquidity Depth:     30 points", color: "text-text-secondary" },
    { text: "Creator Trust:       20 points", color: "text-text-secondary" },
    { text: "Trading Health:      10 points", color: "text-text-secondary" },
    { text: "", color: "" },
    { text: "## Signal Logic", color: "text-accent-green-light" },
    { text: "- BUY:   Total score > 75", color: "text-accent-green-light" },
    { text: "- WATCH: Total score 50-75", color: "text-accent-yellow" },
    { text: "- AVOID: Total score < 50", color: "text-accent-red" },
  ];

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-bg-tertiary/50">
        <div className="flex gap-1.5">
          <motion.div className="w-3 h-3 rounded-full bg-accent-red/50" whileHover={{ scale: 1.3 }} />
          <motion.div className="w-3 h-3 rounded-full bg-accent-yellow/50" whileHover={{ scale: 1.3 }} />
          <motion.div className="w-3 h-3 rounded-full bg-accent-green/50" whileHover={{ scale: 1.3 }} />
        </div>
        <span className="text-xs text-text-tertiary font-mono ml-2">whale-tracker/SKILL.md</span>
        <motion.div
          className="ml-auto w-2 h-2 rounded-full bg-accent-green"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      </div>
      <div className="p-5 font-mono text-sm leading-relaxed overflow-x-auto">
        {lines.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.06, duration: 0.3 }}
            className={`${line.color} ${line.bold ? "font-bold text-base" : ""}`}
          >
            {line.text || "\u00A0"}
          </motion.div>
        ))}
        <motion.span
          className="inline-block w-2 h-4 bg-accent-green-light ml-0.5"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      </div>
    </div>
  );
}
