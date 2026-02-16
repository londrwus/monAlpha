"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Coins, Users, TrendingUp, Shield, Eye, AlertTriangle, Clock } from "lucide-react";
import MetricCard from "@/components/MetricCard";
import Leaderboard from "@/components/Leaderboard";
import LiveFeed from "@/components/LiveFeed";
import FadeIn from "@/components/animations/FadeIn";
import { StaggerContainer, StaggerItem } from "@/components/animations/StaggerContainer";
import AnimatedCounter from "@/components/animations/AnimatedCounter";
import ScoreGauge from "@/components/interactive/ScoreGauge";

interface DashboardData {
  totalAnalyses: number;
  avgScore: number;
  modelCount: number;
  signalDistribution: { BUY: number; WATCH: number; AVOID: number };
  recentAlerts: Array<{
    type: "danger" | "warning" | "info";
    message: string;
    model: string;
    time: string;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    totalAnalyses: 0,
    avgScore: 0,
    modelCount: 0,
    signalDistribution: { BUY: 0, WATCH: 0, AVOID: 0 },
    recentAlerts: [],
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [recentRes, skillsRes] = await Promise.all([
          fetch("/api/analyses/recent?limit=50"),
          fetch("/api/skills"),
        ]);
        const recentData = await recentRes.json();
        const skillsData = await skillsRes.json();

        const analyses = recentData.analyses || [];
        const totalCount = recentData.total || 0;
        const avgScore = recentData.avgScore || 0;
        const dist = recentData.signalDistribution || { BUY: 0, WATCH: 0, AVOID: 0 };
        const modelCount = (skillsData.skills || []).length;

        // Build alerts from recent analyses with notable scores
        const alerts = analyses.slice(0, 5).map(
          (a: { signal: string; score: number; modelName: string; tokenSymbol: string; tokenAddress: string; timestamp: number }) => {
            const ago = Math.floor((Date.now() - a.timestamp) / 1000);
            const timeStr = ago < 60 ? "just now" : ago < 3600 ? `${Math.floor(ago / 60)}m ago` : `${Math.floor(ago / 3600)}h ago`;
            return {
              type: a.signal === "AVOID" ? "danger" as const : a.signal === "WATCH" ? "warning" as const : "info" as const,
              message: `$${a.tokenSymbol} (${a.tokenAddress.slice(0, 6)}...${a.tokenAddress.slice(-4)}) scored ${a.score}/100 — ${a.signal}`,
              model: a.modelName,
              time: timeStr,
            };
          }
        );

        setData({
          totalAnalyses: totalCount,
          avgScore,
          modelCount,
          signalDistribution: dist,
          recentAlerts: alerts,
        });
      } catch {
        // keep defaults
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const totalSignals = data.signalDistribution.BUY + data.signalDistribution.WATCH + data.signalDistribution.AVOID;
  const buyPct = totalSignals > 0 ? Math.round((data.signalDistribution.BUY / totalSignals) * 100) : 0;
  const watchPct = totalSignals > 0 ? Math.round((data.signalDistribution.WATCH / totalSignals) * 100) : 0;
  const avoidPct = totalSignals > 0 ? Math.round((data.signalDistribution.AVOID / totalSignals) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <FadeIn duration={0.4}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Dashboard</h1>
            <p className="text-sm text-text-tertiary">Real-time overview of the monAlpha ecosystem</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-secondary rounded-lg border border-border">
              <Clock className="w-3.5 h-3.5 text-text-tertiary" />
              <span className="text-xs text-text-secondary font-mono">Live</span>
            </div>
            <motion.div
              className="flex items-center gap-2 px-3 py-1.5 bg-accent-green/10 rounded-lg border border-accent-green/20"
              animate={{ borderColor: ["rgba(74,155,114,0.2)", "rgba(74,155,114,0.5)", "rgba(74,155,114,0.2)"] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <motion.div
                className="w-2 h-2 rounded-full bg-accent-green"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-xs text-accent-green-light font-medium">System Online</span>
            </motion.div>
          </div>
        </div>
      </FadeIn>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Analyses"
          value={data.totalAnalyses.toLocaleString()}
          change={data.totalAnalyses > 0 ? "active" : "—"}
          changeType="positive"
          icon={<Activity className="w-4 h-4" />}
          subtitle={`${data.modelCount} models`}
        />
        <MetricCard
          title="Avg Score"
          value={data.avgScore > 0 ? data.avgScore.toFixed(1) : "—"}
          change={data.avgScore >= 70 ? "Good" : data.avgScore >= 45 ? "Fair" : data.avgScore > 0 ? "Low" : "—"}
          changeType={data.avgScore >= 45 ? "positive" : "negative"}
          icon={<TrendingUp className="w-4 h-4" />}
          subtitle="All-time average"
        />
        <MetricCard
          title="BUY Signals"
          value={String(data.signalDistribution.BUY)}
          change={buyPct > 0 ? `${buyPct}%` : "—"}
          changeType="positive"
          icon={<Coins className="w-4 h-4" />}
          subtitle={`${data.signalDistribution.AVOID} AVOID signals`}
        />
        <MetricCard
          title="Active Models"
          value={String(data.modelCount)}
          change={data.modelCount > 0 ? "live" : "—"}
          changeType="positive"
          icon={<Users className="w-4 h-4" />}
          subtitle="Rule-based scoring"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FadeIn delay={0.1} direction="left">
          <LiveFeed blurScores={false} />
        </FadeIn>
        <FadeIn delay={0.2} direction="right">
          <Leaderboard limit={5} />
        </FadeIn>
      </div>

      {/* Signal Distribution + Platform Health Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <StaggerContainer className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4" staggerDelay={0.1}>
          <StaggerItem>
            <SignalStat signal="BUY" count={data.signalDistribution.BUY} percent={buyPct} icon={<TrendingUp className="w-5 h-5" />} colorClass="text-accent-green-light" barColor="bg-accent-green-light" />
          </StaggerItem>
          <StaggerItem>
            <SignalStat signal="WATCH" count={data.signalDistribution.WATCH} percent={watchPct} icon={<Eye className="w-5 h-5" />} colorClass="text-accent-yellow" barColor="bg-accent-yellow" />
          </StaggerItem>
          <StaggerItem>
            <SignalStat signal="AVOID" count={data.signalDistribution.AVOID} percent={avoidPct} icon={<Shield className="w-5 h-5" />} colorClass="text-accent-red" barColor="bg-accent-red" />
          </StaggerItem>
        </StaggerContainer>

        <FadeIn delay={0.3}>
          <div className="p-5 bg-bg-secondary border border-border rounded-2xl flex flex-col items-center justify-center">
            <p className="text-xs text-text-tertiary uppercase tracking-wider mb-2">Platform Health</p>
            <ScoreGauge score={data.avgScore > 0 ? Math.round(data.avgScore) : 0} size={120} label="Health" />
          </div>
        </FadeIn>
      </div>

      {/* Recent Alerts */}
      {data.recentAlerts.length > 0 && (
        <FadeIn delay={0.2}>
          <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                >
                  <AlertTriangle className="w-4 h-4 text-accent-yellow" />
                </motion.div>
                <h3 className="text-sm font-semibold">Recent Alerts</h3>
              </div>
              <span className="text-xs text-text-tertiary">From analyses</span>
            </div>
            <div className="divide-y divide-border/50">
              {data.recentAlerts.map((alert, i) => (
                <AlertRow key={i} {...alert} index={i} />
              ))}
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  );
}

function SignalStat({ signal, count, percent, icon, colorClass, barColor }: { signal: string; count: number; percent: number; icon: React.ReactNode; colorClass: string; barColor: string }) {
  return (
    <motion.div
      className="p-5 bg-bg-secondary border border-border rounded-2xl hover:border-border-light transition-colors"
      whileHover={{ y: -2 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`flex items-center gap-2 ${colorClass}`}>
          {icon}
          <span className="text-sm font-semibold">{signal}</span>
        </div>
        <span className="text-xs text-text-tertiary">all-time</span>
      </div>
      <div className="flex items-end gap-2 mb-3">
        <span className="text-2xl font-bold font-mono">
          <AnimatedCounter value={count} duration={1.5} />
        </span>
        <span className="text-sm text-text-tertiary mb-0.5">signals</span>
      </div>
      <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
        />
      </div>
      <p className="text-xs text-text-tertiary mt-1.5">{percent}% of all signals</p>
    </motion.div>
  );
}

function AlertRow({ type, message, model, time, index }: { type: "danger" | "warning" | "info"; message: string; model: string; time: string; index: number }) {
  return (
    <motion.div
      className="px-5 py-3 flex items-center gap-3 hover:bg-bg-tertiary/30 transition-colors cursor-pointer"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
      whileHover={{ x: 4 }}
    >
      <motion.div
        className={`w-2 h-2 rounded-full ${type === "danger" ? "bg-accent-red" : type === "warning" ? "bg-accent-yellow" : "bg-accent-green"}`}
        animate={type === "danger" ? { scale: [1, 1.4, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary truncate">{message}</p>
        <p className="text-xs text-text-tertiary">{model}</p>
      </div>
      <span className="text-xs text-text-tertiary shrink-0">{time}</span>
    </motion.div>
  );
}
