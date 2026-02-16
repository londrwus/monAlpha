"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  dx: number;
  dy: number;
}

export default function ParticleField({ count = 40, interactive = true }: { count?: number; interactive?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const animRef = useRef<number>(0);

  useEffect(() => {
    const initial: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      speed: Math.random() * 0.02 + 0.005,
      opacity: Math.random() * 0.4 + 0.1,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
    }));
    setParticles(initial);

    const animate = () => {
      setParticles((prev) =>
        prev.map((p) => ({
          ...p,
          x: ((p.x + p.dx + 100) % 100),
          y: ((p.y + p.dy + 100) % 100),
        }))
      );
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [count]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || !interactive) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMouse({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="absolute inset-0 overflow-hidden pointer-events-auto"
      style={{ pointerEvents: interactive ? "auto" : "none" }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
        {/* Connection lines */}
        {particles.map((p1, i) =>
          particles.slice(i + 1).map((p2, j) => {
            const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
            if (dist > 12) return null;
            return (
              <line
                key={`${i}-${j}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="#3d7a5c"
                strokeOpacity={0.1 * (1 - dist / 12)}
                strokeWidth={0.1}
              />
            );
          })
        )}

        {/* Mouse connections */}
        {interactive && particles.map((p) => {
          const dist = Math.sqrt((p.x - mouse.x) ** 2 + (p.y - mouse.y) ** 2);
          if (dist > 15) return null;
          return (
            <line
              key={`mouse-${p.id}`}
              x1={mouse.x}
              y1={mouse.y}
              x2={p.x}
              y2={p.y}
              stroke="#4a9b72"
              strokeOpacity={0.3 * (1 - dist / 15)}
              strokeWidth={0.15}
            />
          );
        })}

        {/* Particles */}
        {particles.map((p) => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={p.size * 0.3}
            fill="#4a9b72"
            opacity={p.opacity}
          />
        ))}
      </svg>
    </div>
  );
}
