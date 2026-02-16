"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, TrendingUp, Eye, Shield } from "lucide-react";

interface FeedItem {
  id: string;
  token: string;
  symbol: string;
  signal: "BUY" | "WATCH" | "AVOID";
  model: string;
  score: number;
  time: string;
}

const signalIcon = {
  BUY: TrendingUp,
  WATCH: Eye,
  AVOID: Shield,
};

const signalColor = {
  BUY: "text-accent-green-light",
  WATCH: "text-accent-yellow",
  AVOID: "text-accent-red",
};

const signalBg = {
  BUY: "bg-accent-green/10",
  WATCH: "bg-accent-yellow/10",
  AVOID: "bg-accent-red/10",
};

// Demo data shown on landing page when no real analyses exist
const DEMO_FEED: FeedItem[] = [
  { id: "demo-1", token: "0x35...7777", symbol: "$PEPE", signal: "BUY", model: "Whale Tracker v2", score: 78, time: "2m ago" },
  { id: "demo-2", token: "0x9d...7777", symbol: "$MONAD", signal: "WATCH", model: "Rug Detector Pro", score: 62, time: "5m ago" },
  { id: "demo-3", token: "0xd1...7777", symbol: "$XOX", signal: "BUY", model: "Social Sniffer", score: 81, time: "8m ago" },
  { id: "demo-4", token: "0x14...7777", symbol: "$DOGE", signal: "WATCH", model: "Whale Tracker v2", score: 55, time: "12m ago" },
  { id: "demo-5", token: "0xa7...3ace", symbol: "$NADS", signal: "BUY", model: "Rug Detector Pro", score: 85, time: "15m ago" },
];

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function LiveFeed({ blurScores = true }: { blurScores?: boolean }) {
  const [items, setItems] = useState<FeedItem[]>(DEMO_FEED);
  const [loading, setLoading] = useState(true);

  const fetchRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/analyses/recent?limit=8");
      const data = await res.json();
      if (data.analyses && data.analyses.length > 0) {
        const mapped: FeedItem[] = data.analyses.map(
          (a: {
            analysisId: string;
            tokenAddress: string;
            tokenSymbol: string;
            signal: "BUY" | "WATCH" | "AVOID";
            modelName: string;
            score: number;
            timestamp: number;
          }) => ({
            id: a.analysisId,
            token: `${String(a.tokenAddress).slice(0, 6)}...${String(a.tokenAddress).slice(-4)}`,
            symbol: `$${a.tokenSymbol}`,
            signal: a.signal,
            model: a.modelName,
            score: a.score,
            time: timeAgo(a.timestamp),
          })
        );
        setItems(mapped);
      }
      // If no real data, keep demo feed (initial state)
    } catch {
      // silently ignore — keep existing items
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecent();
    const interval = setInterval(fetchRecent, 10000);
    return () => clearInterval(interval);
  }, [fetchRecent]);

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          >
            <Activity className="w-4 h-4 text-accent-green-light" />
          </motion.div>
          <h3 className="text-sm font-semibold">Live Analysis Feed</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <motion.div
            className="w-2 h-2 rounded-full bg-accent-green"
            animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-xs text-text-tertiary">Live</span>
        </div>
      </div>

      <div className="divide-y divide-border/50">
        {loading && items.length === 0 && (
          <div className="px-5 py-8 text-center text-xs text-text-tertiary">
            Loading live feed...
          </div>
        )}
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const Icon = signalIcon[item.signal];
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                transition={{ duration: 0.35, ease: [0.25, 0.4, 0.25, 1] }}
                className="px-5 py-3 flex items-center gap-3 hover:bg-bg-tertiary/30 transition-colors cursor-pointer overflow-hidden"
              >
                <motion.div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${signalBg[item.signal]}`}
                  whileHover={{ scale: 1.15, rotate: 5 }}
                >
                  <Icon className={`w-4 h-4 ${signalColor[item.signal]}`} />
                </motion.div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.symbol}</span>
                    <motion.span
                      className={`text-xs font-semibold ${signalColor[item.signal]}`}
                      initial={{ scale: 1.2 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      {item.signal}
                    </motion.span>
                    <span className={`text-xs font-mono text-text-tertiary${blurScores ? " blur-[5px] select-none" : ""}`}>{item.score}/100</span>
                  </div>
                  <p className="text-xs text-text-tertiary truncate">{item.model}</p>
                </div>
                <span className="text-xs text-text-tertiary shrink-0">{item.time}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
