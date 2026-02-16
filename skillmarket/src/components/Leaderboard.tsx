"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, TrendingUp, Coins, ChevronUp, ChevronDown, Minus } from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  creator: string;
  accuracy: number;
  usage: number;
  signalDistribution: { BUY: number; WATCH: number; AVOID: number };
  trend: "up" | "down" | "stable";
}

export default function Leaderboard({ limit = 5 }: { limit?: number }) {
  const [data, setData] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((res) => {
        const entries: LeaderboardEntry[] = (res.leaderboard || [])
          .slice(0, limit)
          .map((e: LeaderboardEntry) => ({
            ...e,
            trend: e.trend || "stable",
          }));
        setData(entries);
      })
      .catch(() => {});
  }, [limit]);

  if (data.length === 0) {
    return (
      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Trophy className="w-4 h-4 text-accent-yellow" />
          <h3 className="text-sm font-semibold">Top Performing Models</h3>
        </div>
        <div className="px-5 py-8 text-center text-xs text-text-tertiary">
          No model data yet. Run analyses to populate the leaderboard.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-accent-yellow" />
          <h3 className="text-sm font-semibold">Top Performing Models</h3>
        </div>
        <span className="text-xs text-text-tertiary">Avg score</span>
      </div>

      <div className="divide-y divide-border">
        {data.map((entry, index) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.06, duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
            whileHover={{ x: 4 }}
            className="px-5 py-3.5 flex items-center gap-4 hover:bg-bg-tertiary/30 transition-colors cursor-pointer"
          >
            <span className={`w-7 text-center font-mono text-sm font-bold ${
              entry.rank === 1 ? "text-accent-yellow" :
              entry.rank === 2 ? "text-text-secondary" :
              entry.rank === 3 ? "text-amber-700" : "text-text-tertiary"
            }`}>
              {entry.rank}
            </span>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{entry.name}</p>
              <p className="text-xs text-text-tertiary font-mono">{entry.creator}</p>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-text-tertiary">
              <TrendingUp className="w-3 h-3" />
              <span className="font-mono">{entry.usage}</span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-text-tertiary">
              <Coins className="w-3 h-3" />
              <span className="font-mono">
                {entry.signalDistribution.BUY}B/{entry.signalDistribution.WATCH}W/{entry.signalDistribution.AVOID}A
              </span>
            </div>

            <div className={`w-16 text-right font-mono text-sm font-semibold ${
              entry.accuracy >= 70 ? "text-accent-green-light" :
              entry.accuracy >= 45 ? "text-accent-yellow" : "text-accent-red"
            }`}>
              {entry.accuracy.toFixed(1)}
            </div>

            <div className="w-5">
              {entry.trend === "up" && <ChevronUp className="w-4 h-4 text-accent-green-light" />}
              {entry.trend === "down" && <ChevronDown className="w-4 h-4 text-accent-red" />}
              {entry.trend === "stable" && <Minus className="w-4 h-4 text-text-tertiary" />}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
