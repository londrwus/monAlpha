"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
  subtitle?: string;
}

export default function MetricCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon,
  subtitle,
}: MetricCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  return (
    <motion.div
      ref={ref}
      className="p-5 bg-bg-secondary border border-border rounded-2xl hover:border-border-light transition-colors group cursor-default"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
      whileHover={{ y: -2, borderColor: "rgba(74,155,114,0.2)" }}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-text-tertiary uppercase tracking-wider">{title}</p>
        {icon && (
          <motion.div
            className="text-text-tertiary group-hover:text-accent-green-light transition-colors"
            whileHover={{ scale: 1.2, rotate: 10 }}
          >
            {icon}
          </motion.div>
        )}
      </div>
      <div className="flex items-end gap-2">
        <motion.span
          className="text-2xl font-bold font-mono"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {value}
        </motion.span>
        {change && (
          <motion.span
            className={`flex items-center gap-0.5 text-xs font-medium mb-0.5 ${
              changeType === "positive" ? "text-accent-green-light" :
              changeType === "negative" ? "text-accent-red" : "text-text-tertiary"
            }`}
            initial={{ opacity: 0, x: -10 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            {changeType === "positive" && <TrendingUp className="w-3 h-3" />}
            {changeType === "negative" && <TrendingDown className="w-3 h-3" />}
            {change}
          </motion.span>
        )}
      </div>
      {subtitle && (
        <motion.p
          className="text-xs text-text-tertiary mt-1"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          {subtitle}
        </motion.p>
      )}
    </motion.div>
  );
}
