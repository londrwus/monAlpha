"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { BarChart3, Coins, TrendingUp, Users, Eye, Loader2 } from "lucide-react";
import MetricCard from "@/components/MetricCard";
import MiniChart from "@/components/MiniChart";

interface AnalyticsData {
  wallet: string;
  totalRevenue: number;
  totalAnalyses: number;
  avgScore: number;
  rank: number | null;
  signalDistribution: { BUY: number; WATCH: number; AVOID: number };
  dailyUsage: number[];
  dailyRevenue: number[];
  models: Array<{
    id: string;
    name: string;
    isBuiltIn: boolean;
    price: number;
    usageCount: number;
    avgScore: number;
    revenue: number;
  }>;
  recentAnalyses: Array<{
    tokenName: string;
    tokenSymbol: string;
    signal: string;
    score: number;
    modelName: string;
    timestamp: number;
  }>;
}

export default function AnalyticsPage() {
  const { address, isConnected } = useAccount();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }
    fetch(`/api/analytics?wallet=${address}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (!isConnected || !address) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-text-tertiary">Connect your wallet to view analytics.</p>
      </div>
    );
  }

  if (!data || (data.totalAnalyses === 0 && data.models.length === 0)) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">My Analytics</h1>
          <p className="text-sm text-text-tertiary">Track your model&apos;s performance and revenue</p>
        </div>
        <div className="text-center py-16 bg-bg-secondary border border-border rounded-2xl">
          <BarChart3 className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
          <p className="text-text-secondary mb-1">No analytics yet</p>
          <p className="text-xs text-text-tertiary">Create a model or run analyses to see data here.</p>
        </div>
      </div>
    );
  }

  const latestDailyUsage = data.dailyUsage[data.dailyUsage.length - 1] || 0;
  const latestDailyRev = data.dailyRevenue[data.dailyRevenue.length - 1] || 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">My Analytics</h1>
        <p className="text-sm text-text-tertiary">Track your model&apos;s performance and revenue</p>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue"
          value={`${data.totalRevenue} MON`}
          change=""
          changeType="positive"
          icon={<Coins className="w-4 h-4" />}
          subtitle="Your 70% cut"
        />
        <MetricCard
          title="Total Analyses"
          value={String(data.totalAnalyses)}
          change={latestDailyUsage > 0 ? `+${latestDailyUsage}` : ""}
          changeType="positive"
          icon={<Users className="w-4 h-4" />}
          subtitle={`Today: ${latestDailyUsage}`}
        />
        <MetricCard
          title="Avg Score"
          value={`${data.avgScore}`}
          change=""
          changeType="positive"
          icon={<TrendingUp className="w-4 h-4" />}
          subtitle="Across all models"
        />
        <MetricCard
          title="Marketplace Rank"
          value={data.rank ? `#${data.rank}` : "—"}
          change=""
          changeType="positive"
          icon={<BarChart3 className="w-4 h-4" />}
          subtitle={data.models.length > 0 ? `${data.models.length} model(s)` : "No models"}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Revenue (MON)</h3>
            <span className="text-xs text-text-tertiary">Last 15 days</span>
          </div>
          <div className="flex items-end gap-1 mb-3">
            <span className="text-2xl font-bold font-mono">{latestDailyRev.toFixed(1)}</span>
            <span className="text-sm text-text-tertiary font-mono mb-0.5">MON/day</span>
          </div>
          <MiniChart data={data.dailyRevenue} color="#4a9b72" height={80} />
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Usage (Analyses)</h3>
            <span className="text-xs text-text-tertiary">Last 15 days</span>
          </div>
          <div className="flex items-end gap-1 mb-3">
            <span className="text-2xl font-bold font-mono">{latestDailyUsage}</span>
            <span className="text-sm text-text-tertiary font-mono mb-0.5">/day</span>
          </div>
          <MiniChart data={data.dailyUsage} color="#4a9b72" height={80} />
        </div>
      </div>

      {/* Model Cards */}
      {data.models.length > 0 && (
        <div className="space-y-4">
          {data.models.map((model) => (
            <div key={model.id} className="bg-bg-secondary border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center text-accent-green-light font-mono text-sm font-bold">
                    {model.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-medium">{model.name}</h3>
                    <p className="text-xs text-text-tertiary font-mono">
                      {model.isBuiltIn ? "Built-in" : "Community"} &middot; {model.price > 0 ? `${model.price} MON` : "Free"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-3 bg-bg-tertiary rounded-xl">
                  <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Revenue</p>
                  <p className="text-lg font-bold font-mono">{model.revenue} MON</p>
                </div>
                <div className="p-3 bg-bg-tertiary rounded-xl">
                  <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Analyses</p>
                  <p className="text-lg font-bold font-mono">{model.usageCount}</p>
                </div>
                <div className="p-3 bg-bg-tertiary rounded-xl">
                  <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Avg Score</p>
                  <p className="text-lg font-bold font-mono text-accent-green-light">{model.avgScore}</p>
                </div>
                <div className="p-3 bg-bg-tertiary rounded-xl">
                  <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Price</p>
                  <p className="text-lg font-bold font-mono">{model.price > 0 ? `${model.price} MON` : "Free"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Analyses */}
      {data.recentAnalyses.length > 0 && (
        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Eye className="w-4 h-4 text-text-tertiary" />
              Recent Analyses
            </h3>
          </div>
          <div className="divide-y divide-border/50">
            {data.recentAnalyses.map((item, i) => {
              const ago = getTimeAgo(item.timestamp);
              return (
                <div key={i} className="px-5 py-3 flex items-center gap-4 hover:bg-bg-tertiary/30 transition-colors">
                  <span className="text-sm font-mono font-medium w-20 truncate">${item.tokenSymbol}</span>
                  <span className={`text-xs font-semibold w-14 ${
                    item.signal === "BUY" ? "text-accent-green-light" :
                    item.signal === "AVOID" ? "text-accent-red" : "text-accent-yellow"
                  }`}>{item.signal}</span>
                  <span className="text-sm font-mono text-text-secondary">{item.score}/100</span>
                  <span className="text-xs text-text-tertiary">{item.modelName}</span>
                  <span className="text-xs text-text-tertiary ml-auto">{ago}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
