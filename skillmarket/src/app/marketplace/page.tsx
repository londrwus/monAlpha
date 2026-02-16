"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Grid3X3, List, TrendingUp, Shield, Eye } from "lucide-react";
import ModelCard from "@/components/ModelCard";

interface SkillModel {
  id: string;
  name: string;
  description: string;
  creator: string;
  version: string;
  usageCount: number;
  accuracy: number;
  signalDistribution: { BUY: number; WATCH: number; AVOID: number };
  lastUsed: number | null;
  isBuiltIn: boolean;
  price: number;
  createdAt: number;
}

type SortKey = "accuracy" | "usageCount" | "createdAt";
type ViewMode = "grid" | "list";

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("accuracy");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [models, setModels] = useState<SkillModel[]>([]);
  const [totalAnalyses, setTotalAnalyses] = useState(0);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((data) => {
        setModels(data.skills || []);
        setTotalAnalyses(
          (data.skills || []).reduce((s: number, m: SkillModel) => s + m.usageCount, 0)
        );
      })
      .catch(() => {});
  }, []);

  const filtered = models
    .filter(
      (m) =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.description.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "createdAt") return (b.createdAt || 0) - (a.createdAt || 0);
      return (b[sortBy] as number) - (a[sortBy] as number);
    });

  const avgAccuracy =
    models.length > 0
      ? models.reduce((s, m) => s + m.accuracy, 0) / models.length
      : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Marketplace</h1>
          <p className="text-sm text-text-tertiary">Browse and compare community research models</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary">{filtered.length} models</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search models..."
            className="w-full pl-10 pr-4 py-2.5 bg-bg-secondary border border-border rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-green/40 transition-all"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex items-center bg-bg-secondary border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setSortBy("accuracy")}
              className={`px-3 py-2 text-xs transition-colors ${sortBy === "accuracy" ? "bg-accent-green/10 text-accent-green-light" : "text-text-secondary hover:text-text-primary"}`}
            >
              Accuracy
            </button>
            <button
              onClick={() => setSortBy("usageCount")}
              className={`px-3 py-2 text-xs transition-colors ${sortBy === "usageCount" ? "bg-accent-green/10 text-accent-green-light" : "text-text-secondary hover:text-text-primary"}`}
            >
              Popular
            </button>
            <button
              onClick={() => setSortBy("createdAt")}
              className={`px-3 py-2 text-xs transition-colors ${sortBy === "createdAt" ? "bg-accent-green/10 text-accent-green-light" : "text-text-secondary hover:text-text-primary"}`}
            >
              Newest
            </button>
          </div>
          <div className="flex items-center bg-bg-secondary border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2.5 transition-colors ${viewMode === "grid" ? "bg-accent-green/10 text-accent-green-light" : "text-text-secondary"}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2.5 transition-colors ${viewMode === "list" ? "bg-accent-green/10 text-accent-green-light" : "text-text-secondary"}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: TrendingUp, label: "Avg Score", value: avgAccuracy > 0 ? avgAccuracy.toFixed(1) : "—" },
          { icon: Shield, label: "Models", value: String(models.length) },
          { icon: Eye, label: "Total Analyses", value: totalAnalyses.toLocaleString() },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35, ease: [0.25, 0.4, 0.25, 1] }}
            className="flex items-center gap-3 p-3 bg-bg-secondary border border-border rounded-xl"
          >
            <stat.icon className="w-4 h-4 text-accent-green-light" />
            <div>
              <p className="text-xs text-text-tertiary">{stat.label}</p>
              <p className="text-sm font-bold font-mono">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Models Grid */}
      {models.length === 0 ? (
        <div className="text-center py-12 text-sm text-text-tertiary">
          Loading models...
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((model, i) => (
            <motion.div
              key={model.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35, ease: [0.25, 0.4, 0.25, 1] }}
            >
            <ModelCard
              key={model.id}
              rank={i + 1}
              name={model.name}
              creator={model.creator}
              accuracy={model.accuracy}
              usage={model.usageCount}
              revenue={0}
              price={model.price}
              description={model.description}
              isBuiltIn={model.isBuiltIn}
            />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_80px_80px_100px_80px] gap-4 px-5 py-3 border-b border-border text-xs text-text-tertiary uppercase tracking-wider">
            <span>Model</span>
            <span className="text-right">Score</span>
            <span className="text-right">Uses</span>
            <span className="text-right">Price</span>
            <span className="text-right">Signals</span>
            <span className="text-right">Type</span>
          </div>
          {filtered.map((model, i) => (
            <motion.div
              key={model.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
              whileHover={{ x: 4 }}
              className="grid grid-cols-[1fr_80px_80px_80px_100px_80px] gap-4 px-5 py-4 border-b border-border/50 hover:bg-bg-tertiary/30 transition-colors items-center"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-mono text-text-tertiary w-5">#{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{model.name}</p>
                  <p className="text-xs text-text-tertiary font-mono">{model.creator === "monAlpha" ? "Platform" : `${model.creator.slice(0, 6)}...`}</p>
                </div>
              </div>
              <span className={`text-right text-sm font-mono font-semibold ${model.accuracy >= 70 ? "text-accent-green-light" : model.accuracy >= 45 ? "text-accent-yellow" : "text-accent-red"}`}>
                {model.accuracy.toFixed(1)}
              </span>
              <span className="text-right text-sm font-mono text-text-secondary">{model.usageCount}</span>
              <span className="text-right text-sm font-mono text-text-secondary">{model.price > 0 ? `${model.price} MON` : "Free"}</span>
              <span className="text-right text-xs font-mono text-text-tertiary">
                {model.signalDistribution.BUY}B / {model.signalDistribution.WATCH}W / {model.signalDistribution.AVOID}A
              </span>
              <span className="text-right">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${model.isBuiltIn ? "bg-accent-green/10 text-accent-green-light border border-accent-green/20" : "bg-purple-500/10 text-purple-400 border border-purple-500/20"}`}>
                  {model.isBuiltIn ? "Built-in" : "Community"}
                </span>
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
