"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface Node {
  id: string;
  x: number;
  y: number;
  size: number;
  label: string;
  color: string;
  pulse: boolean;
}

interface Edge {
  from: string;
  to: string;
  strength: number;
}

const initialNodes: Node[] = [
  { id: "token", x: 50, y: 50, size: 20, label: "$TOKEN", color: "#4a9b72", pulse: true },
  { id: "whale1", x: 25, y: 25, size: 14, label: "Whale A", color: "#3d7a5c", pulse: false },
  { id: "whale2", x: 75, y: 30, size: 12, label: "Whale B", color: "#3d7a5c", pulse: false },
  { id: "dex", x: 20, y: 70, size: 16, label: "DEX Pool", color: "#4a9b72", pulse: true },
  { id: "creator", x: 80, y: 65, size: 10, label: "Creator", color: "#e6a73c", pulse: false },
  { id: "holder1", x: 35, y: 80, size: 8, label: "Holder", color: "#6b7280", pulse: false },
  { id: "holder2", x: 65, y: 85, size: 8, label: "Holder", color: "#6b7280", pulse: false },
  { id: "holder3", x: 15, y: 45, size: 7, label: "Holder", color: "#6b7280", pulse: false },
  { id: "holder4", x: 85, y: 45, size: 7, label: "Holder", color: "#6b7280", pulse: false },
  { id: "cex", x: 50, y: 15, size: 11, label: "CEX", color: "#9ca3af", pulse: false },
];

const edges: Edge[] = [
  { from: "token", to: "whale1", strength: 0.8 },
  { from: "token", to: "whale2", strength: 0.6 },
  { from: "token", to: "dex", strength: 0.9 },
  { from: "token", to: "creator", strength: 0.7 },
  { from: "token", to: "cex", strength: 0.4 },
  { from: "whale1", to: "holder3", strength: 0.3 },
  { from: "whale2", to: "holder4", strength: 0.3 },
  { from: "dex", to: "holder1", strength: 0.5 },
  { from: "dex", to: "holder2", strength: 0.5 },
  { from: "creator", to: "holder2", strength: 0.2 },
];

export default function NetworkGraph() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [nodes, setNodes] = useState(initialNodes);
  const containerRef = useRef<HTMLDivElement>(null);

  // Gentle floating animation
  useEffect(() => {
    const interval = setInterval(() => {
      setNodes((prev) =>
        prev.map((n) => ({
          ...n,
          x: n.x + (Math.random() - 0.5) * 0.3,
          y: n.y + (Math.random() - 0.5) * 0.3,
        }))
      );
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const getNodePos = (id: string) => {
    const node = nodes.find((n) => n.id === id);
    return node ? { x: node.x, y: node.y } : { x: 0, y: 0 };
  };

  return (
    <div ref={containerRef} className="relative w-full aspect-square max-w-md mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Edges */}
        {edges.map((edge, i) => {
          const from = getNodePos(edge.from);
          const to = getNodePos(edge.to);
          const isHighlighted = hoveredNode === edge.from || hoveredNode === edge.to;
          return (
            <motion.line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={isHighlighted ? "#4a9b72" : "#1f2937"}
              strokeWidth={isHighlighted ? 0.4 : 0.2}
              strokeOpacity={isHighlighted ? 0.8 : 0.4}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, delay: i * 0.1, ease: "easeOut" }}
            />
          );
        })}

        {/* Data packets traveling along edges */}
        {edges.slice(0, 5).map((edge, i) => {
          const from = getNodePos(edge.from);
          const to = getNodePos(edge.to);
          return (
            <motion.circle
              key={`packet-${i}`}
              r={0.5}
              fill="#4a9b72"
              opacity={0.7}
              animate={{
                cx: [from.x, to.x],
                cy: [from.y, to.y],
              }}
              transition={{
                duration: 2 + i * 0.5,
                delay: i * 1.5,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isHovered = hoveredNode === node.id;
          return (
            <g key={node.id}>
              {/* Pulse ring */}
              {node.pulse && (
                <motion.circle
                  cx={node.x}
                  cy={node.y}
                  r={node.size / 5}
                  fill="none"
                  stroke={node.color}
                  strokeWidth={0.2}
                  animate={{ r: [node.size / 5, node.size / 3], opacity: [0.6, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                />
              )}
              {/* Glow */}
              <motion.circle
                cx={node.x}
                cy={node.y}
                r={node.size / 5 + 1}
                fill={node.color}
                opacity={isHovered ? 0.2 : 0.08}
                animate={{ scale: isHovered ? 1.5 : 1 }}
              />
              {/* Node */}
              <motion.circle
                cx={node.x}
                cy={node.y}
                r={node.size / 5}
                fill={isHovered ? node.color : `${node.color}99`}
                stroke={node.color}
                strokeWidth={0.3}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: "pointer" }}
                whileHover={{ scale: 1.3 }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: Math.random() * 0.5, type: "spring" }}
              />
              {/* Label */}
              {(isHovered || node.id === "token") && (
                <motion.text
                  x={node.x}
                  y={node.y - node.size / 4 - 2}
                  textAnchor="middle"
                  fill="#e8eaed"
                  fontSize={2.5}
                  fontFamily="JetBrains Mono, monospace"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {node.label}
                </motion.text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex gap-3">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-accent-green-light" />
          <span className="text-[9px] text-text-tertiary">Token</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-accent-yellow" />
          <span className="text-[9px] text-text-tertiary">Creator</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-text-tertiary" />
          <span className="text-[9px] text-text-tertiary">Holder</span>
        </div>
      </div>
    </div>
  );
}
