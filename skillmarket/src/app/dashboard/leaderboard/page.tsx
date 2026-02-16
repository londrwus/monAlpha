"use client";

import { useEffect, useState } from "react";
import { Trophy, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";

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

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totalAnalyses, setTotalAnalyses] = useState(0);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((data) => {
        setLeaderboard(
          (data.leaderboard || []).map((e: LeaderboardEntry) => ({
            ...e,
            trend: e.trend || "stable",
          }))
        );
        setTotalAnalyses(data.totalAnalyses || 0);
      })
      .catch(() => {});
  }, []);

  if (leaderboard.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Leaderboard</h1>
          <p className="text-sm text-text-tertiary">Top performing research models</p>
        </div>
        <div className="text-center py-16 text-sm text-text-tertiary">
          No model data yet. Run analyses to populate the leaderboard.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Leaderboard</h1>
          <p className="text-sm text-text-tertiary">Top performing research models ranked by average score</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-secondary rounded-lg border border-border">
          <BarChart3 className="w-3.5 h-3.5 text-text-tertiary" />
          <span className="text-xs text-text-secondary font-mono">{totalAnalyses} total analyses</span>
        </div>
      </div>

      {/* Podium */}
      <div className="grid grid-cols-3 gap-4">
        {leaderboard.slice(0, 3).map((entry) => (
          <div
            key={entry.id}
            className={`p-5 bg-bg-secondary border rounded-2xl text-center ${
              entry.rank === 1 ? "border-accent-yellow/30 glow-green-subtle" : "border-border"
            }`}
          >
            <div className={`w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center font-mono text-lg font-bold ${
              entry.rank === 1 ? "bg-accent-yellow/15 text-accent-yellow border border-accent-yellow/20" :
              entry.rank === 2 ? "bg-text-secondary/10 text-text-secondary border border-border" :
              "bg-amber-900/15 text-amber-600 border border-amber-900/20"
            }`}>
              #{entry.rank}
            </div>
            <h3 className="font-medium mb-0.5">{entry.name}</h3>
            <p className="text-xs text-text-tertiary font-mono mb-3">{entry.creator}</p>
            <p className={`text-3xl font-bold font-mono mb-1 ${
              entry.accuracy >= 70 ? "text-accent-green-light" :
              entry.accuracy >= 45 ? "text-accent-yellow" : "text-accent-red"
            }`}>
              {entry.accuracy.toFixed(1)}
            </p>
            <p className="text-xs text-text-tertiary">
              {entry.usage} analyses &middot; {entry.signalDistribution.BUY}B/{entry.signalDistribution.WATCH}W/{entry.signalDistribution.AVOID}A
            </p>
          </div>
        ))}
      </div>

      {/* Full Table */}
      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[60px_1fr_100px_100px_150px_60px] gap-4 px-5 py-3 border-b border-border text-xs text-text-tertiary uppercase tracking-wider">
          <span>Rank</span>
          <span>Model</span>
          <span className="text-right">Avg Score</span>
          <span className="text-right">Analyses</span>
          <span className="text-right">Signal Distribution</span>
          <span className="text-right">Trend</span>
        </div>
        {leaderboard.map((entry) => (
          <div
            key={entry.id}
            className="grid grid-cols-[60px_1fr_100px_100px_150px_60px] gap-4 px-5 py-4 border-b border-border/50 hover:bg-bg-tertiary/30 transition-colors items-center"
          >
            <span className={`font-mono font-bold ${
              entry.rank <= 3 ? "text-accent-yellow" : "text-text-tertiary"
            }`}>
              #{entry.rank}
            </span>
            <div>
              <p className="text-sm font-medium">{entry.name}</p>
              <p className="text-xs text-text-tertiary font-mono">{entry.creator}</p>
            </div>
            <span className={`text-right text-sm font-mono font-semibold ${
              entry.accuracy >= 70 ? "text-accent-green-light" :
              entry.accuracy >= 45 ? "text-accent-yellow" : "text-text-secondary"
            }`}>
              {entry.accuracy.toFixed(1)}
            </span>
            <span className="text-right text-sm font-mono text-text-secondary">{entry.usage}</span>
            <span className="text-right text-xs font-mono text-text-tertiary">
              {entry.signalDistribution.BUY} BUY / {entry.signalDistribution.WATCH} WATCH / {entry.signalDistribution.AVOID} AVOID
            </span>
            <div className="flex justify-end">
              {entry.trend === "up" && <TrendingUp className="w-4 h-4 text-accent-green-light" />}
              {entry.trend === "down" && <TrendingDown className="w-4 h-4 text-accent-red" />}
              {entry.trend === "stable" && <Minus className="w-4 h-4 text-text-tertiary" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
