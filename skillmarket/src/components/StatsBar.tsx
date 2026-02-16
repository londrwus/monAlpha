"use client";

import AnimatedCounter from "./animations/AnimatedCounter";
import { StaggerContainer, StaggerItem } from "./animations/StaggerContainer";

const stats = [
  { value: 89, label: "Avg Accuracy", suffix: "%", prefix: "", decimals: 0 },
  { value: 30, label: "Per Analysis", suffix: "s", prefix: "<", decimals: 0 },
  { value: 47, label: "Active Models", suffix: "", prefix: "", decimals: 0 },
  { value: 12.4, label: "Analyses Run", suffix: "K", prefix: "", decimals: 1 },
  { value: 2.1, label: "MON Distributed", suffix: "K", prefix: "", decimals: 1 },
];

export default function StatsBar() {
  return (
    <StaggerContainer className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 lg:gap-8" staggerDelay={0.12}>
      {stats.map((s, i) => (
        <StaggerItem key={i}>
          <div className="text-center group cursor-default">
            <div className="text-2xl sm:text-3xl font-bold font-mono text-text-primary">
              {s.prefix}
              <AnimatedCounter value={s.value} decimals={s.decimals} duration={2} />
              <span className="text-accent-green-light text-lg">{s.suffix}</span>
            </div>
            <p className="text-xs text-text-tertiary mt-1 uppercase tracking-wider group-hover:text-text-secondary transition-colors">{s.label}</p>
          </div>
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}
