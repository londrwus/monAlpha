"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useId } from "react";

export default function MiniChart({ data, color = "#4a9b72", height = 40 }: { data: number[]; color?: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const isInView = useInView(ref, { once: true });
  const uniqueId = useId();
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 120;
  const padding = 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");

  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  // Build SVG path from points for animation
  const pathD = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");

  const gradId = `grad-${uniqueId.replace(/:/g, "")}`;

  return (
    <svg ref={ref} viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <motion.polygon
        points={areaPoints}
        fill={`url(#${gradId})`}
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 1, delay: 0.3 }}
      />

      {/* Line with draw animation */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={isInView ? { pathLength: 1, opacity: 1 } : {}}
        transition={{ duration: 1.5, ease: "easeOut" }}
      />

      {/* Animated dot at end */}
      {isInView && (
        <motion.circle
          cx={padding + ((data.length - 1) / (data.length - 1)) * (width - padding * 2)}
          cy={height - padding - ((data[data.length - 1] - min) / range) * (height - padding * 2)}
          r={2}
          fill={color}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.5, 1], opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.4 }}
        />
      )}

      {/* Glowing dot pulse */}
      {isInView && (
        <motion.circle
          cx={padding + ((data.length - 1) / (data.length - 1)) * (width - padding * 2)}
          cy={height - padding - ((data[data.length - 1] - min) / range) * (height - padding * 2)}
          r={2}
          fill="none"
          stroke={color}
          strokeWidth={0.5}
          initial={{ r: 2, opacity: 0 }}
          animate={{ r: [2, 5, 2], opacity: [0.6, 0, 0.6] }}
          transition={{ delay: 2, duration: 2, repeat: Infinity }}
        />
      )}
    </svg>
  );
}
