import { NextRequest } from "next/server";
import { getMarketData, getMetrics, getSwapHistory } from "@/lib/nadfun";
import { MALPHA_TOKEN } from "@/lib/constants";
import {
  getStrategy,
  updateStrategy,
  addAlert,
  type TradingStrategy,
  type StrategyAlert,
} from "@/lib/trading/strategies";

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// SSE event types
// ---------------------------------------------------------------------------

type TradingEvent =
  | { type: "thinking"; reasoning: string; timestamp: number }
  | {
      type: "tool_call";
      toolId: string;
      toolName: string;
      status: "running" | "complete";
      finding?: string;
      severity?: "info" | "warning" | "critical";
      details?: string[];
      timestamp: number;
    }
  | {
      type: "condition_check";
      condition: string;
      triggered: boolean;
      currentValue: string;
      threshold: string;
      timestamp: number;
    }
  | {
      type: "signal";
      recommendation: "BUY" | "HOLD" | "SELL" | "URGENT_SELL";
      score: number;
      riskScore: number;
      reasoning: string;
      triggeredConditions: string[];
      timestamp: number;
    }
  | { type: "alert_created"; alertId: string; timestamp: number }
  | { type: "done"; timestamp: number }
  | { type: "error"; message: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toolId(): string {
  return `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: { strategyId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { strategyId } = body;
  if (!strategyId) {
    return new Response(
      JSON.stringify({ error: "Missing strategyId" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const strategy = getStrategy(strategyId);
  if (!strategy) {
    return new Response(
      JSON.stringify({ error: "Strategy not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: TradingEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          // stream already closed
        }
      };

      try {
        await runEvaluation(strategy, emit);
      } catch (err) {
        emit({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

// ---------------------------------------------------------------------------
// Evaluation pipeline
// ---------------------------------------------------------------------------

async function runEvaluation(
  strategy: TradingStrategy,
  emit: (e: TradingEvent) => void,
) {
  const { tokenAddress, tokenSymbol, name: strategyName } = strategy;

  // ── Step 1: opening thought ──────────────────────────────────────────────
  emit({
    type: "thinking",
    reasoning: `Initiating autonomous evaluation of ${strategyName} for $${tokenSymbol}...`,
    timestamp: Date.now(),
  });

  await delay(150);

  // ── Step 2: fetch_market_snapshot ─────────────────────────────────────────
  const marketToolId = toolId();
  emit({
    type: "tool_call",
    toolId: marketToolId,
    toolName: "fetch_market_snapshot",
    status: "running",
    timestamp: Date.now(),
  });

  let marketData: Awaited<ReturnType<typeof getMarketData>> | null = null;
  try {
    marketData = await getMarketData(tokenAddress);
  } catch (err) {
    emit({
      type: "tool_call",
      toolId: marketToolId,
      toolName: "fetch_market_snapshot",
      status: "complete",
      finding: `Failed to fetch market data: ${err instanceof Error ? err.message : String(err)}`,
      severity: "critical",
      timestamp: Date.now(),
    });
    emit({
      type: "error",
      message: `Market data unavailable for ${tokenAddress}. Cannot proceed with evaluation.`,
    });
    return;
  }

  emit({
    type: "tool_call",
    toolId: marketToolId,
    toolName: "fetch_market_snapshot",
    status: "complete",
    finding: `Price $${marketData.price_usd.toFixed(6)} | MCap $${formatCompact(marketData.market_cap_usd)} | ${marketData.holder_count} holders`,
    severity: "info",
    details: [
      `Price (USD): $${marketData.price_usd.toFixed(6)}`,
      `Price (MON): ${marketData.price_mon.toFixed(6)} MON`,
      `Market Cap: $${formatCompact(marketData.market_cap_usd)}`,
      `Holders: ${marketData.holder_count}`,
      `Volume: $${formatCompact(marketData.volume)}`,
      `ATH: $${marketData.ath_price.toFixed(6)}`,
    ],
    timestamp: Date.now(),
  });

  await delay(150);

  // ── Step 3: analyze_trading_patterns ──────────────────────────────────────
  const patternsToolId = toolId();
  emit({
    type: "tool_call",
    toolId: patternsToolId,
    toolName: "analyze_trading_patterns",
    status: "running",
    timestamp: Date.now(),
  });

  let metrics: Awaited<ReturnType<typeof getMetrics>> = [];
  let swaps: Awaited<ReturnType<typeof getSwapHistory>> = {
    swaps: [],
    totalCount: 0,
  };

  try {
    [metrics, swaps] = await Promise.all([
      getMetrics(tokenAddress),
      getSwapHistory(tokenAddress, 20),
    ]);
  } catch (err) {
    emit({
      type: "tool_call",
      toolId: patternsToolId,
      toolName: "analyze_trading_patterns",
      status: "complete",
      finding: `Partial data: ${err instanceof Error ? err.message : String(err)}`,
      severity: "warning",
      timestamp: Date.now(),
    });
  }

  // Compute buy/sell ratio from swap history
  let buyCount = 0;
  let sellCount = 0;
  for (const swap of swaps.swaps) {
    const evType = (swap.event_type || "").toUpperCase();
    if (evType === "BUY") buyCount++;
    else if (evType === "SELL") sellCount++;
  }
  const totalTrades = buyCount + sellCount;
  const buySellRatio = totalTrades > 0 ? buyCount / totalTrades : 0.5;

  // Grab key timeframe metrics
  const m1 = metrics.find((m) => m.timeframe === "1");
  const m5 = metrics.find((m) => m.timeframe === "5");
  const h1 = metrics.find((m) => m.timeframe === "60");
  const d1 = metrics.find((m) => m.timeframe === "1D");

  const priceChange1h = h1?.percent ?? 0;
  const priceChange24h = d1?.percent ?? 0;
  const volume1h = h1?.volume ?? 0;
  const transactions1h = h1?.transactions ?? 0;

  const patternDetails: string[] = [
    `1h Price Change: ${priceChange1h >= 0 ? "+" : ""}${priceChange1h.toFixed(2)}%`,
    `24h Price Change: ${priceChange24h >= 0 ? "+" : ""}${priceChange24h.toFixed(2)}%`,
    `1h Volume: $${formatCompact(volume1h)}`,
    `1h Transactions: ${transactions1h}`,
    `Recent Buys: ${buyCount} | Sells: ${sellCount}`,
    `Buy/Sell Ratio: ${buySellRatio.toFixed(2)}`,
  ];

  if (m5) {
    patternDetails.push(
      `5m Change: ${m5.percent >= 0 ? "+" : ""}${m5.percent.toFixed(2)}%`,
    );
  }

  emit({
    type: "tool_call",
    toolId: patternsToolId,
    toolName: "analyze_trading_patterns",
    status: "complete",
    finding: `${priceChange1h >= 0 ? "+" : ""}${priceChange1h.toFixed(1)}% (1h) | B/S ratio ${buySellRatio.toFixed(2)} | ${transactions1h} txns`,
    severity:
      priceChange1h < -10 || buySellRatio < 0.3 ? "warning" : "info",
    details: patternDetails,
    timestamp: Date.now(),
  });

  await delay(150);

  // ── Step 4: thinking — analyze what was found ────────────────────────────
  const thinkingParts: string[] = [];

  if (priceChange1h < -15) {
    thinkingParts.push(
      `Market data shows a ${priceChange1h.toFixed(1)}% price decline in the last hour` +
        (volume1h > 0
          ? ` with $${formatCompact(volume1h)} in volume`
          : "") +
        ". This pattern often precedes a larger selloff...",
    );
  } else if (priceChange1h < -5) {
    thinkingParts.push(
      `Price has pulled back ${priceChange1h.toFixed(1)}% over the past hour. ` +
        "Moderate decline — watching for stabilization or continued weakness.",
    );
  } else if (priceChange1h > 15) {
    thinkingParts.push(
      `Strong upward movement of +${priceChange1h.toFixed(1)}% in the last hour. ` +
        "Evaluating whether this is sustainable or a potential blow-off top.",
    );
  } else {
    thinkingParts.push(
      `Price action is relatively stable at ${priceChange1h >= 0 ? "+" : ""}${priceChange1h.toFixed(1)}% over the last hour.`,
    );
  }

  if (buySellRatio < 0.3) {
    thinkingParts.push(
      `Buy/sell ratio is ${buySellRatio.toFixed(2)} — heavy selling pressure. ` +
        "Combined with declining holder count, this warrants caution...",
    );
  } else if (buySellRatio > 0.7) {
    thinkingParts.push(
      `Buy/sell ratio at ${buySellRatio.toFixed(2)} indicates strong buying interest.`,
    );
  }

  emit({
    type: "thinking",
    reasoning:
      thinkingParts.join(" ") ||
      "Analyzing collected data against strategy conditions...",
    timestamp: Date.now(),
  });

  await delay(150);

  // ── Step 5: evaluate_risk_signals ─────────────────────────────────────────
  const riskToolId = toolId();
  emit({
    type: "tool_call",
    toolId: riskToolId,
    toolName: "evaluate_risk_signals",
    status: "running",
    timestamp: Date.now(),
  });

  const triggeredConditions: string[] = [];

  // Condition: price drop
  const priceDropTriggered =
    strategy.conditions.priceDropPercent > 0 &&
    priceChange1h < -strategy.conditions.priceDropPercent;

  emit({
    type: "condition_check",
    condition: "Price Drop",
    triggered: priceDropTriggered,
    currentValue: `${priceChange1h.toFixed(2)}%`,
    threshold: `-${strategy.conditions.priceDropPercent}%`,
    timestamp: Date.now(),
  });
  if (priceDropTriggered) {
    triggeredConditions.push(
      `Price dropped ${priceChange1h.toFixed(1)}% (threshold: -${strategy.conditions.priceDropPercent}%)`,
    );
  }

  // Condition: volume spike
  // Compare 1h volume to 24h average hourly volume
  const avgHourlyVolume = d1 ? d1.volume / 24 : 0;
  const volumeSpikeFactor =
    avgHourlyVolume > 0 ? volume1h / avgHourlyVolume : 1;
  const volumeSpikeTriggered =
    strategy.conditions.volumeSpikeFactor > 0 &&
    volumeSpikeFactor >= strategy.conditions.volumeSpikeFactor;

  emit({
    type: "condition_check",
    condition: "Volume Spike",
    triggered: volumeSpikeTriggered,
    currentValue: `${volumeSpikeFactor.toFixed(1)}x`,
    threshold: `${strategy.conditions.volumeSpikeFactor}x`,
    timestamp: Date.now(),
  });
  if (volumeSpikeTriggered) {
    triggeredConditions.push(
      `Volume spike ${volumeSpikeFactor.toFixed(1)}x above average (threshold: ${strategy.conditions.volumeSpikeFactor}x)`,
    );
  }

  // Condition: holder drop — we only have current count, estimate from prior
  // Since we don't have historical holder data in this call, we approximate
  // using 24h metrics makers vs current holders as a rough proxy
  const holderCount = marketData.holder_count;
  const makersDelta = d1 ? d1.makers : 0;
  const estimatedPriorHolders =
    makersDelta > 0 ? holderCount - makersDelta : holderCount;
  const holderChangePercent =
    estimatedPriorHolders > 0
      ? ((holderCount - estimatedPriorHolders) / estimatedPriorHolders) * 100
      : 0;
  const holderDropTriggered =
    strategy.conditions.holderDropPercent > 0 &&
    holderChangePercent < -strategy.conditions.holderDropPercent;

  emit({
    type: "condition_check",
    condition: "Holder Drop",
    triggered: holderDropTriggered,
    currentValue: `${holderChangePercent >= 0 ? "+" : ""}${holderChangePercent.toFixed(1)}%`,
    threshold: `-${strategy.conditions.holderDropPercent}%`,
    timestamp: Date.now(),
  });
  if (holderDropTriggered) {
    triggeredConditions.push(
      `Holders changed ${holderChangePercent.toFixed(1)}% (threshold: -${strategy.conditions.holderDropPercent}%)`,
    );
  }

  emit({
    type: "tool_call",
    toolId: riskToolId,
    toolName: "evaluate_risk_signals",
    status: "complete",
    finding: `${triggeredConditions.length} condition(s) triggered out of 3 checked`,
    severity: triggeredConditions.length > 0 ? "warning" : "info",
    details: triggeredConditions.length > 0 ? triggeredConditions : ["All conditions within safe thresholds"],
    timestamp: Date.now(),
  });

  await delay(150);

  // ── Step 6: check_holder_activity ─────────────────────────────────────────
  const holderToolId = toolId();
  emit({
    type: "tool_call",
    toolId: holderToolId,
    toolName: "check_holder_activity",
    status: "running",
    timestamp: Date.now(),
  });

  const holderSeverity: "info" | "warning" | "critical" =
    holderCount < 10
      ? "critical"
      : holderCount < 50
        ? "warning"
        : "info";

  emit({
    type: "tool_call",
    toolId: holderToolId,
    toolName: "check_holder_activity",
    status: "complete",
    finding: `${holderCount} holders | Change: ${holderChangePercent >= 0 ? "+" : ""}${holderChangePercent.toFixed(1)}%`,
    severity: holderSeverity,
    details: [
      `Current Holders: ${holderCount}`,
      `Estimated Change (24h): ${holderChangePercent >= 0 ? "+" : ""}${holderChangePercent.toFixed(1)}%`,
      `24h Active Makers: ${makersDelta}`,
      holderCount < 10
        ? "CRITICAL: Extremely low holder count — high concentration risk"
        : holderCount < 50
          ? "WARNING: Low holder count — limited distribution"
          : "Holder base appears adequate",
    ],
    timestamp: Date.now(),
  });

  await delay(150);

  // ── Step 7: thinking — which conditions triggered ────────────────────────
  if (triggeredConditions.length > 0) {
    emit({
      type: "thinking",
      reasoning:
        `${triggeredConditions.length} condition(s) triggered: ${triggeredConditions.join("; ")}. ` +
        "Synthesizing a risk-weighted recommendation based on severity...",
      timestamp: Date.now(),
    });
  } else {
    emit({
      type: "thinking",
      reasoning:
        "All indicators are stable. No conditions triggered. Maintaining HOLD recommendation.",
      timestamp: Date.now(),
    });
  }

  await delay(150);

  // ── Step 8: generate_trading_signal ────────────────────────────────────────
  const signalToolId = toolId();
  emit({
    type: "tool_call",
    toolId: signalToolId,
    toolName: "generate_trading_signal",
    status: "running",
    timestamp: Date.now(),
  });

  // --- Heuristic scoring ---

  // Score (0-100): higher = more bullish
  let score = 50; // start neutral

  // Price trend contribution (up to +/-25)
  if (priceChange1h > 10) score += 15;
  else if (priceChange1h > 5) score += 10;
  else if (priceChange1h > 0) score += 5;
  else if (priceChange1h > -5) score -= 5;
  else if (priceChange1h > -10) score -= 10;
  else score -= 20;

  if (priceChange24h > 20) score += 10;
  else if (priceChange24h > 0) score += 5;
  else if (priceChange24h > -10) score -= 5;
  else score -= 10;

  // Volume health (+/-10)
  if (volume1h > 0 && transactions1h > 10) score += 5;
  if (volumeSpikeFactor > 3) score -= 5; // abnormal spike is suspicious

  // Holder count (+/-10)
  if (holderCount >= 100) score += 10;
  else if (holderCount >= 50) score += 5;
  else if (holderCount < 10) score -= 10;

  // Buy/sell ratio (+/-15)
  if (buySellRatio > 0.65) score += 10;
  else if (buySellRatio > 0.5) score += 5;
  else if (buySellRatio < 0.3) score -= 15;
  else if (buySellRatio < 0.4) score -= 10;

  // $MALPHA platform token boost
  const isMalpha = tokenAddress.toLowerCase() === MALPHA_TOKEN;
  if (isMalpha) score += 20;

  score = clamp(score, 0, 100);

  // Risk score (0-100): higher = more dangerous
  let riskScore = 10; // base risk

  if (holderCount < 10) riskScore += 20;
  else if (holderCount < 30) riskScore += 10;

  if (priceChange1h < -10) riskScore += 15;
  else if (priceChange1h < -5) riskScore += 8;

  if (volume1h === 0 && transactions1h === 0) riskScore += 10;

  if (buySellRatio < 0.3) riskScore += 20;
  else if (buySellRatio < 0.4) riskScore += 10;

  // Recent dump pattern: large negative short-term + high volume
  if (priceChange1h < -15 && volumeSpikeFactor > 2) riskScore += 25;
  else if (priceChange1h < -10 && volumeSpikeFactor > 1.5) riskScore += 15;

  if (isMalpha) riskScore = Math.max(0, riskScore - 20);

  riskScore = clamp(riskScore, 0, 100);

  // Recommendation logic
  let recommendation: "BUY" | "HOLD" | "SELL" | "URGENT_SELL";
  if (riskScore > 80 || score < 20) {
    recommendation = "URGENT_SELL";
  } else if (riskScore > 60 || score < 35) {
    recommendation = "SELL";
  } else if (score > 70 && riskScore < 30) {
    recommendation = "BUY";
  } else {
    recommendation = "HOLD";
  }

  // Check against strategy-level thresholds
  if (
    strategy.conditions.scoreThreshold > 0 &&
    score < strategy.conditions.scoreThreshold
  ) {
    triggeredConditions.push(
      `Score ${score} below threshold ${strategy.conditions.scoreThreshold}`,
    );
  }
  if (
    strategy.conditions.riskThreshold > 0 &&
    riskScore > strategy.conditions.riskThreshold
  ) {
    triggeredConditions.push(
      `Risk score ${riskScore} above threshold ${strategy.conditions.riskThreshold}`,
    );
  }

  // Build reasoning narrative
  const reasoningParts: string[] = [];

  if (recommendation === "URGENT_SELL") {
    reasoningParts.push(
      `URGENT: $${tokenSymbol} shows critical risk signals.`,
    );
    if (priceChange1h < -15) {
      reasoningParts.push(
        `Price has collapsed ${priceChange1h.toFixed(1)}% in the last hour with ${volumeSpikeFactor > 2 ? "abnormally high" : "elevated"} volume.`,
      );
    }
    if (buySellRatio < 0.3) {
      reasoningParts.push(
        "Overwhelming sell pressure with buy/sell ratio below 0.3.",
      );
    }
    if (holderCount < 10) {
      reasoningParts.push(
        "Extremely low holder count creates severe concentration risk.",
      );
    }
    reasoningParts.push("Immediate exit recommended to preserve capital.");
  } else if (recommendation === "SELL") {
    reasoningParts.push(
      `$${tokenSymbol} is exhibiting deteriorating fundamentals.`,
    );
    if (priceChange1h < -5) {
      reasoningParts.push(
        `Price declined ${priceChange1h.toFixed(1)}% in the past hour.`,
      );
    }
    if (buySellRatio < 0.4) {
      reasoningParts.push(
        `Sell-side dominance with a ${buySellRatio.toFixed(2)} buy/sell ratio.`,
      );
    }
    reasoningParts.push(
      "Consider reducing position or setting tight stop-loss.",
    );
  } else if (recommendation === "BUY") {
    reasoningParts.push(
      `$${tokenSymbol} shows positive momentum across key indicators.`,
    );
    if (priceChange1h > 5) {
      reasoningParts.push(
        `Healthy uptrend of +${priceChange1h.toFixed(1)}% in the last hour.`,
      );
    }
    if (buySellRatio > 0.6) {
      reasoningParts.push(
        `Strong buying interest with a ${buySellRatio.toFixed(2)} buy/sell ratio.`,
      );
    }
    if (holderCount > 100) {
      reasoningParts.push("Well-distributed holder base reduces rug risk.");
    }
    reasoningParts.push("Conditions favor accumulation at current levels.");
  } else {
    reasoningParts.push(
      `$${tokenSymbol} is in a neutral state with mixed signals.`,
    );
    reasoningParts.push(
      `Price change: ${priceChange1h >= 0 ? "+" : ""}${priceChange1h.toFixed(1)}% (1h), buy/sell ratio: ${buySellRatio.toFixed(2)}, holders: ${holderCount}.`,
    );
    reasoningParts.push(
      "No strong directional signal — maintaining HOLD recommendation.",
    );
  }

  const reasoning = reasoningParts.join(" ");

  emit({
    type: "tool_call",
    toolId: signalToolId,
    toolName: "generate_trading_signal",
    status: "complete",
    finding: `${recommendation} — Score: ${score}/100, Risk: ${riskScore}/100`,
    severity:
      recommendation === "URGENT_SELL"
        ? "critical"
        : recommendation === "SELL"
          ? "warning"
          : "info",
    details: [
      `Recommendation: ${recommendation}`,
      `Composite Score: ${score}/100`,
      `Risk Score: ${riskScore}/100`,
      `Triggered Conditions: ${triggeredConditions.length}`,
    ],
    timestamp: Date.now(),
  });

  await delay(150);

  // ── Step 9: emit signal ───────────────────────────────────────────────────
  emit({
    type: "signal",
    recommendation,
    score,
    riskScore,
    reasoning,
    triggeredConditions,
    timestamp: Date.now(),
  });

  // ── Step 10: create alert if conditions triggered ─────────────────────────
  if (triggeredConditions.length > 0 && strategy.actions.alertOnTrigger) {
    const alert: Omit<StrategyAlert, "id" | "timestamp" | "dismissed"> = {
      strategyId: strategy.id,
      strategyName: strategy.name,
      tokenAddress: strategy.tokenAddress,
      tokenSymbol: strategy.tokenSymbol,
      triggeredConditions,
      agentReasoning: reasoning,
      recommendation,
      score,
      riskScore,
    };

    const created = addAlert(alert);

    // Update strategy stats
    updateStrategy(strategy.id, {
      lastChecked: Date.now(),
      timesTriggered: strategy.timesTriggered + 1,
      lastTriggeredAt: Date.now(),
    });

    emit({
      type: "alert_created",
      alertId: created.id,
      timestamp: Date.now(),
    });
  } else {
    // No alert, but still mark as checked
    updateStrategy(strategy.id, {
      lastChecked: Date.now(),
    });
  }

  // ── Step 11: done ─────────────────────────────────────────────────────────
  emit({ type: "done", timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}
