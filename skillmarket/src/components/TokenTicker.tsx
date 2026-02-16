"use client";

import { useTrending } from "@/hooks/useTrending";

export default function TokenTicker() {
  const { tokens, isLoading } = useTrending(10);

  // Generate signal from volume/holder data
  function getSignal(token: { volume: number; holderCount: number; priceUsd: number }) {
    const score = Math.min(99, Math.floor((token.holderCount / 10) + (token.volume / 1000)));
    const signal = score > 60 ? "BUY" : score > 30 ? "WATCH" : "AVOID";
    return { signal, score: Math.max(10, score) };
  }

  if (isLoading || tokens.length === 0) {
    return (
      <section className="border-y border-border/50 bg-bg-secondary/30 py-3 overflow-hidden">
        <div className="flex items-center justify-center gap-2 text-xs text-text-tertiary">
          <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse-live" />
          Loading live token data...
        </div>
      </section>
    );
  }

  const items = tokens.map((t) => {
    const { signal, score } = getSignal(t);
    return { symbol: `$${t.symbol}`, signal, score };
  });

  return (
    <section className="border-y border-border/50 bg-bg-secondary/30 py-3 overflow-hidden">
      <div className="flex whitespace-nowrap" style={{ animation: "scroll 30s linear infinite" }}>
        {[...Array(3)].map((_, j) => (
          <div key={j} className="flex items-center gap-8 mr-8">
            {items.map((item, i) => (
              <div key={`${j}-${i}`} className="flex items-center gap-3 text-xs">
                <span className="font-mono font-medium text-text-primary">{item.symbol}</span>
                <span
                  className={`font-semibold ${
                    item.signal === "BUY"
                      ? "text-accent-green-light"
                      : item.signal === "AVOID"
                      ? "text-accent-red"
                      : "text-accent-yellow"
                  }`}
                >
                  {item.signal}
                </span>
                <span className="text-text-tertiary font-mono blur-[4px] select-none">{item.score}/100</span>
                <span className="text-border-light">|</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
