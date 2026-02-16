import { TrendingUp, Users, Coins, Star, ArrowUpRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

interface ModelCardProps {
  name: string;
  creator: string;
  accuracy: number;
  usage: number;
  revenue: number;
  price: number;
  rank?: number;
  description?: string;
  isBuiltIn?: boolean;
  isAIPowered?: boolean;
}

export default function ModelCard({
  name,
  creator,
  accuracy,
  usage,
  revenue,
  price,
  rank,
  description,
  isBuiltIn,
  isAIPowered,
}: ModelCardProps) {
  const accuracyColor =
    accuracy >= 85 ? "text-accent-green-light" : accuracy >= 70 ? "text-accent-yellow" : "text-accent-red";

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="group p-5 bg-bg-secondary border border-border rounded-2xl hover:border-accent-green/30 transition-all hover:glow-green-subtle"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center text-accent-green-light font-mono text-sm font-bold">
            {rank ? `#${rank}` : name.charAt(0)}
          </div>
          <div>
            <h3 className="font-medium text-text-primary group-hover:text-white transition-colors">{name}</h3>
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-text-tertiary font-mono">{creator === "monAlpha" ? "Platform" : creator.length > 12 ? `${creator.slice(0, 6)}...${creator.slice(-4)}` : creator}</p>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isBuiltIn ? "bg-accent-green/10 text-accent-green-light border border-accent-green/20" : "bg-purple-500/10 text-purple-400 border border-purple-500/20"}`}>
                {isBuiltIn ? "Built-in" : "Community"}
              </span>
              {isAIPowered && (
                <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Sparkles className="w-2.5 h-2.5" />
                  AI
                </span>
              )}
            </div>
          </div>
        </div>
        <Link
          href={`/analyze?model=${encodeURIComponent(name)}`}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-bg-tertiary hover:bg-accent-green/20 transition-all"
        >
          <ArrowUpRight className="w-4 h-4 text-text-secondary" />
        </Link>
      </div>

      {description && (
        <p className="text-xs text-text-tertiary leading-relaxed mb-4 line-clamp-2">{description}</p>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Stat icon={TrendingUp} label="Accuracy" value={`${accuracy}%`} valueClass={accuracyColor} />
        <Stat icon={Users} label="Analyses" value={usage.toLocaleString()} />
        <Stat icon={Coins} label="Revenue" value={`${revenue} MON`} />
        <Stat icon={Star} label="Price" value={price > 0 ? `${price} MON` : "Free"} />
      </div>

      <button className="w-full py-2.5 text-sm font-medium text-accent-green-light bg-accent-green/10 hover:bg-accent-green/20 border border-accent-green/20 hover:border-accent-green/40 rounded-xl transition-all">
        Run Analysis
      </button>
    </motion.div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  valueClass = "text-text-primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-text-tertiary" />
      <div>
        <p className="text-[10px] text-text-tertiary uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-medium font-mono ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}
