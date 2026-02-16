"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

interface ScoreGaugeProps {
  score: number;
  size?: number;
  label?: string;
  animated?: boolean;
}

export default function ScoreGauge({ score, size = 180, label = "Score", animated = true }: ScoreGaugeProps) {
  const [isVisible, setIsVisible] = useState(false);
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const startAngle = 135;
  const totalAngle = 270;

  const spring = useSpring(0, { stiffness: 40, damping: 15 });
  const dashOffset = useTransform(spring, (v) => {
    const progress = v / 100;
    const arcLength = (totalAngle / 360) * circumference;
    return arcLength - progress * arcLength;
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
      if (animated) spring.set(score);
    }, 300);
    return () => clearTimeout(timer);
  }, [score, animated, spring]);

  const color = score >= 75 ? "#4a9b72" : score >= 50 ? "#e6a73c" : "#d64545";
  const signal = score >= 75 ? "BUY" : score >= 50 ? "WATCH" : "AVOID";
  const arcLength = (totalAngle / 360) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="transform -rotate-[135deg]">
        {/* Background arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1a2030"
          strokeWidth={8}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round"
        />
        {/* Score arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const angle = startAngle + (tick / 100) * totalAngle;
          const rad = (angle * Math.PI) / 180;
          const innerR = radius - 12;
          const outerR = radius - 6;
          return (
            <line
              key={tick}
              x1={size / 2 + innerR * Math.cos(rad)}
              y1={size / 2 + innerR * Math.sin(rad)}
              x2={size / 2 + outerR * Math.cos(rad)}
              y2={size / 2 + outerR * Math.sin(rad)}
              stroke="#2a3444"
              strokeWidth={1.5}
              strokeLinecap="round"
              transform={`rotate(135, ${size / 2}, ${size / 2})`}
            />
          );
        })}
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-bold font-mono blur-[6px] select-none"
          style={{ color }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={isVisible ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: 0.5, type: "spring", stiffness: 100 }}
        >
          {score}
        </motion.span>
        <motion.span
          className="text-[10px] text-text-tertiary uppercase tracking-widest mt-0.5"
          initial={{ opacity: 0 }}
          animate={isVisible ? { opacity: 1 } : {}}
          transition={{ delay: 0.7 }}
        >
          {label}
        </motion.span>
        <motion.span
          className="text-xs font-bold mt-1"
          style={{ color }}
          initial={{ opacity: 0, y: 5 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.9 }}
        >
          {signal}
        </motion.span>
      </div>
    </div>
  );
}
