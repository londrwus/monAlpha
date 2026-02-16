import { NextRequest, NextResponse } from "next/server";
import { isAddress, formatUnits } from "viem";
import { publicClient } from "@/lib/monad";
import { getHoldings, getMarketData, getMetrics } from "@/lib/nadfun";
import { MALPHA_TOKEN } from "@/lib/constants";
import type { NadHoldingToken, NadMetricsTimeframe } from "@/lib/types";

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PortfolioEvent =
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
      type: "holding";
      tokenAddress: string;
      symbol: string;
      name: string;
      imageUrl: string;
      balance: string;
      valueMon: number;
      valueUsd: number;
      priceUsd: number;
      score: number;
      signal: "STRONG" | "HOLD" | "WEAK" | "EXIT";
      riskFactors: string[];
      timestamp: number;
    }
  | {
      type: "portfolio_health";
      totalValueMon: number;
      totalValueUsd: number;
      diversificationScore: number;
      riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      concentrationRisk: string;
      largestPosition: { symbol: string; percentage: number };
      timestamp: number;
    }
  | {
      type: "recommendation";
      action: "HOLD" | "REDUCE" | "EXIT" | "REBALANCE" | "DIVERSIFY";
      symbol?: string;
      reasoning: string;
      urgency: "low" | "medium" | "high";
      timestamp: number;
    }
  | { type: "done"; timestamp: number }
  | { type: "error"; message: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Safely convert any value to a number (never NaN/undefined) */
function safeNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Safely format number to fixed decimals */
function safeFix(v: unknown, decimals = 2): string {
  return safeNum(v).toFixed(decimals);
}

function scorePosition(
  holding: NadHoldingToken,
  market: { holder_count: number; volume: number; market_cap_usd: number; price_usd: number } | null,
  metrics: NadMetricsTimeframe[] | null,
): { score: number; signal: "STRONG" | "HOLD" | "WEAK" | "EXIT"; riskFactors: string[] } {
  let score = 50; // start neutral
  const riskFactors: string[] = [];

  if (!market) {
    return { score: 15, signal: "EXIT", riskFactors: ["Market data unavailable - token may be delisted or dead"] };
  }

  const holders = safeNum(market.holder_count);
  const vol = safeNum(market.volume);

  // Holder count (0-25 pts)
  if (holders >= 500) score += 25;
  else if (holders >= 100) score += 15;
  else if (holders >= 50) score += 8;
  else if (holders >= 20) score += 3;
  else {
    score -= 10;
    riskFactors.push(`Only ${holders} holders - extremely low liquidity risk`);
  }

  // Volume (0-20 pts)
  if (vol > 10000) score += 20;
  else if (vol > 1000) score += 12;
  else if (vol > 100) score += 5;
  else if (vol > 0) score += 2;
  else {
    score -= 10;
    riskFactors.push("Zero trading volume - no active market");
  }

  // Market cap (0-15 pts)
  const mcap = safeNum(market.market_cap_usd);
  if (mcap > 100000) score += 15;
  else if (mcap > 10000) score += 8;
  else if (mcap > 1000) score += 3;
  else {
    score -= 5;
    riskFactors.push(`Very low market cap ($${safeFix(mcap, 0)})`);
  }

  // Metrics-based adjustments (price change)
  if (metrics && metrics.length > 0) {
    const h1 = metrics.find((m) => m.timeframe === "1h");
    const d1 = metrics.find((m) => m.timeframe === "1d");

    if (d1) {
      const d1Pct = safeNum(d1.percent);
      if (d1Pct < -50) {
        score -= 15;
        riskFactors.push(`Price crashed ${safeFix(d1Pct, 1)}% in 24h`);
      } else if (d1Pct < -20) {
        score -= 8;
        riskFactors.push(`Down ${safeFix(d1Pct, 1)}% in 24h`);
      } else if (d1Pct > 50) {
        score += 5;
        riskFactors.push(`Up ${safeFix(d1Pct, 1)}% in 24h - volatile`);
      } else if (d1Pct > 10) {
        score += 8;
      }

      if (safeNum(d1.transactions) === 0) {
        score -= 5;
        riskFactors.push("No transactions in 24h");
      }
    }

    if (h1 && safeNum(h1.percent) < -30) {
      score -= 5;
      riskFactors.push(`Rapid decline: ${safeFix(h1.percent, 1)}% in 1h`);
    }
  }

  // Price check
  if ((market.price_usd ?? 0) === 0) {
    score -= 15;
    riskFactors.push("Token price is $0 - likely dead");
  }

  // $MALPHA platform token boost
  const tokenAddr = holding.token_info?.token_address?.toLowerCase() ?? "";
  if (tokenAddr === MALPHA_TOKEN) {
    score += 25;
    riskFactors.length = 0; // clear risks for platform token
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  let signal: "STRONG" | "HOLD" | "WEAK" | "EXIT";
  if (score > 70) signal = "STRONG";
  else if (score >= 50) signal = "HOLD";
  else if (score >= 30) signal = "WEAK";
  else signal = "EXIT";

  return { score, signal, riskFactors };
}

function computeDiversificationScore(
  positions: Array<{ valueMon: number; symbol: string }>,
): {
  score: number;
  concentrationRisk: string;
  largestPosition: { symbol: string; percentage: number };
} {
  if (positions.length === 0) {
    return {
      score: 0,
      concentrationRisk: "No positions found",
      largestPosition: { symbol: "N/A", percentage: 0 },
    };
  }

  const totalValue = positions.reduce((sum, p) => sum + p.valueMon, 0);
  if (totalValue === 0) {
    return {
      score: 0,
      concentrationRisk: "All positions have zero value",
      largestPosition: { symbol: positions[0].symbol, percentage: 0 },
    };
  }

  // Calculate Herfindahl-Hirschman Index (HHI)
  const shares = positions.map((p) => p.valueMon / totalValue);
  const hhi = shares.reduce((sum, s) => sum + s * s, 0);

  // Perfect diversification among N assets: HHI = 1/N
  // Single asset: HHI = 1
  // Score: lower HHI = better diversification
  const score = Math.round((1 - hhi) * 100);

  const sorted = positions
    .map((p) => ({ symbol: p.symbol, percentage: (p.valueMon / totalValue) * 100 }))
    .sort((a, b) => b.percentage - a.percentage);

  const largest = sorted[0];

  let concentrationRisk: string;
  if (largest.percentage > 80) {
    concentrationRisk = `Extremely concentrated: ${largest.symbol} is ${largest.percentage.toFixed(1)}% of portfolio`;
  } else if (largest.percentage > 60) {
    concentrationRisk = `Heavily concentrated in ${largest.symbol} (${largest.percentage.toFixed(1)}%)`;
  } else if (largest.percentage > 40) {
    concentrationRisk = `Moderately concentrated in ${largest.symbol} (${largest.percentage.toFixed(1)}%)`;
  } else {
    concentrationRisk = "Well diversified across positions";
  }

  return { score, concentrationRisk, largestPosition: largest };
}

function computeRiskLevel(
  diversificationScore: number,
  avgPositionScore: number,
  exitCount: number,
  totalPositions: number,
): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  let risk = 0;

  // Low diversification raises risk
  if (diversificationScore < 20) risk += 3;
  else if (diversificationScore < 40) risk += 2;
  else if (diversificationScore < 60) risk += 1;

  // Low average position quality raises risk
  if (avgPositionScore < 30) risk += 3;
  else if (avgPositionScore < 50) risk += 2;
  else if (avgPositionScore < 65) risk += 1;

  // High ratio of EXIT positions
  if (totalPositions > 0) {
    const exitRatio = exitCount / totalPositions;
    if (exitRatio > 0.5) risk += 2;
    else if (exitRatio > 0.25) risk += 1;
  }

  if (risk >= 6) return "CRITICAL";
  if (risk >= 4) return "HIGH";
  if (risk >= 2) return "MEDIUM";
  return "LOW";
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: { address?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { address } = body;

  if (!address || !isAddress(address)) {
    return NextResponse.json(
      { error: "Missing or invalid wallet address" },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: PortfolioEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // stream already closed
        }
      };

      try {
        const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;

        // ── Step 1: Initialize ───────────────────────────────────────────
        emit({
          type: "thinking",
          reasoning: `Initializing portfolio scan for ${shortAddr}. I'll start by checking native MON balance and then discover all token holdings.`,
          timestamp: Date.now(),
        });
        await delay(150);

        // ── Step 2: Fetch native MON balance ─────────────────────────────
        emit({
          type: "tool_call",
          toolId: "wallet_balance_1",
          toolName: "scan_wallet_balance",
          status: "running",
          timestamp: Date.now(),
        });
        await delay(150);

        let monBalance = BigInt(0);
        try {
          monBalance = await publicClient.getBalance({ address: address as `0x${string}` });
        } catch (err) {
          emit({
            type: "tool_call",
            toolId: "wallet_balance_1",
            toolName: "scan_wallet_balance",
            status: "complete",
            finding: "Failed to fetch native MON balance",
            severity: "warning",
            timestamp: Date.now(),
          });
        }

        const monFormatted = parseFloat(formatUnits(monBalance, 18));

        if (monBalance > BigInt(0)) {
          emit({
            type: "tool_call",
            toolId: "wallet_balance_1",
            toolName: "scan_wallet_balance",
            status: "complete",
            finding: `Wallet holds ${monFormatted.toFixed(4)} MON in native balance`,
            severity: "info",
            details: [
              `Native MON: ${monFormatted.toFixed(4)}`,
              `Address: ${address}`,
            ],
            timestamp: Date.now(),
          });
        } else {
          emit({
            type: "tool_call",
            toolId: "wallet_balance_1",
            toolName: "scan_wallet_balance",
            status: "complete",
            finding: "Wallet has zero native MON balance",
            severity: "warning",
            details: ["No native MON detected"],
            timestamp: Date.now(),
          });
        }
        await delay(150);

        // ── Step 3: Discover token holdings ──────────────────────────────
        emit({
          type: "tool_call",
          toolId: "discover_holdings_1",
          toolName: "discover_holdings",
          status: "running",
          timestamp: Date.now(),
        });
        await delay(150);

        let holdings: NadHoldingToken[] = [];
        let holdingsTotalCount = 0;
        try {
          const result = await getHoldings(address, 1, 20);
          const rawTokens = Array.isArray(result.tokens) ? result.tokens : [];
          holdings = rawTokens.filter((t): t is NadHoldingToken => t != null);
          holdingsTotalCount = result.totalCount || holdings.length;
        } catch (err) {
          emit({
            type: "tool_call",
            toolId: "discover_holdings_1",
            toolName: "discover_holdings",
            status: "complete",
            finding: `Failed to fetch holdings: ${err instanceof Error ? err.message : String(err)}`,
            severity: "critical",
            timestamp: Date.now(),
          });
          emit({ type: "done", timestamp: Date.now() });
          controller.close();
          return;
        }

        let holdingDetails: string[];
        try {
          holdingDetails = holdings.slice(0, 5).map((h) => {
            const sym = h?.token_info?.symbol ?? "???";
            const bal = safeFix(parseFloat(String(h?.balance_info?.balance ?? "0")));
            const usd = safeFix(h?.balance_info?.value_usd);
            return `${sym}: ${bal} ($${usd})`;
          });
        } catch {
          holdingDetails = [`${holdings.length} tokens found`];
        }

        emit({
          type: "tool_call",
          toolId: "discover_holdings_1",
          toolName: "discover_holdings",
          status: "complete",
          finding: `Discovered ${holdingsTotalCount} token position${holdingsTotalCount !== 1 ? "s" : ""} in wallet`,
          severity: "info",
          details: holdingDetails,
          timestamp: Date.now(),
        });
        await delay(150);

        if (holdings.length === 0) {
          emit({
            type: "thinking",
            reasoning: `This wallet has no token holdings on nad.fun. It only holds ${monFormatted.toFixed(4)} native MON. There's nothing to evaluate.`,
            timestamp: Date.now(),
          });

          emit({
            type: "portfolio_health",
            totalValueMon: monFormatted,
            totalValueUsd: 0,
            diversificationScore: 0,
            riskLevel: "LOW",
            concentrationRisk: "No token positions - only native MON",
            largestPosition: { symbol: "MON", percentage: 100 },
            timestamp: Date.now(),
          });

          emit({ type: "done", timestamp: Date.now() });
          controller.close();
          return;
        }

        // ── Step 4: Evaluate each position ───────────────────────────────
        const tokensToEvaluate = holdings.slice(0, 10);

        emit({
          type: "thinking",
          reasoning: `Found ${holdingsTotalCount} tokens. Let me evaluate each position by pulling market data, holder counts, and trading activity. I'll score each one for risk.`,
          timestamp: Date.now(),
        });
        await delay(150);

        const evaluatedPositions: Array<{
          symbol: string;
          name: string;
          tokenAddress: string;
          imageUrl: string;
          balance: string;
          valueMon: number;
          valueUsd: number;
          priceUsd: number;
          score: number;
          signal: "STRONG" | "HOLD" | "WEAK" | "EXIT";
          riskFactors: string[];
        }> = [];

        for (let i = 0; i < tokensToEvaluate.length; i++) {
          const h = tokensToEvaluate[i];
          const tokenAddr = h?.token_info?.token_address ?? "";
          const sym = h?.token_info?.symbol ?? "???";
          const balanceVal = safeNum(h?.balance_info?.value_usd);
          const balanceMon = safeNum(h?.balance_info?.value_mon);
          const balanceStr = String(h?.balance_info?.balance ?? "0");
          const imgUrl = h?.token_info?.image_uri ?? "";
          const tokenName = h?.token_info?.name ?? sym;

          emit({
            type: "tool_call",
            toolId: `eval_position_${i}`,
            toolName: "evaluate_position",
            status: "running",
            finding: `Analyzing $${sym}...`,
            timestamp: Date.now(),
          });
          await delay(150);

          let market: {
            holder_count: number;
            volume: number;
            market_cap_usd: number;
            price_usd: number;
          } | null = null;
          let metrics: NadMetricsTimeframe[] | null = null;

          try {
            const marketData = await getMarketData(tokenAddr);
            market = {
              holder_count: safeNum(marketData?.holder_count),
              volume: safeNum(marketData?.volume),
              market_cap_usd: safeNum(marketData?.market_cap_usd),
              price_usd: safeNum(marketData?.price_usd),
            };
          } catch {
            // Market data unavailable
          }

          try {
            metrics = await getMetrics(tokenAddr, "1h,1d");
          } catch {
            // Metrics unavailable
          }

          let score = 50;
          let signal: "STRONG" | "HOLD" | "WEAK" | "EXIT" = "HOLD";
          let riskFactors: string[] = [];
          try {
            const result = scorePosition(h, market, metrics);
            score = result.score;
            signal = result.signal;
            riskFactors = result.riskFactors;
          } catch {
            score = 30;
            signal = "WEAK";
            riskFactors = ["Unable to fully evaluate this position"];
          }

          const details: string[] = [];
          if (market) {
            details.push(`Holders: ${safeNum(market.holder_count)}`);
            details.push(`Volume: $${safeFix(market.volume, 0)}`);
            details.push(`Market Cap: $${safeFix(market.market_cap_usd, 0)}`);
          }
          details.push(`Position Value: $${safeFix(balanceVal)}`);
          details.push(`Score: ${score}/100 (${signal})`);
          if (riskFactors.length > 0) {
            details.push(...riskFactors.map((r) => `Risk: ${r}`));
          }

          const severity: "info" | "warning" | "critical" =
            signal === "EXIT" ? "critical" : signal === "WEAK" ? "warning" : "info";

          emit({
            type: "tool_call",
            toolId: `eval_position_${i}`,
            toolName: "evaluate_position",
            status: "complete",
            finding: `$${sym}: ${signal} (${score}/100) - ${market ? `${safeNum(market.holder_count)} holders, $${safeFix(market.volume, 0)} vol` : "no market data"}`,
            severity,
            details,
            timestamp: Date.now(),
          });

          const priceUsd = safeNum(market?.price_usd ?? h?.market_info?.price_usd);

          emit({
            type: "holding",
            tokenAddress: tokenAddr,
            symbol: sym,
            name: tokenName,
            imageUrl: imgUrl,
            balance: balanceStr,
            valueMon: balanceMon,
            valueUsd: balanceVal,
            priceUsd,
            score,
            signal,
            riskFactors,
            timestamp: Date.now(),
          });

          evaluatedPositions.push({
            symbol: sym,
            name: tokenName,
            tokenAddress: tokenAddr,
            imageUrl: imgUrl,
            balance: balanceStr,
            valueMon: balanceMon,
            valueUsd: balanceVal,
            priceUsd,
            score,
            signal,
            riskFactors,
          });

          await delay(150);
        }

        // ── Step 5: Portfolio concentration & risk thinking ──────────────
        const totalValueMon = evaluatedPositions.reduce((s, p) => s + p.valueMon, 0) + monFormatted;
        const totalValueUsd = evaluatedPositions.reduce((s, p) => s + p.valueUsd, 0);
        const exitPositions = evaluatedPositions.filter((p) => p.signal === "EXIT");
        const weakPositions = evaluatedPositions.filter((p) => p.signal === "WEAK");
        const strongPositions = evaluatedPositions.filter((p) => p.signal === "STRONG");

        // Build intelligent thinking messages
        const positionsForDiversification = evaluatedPositions.map((p) => ({
          symbol: p.symbol,
          valueMon: p.valueMon,
        }));
        const { score: divScore, concentrationRisk, largestPosition } =
          computeDiversificationScore(positionsForDiversification);

        // Craft a nuanced observation
        const thinkingParts: string[] = [];

        if (largestPosition.percentage > 60) {
          thinkingParts.push(
            `I notice your portfolio is heavily concentrated in $${largestPosition.symbol} (${safeFix(largestPosition.percentage, 1)}%). This poses significant single-asset risk.`,
          );
        } else if (evaluatedPositions.length === 1) {
          thinkingParts.push(
            `Your entire portfolio is in a single position ($${evaluatedPositions[0].symbol}). Any adverse event could wipe out your exposure.`,
          );
        } else {
          thinkingParts.push(
            `Portfolio has ${evaluatedPositions.length} positions. ${concentrationRisk}.`,
          );
        }

        if (exitPositions.length > 0) {
          const exitSymbols = exitPositions.map((p) => `$${p.symbol}`).join(", ");
          thinkingParts.push(
            `${exitPositions.length} position${exitPositions.length > 1 ? "s" : ""} flagged for exit: ${exitSymbols}. These show critical risk indicators.`,
          );
        }

        if (weakPositions.length > 0) {
          thinkingParts.push(
            `${weakPositions.length} position${weakPositions.length > 1 ? "s" : ""} showing weakness. Let me check if any show concerning trading patterns.`,
          );
        }

        emit({
          type: "thinking",
          reasoning: thinkingParts.join(" "),
          timestamp: Date.now(),
        });
        await delay(150);

        // ── Step 6: Assess portfolio health ──────────────────────────────
        emit({
          type: "tool_call",
          toolId: "health_1",
          toolName: "assess_portfolio_health",
          status: "running",
          timestamp: Date.now(),
        });
        await delay(150);

        const avgScore =
          evaluatedPositions.length > 0
            ? evaluatedPositions.reduce((s, p) => s + p.score, 0) / evaluatedPositions.length
            : 0;

        const riskLevel = computeRiskLevel(
          divScore,
          avgScore,
          exitPositions.length,
          evaluatedPositions.length,
        );

        emit({
          type: "tool_call",
          toolId: "health_1",
          toolName: "assess_portfolio_health",
          status: "complete",
          finding: `Portfolio risk: ${riskLevel}. Diversification: ${divScore}/100. Avg position quality: ${safeFix(avgScore, 0)}/100.`,
          severity: riskLevel === "CRITICAL" ? "critical" : riskLevel === "HIGH" ? "warning" : "info",
          details: [
            `Total value: ${safeFix(totalValueMon, 4)} MON (~$${safeFix(totalValueUsd)})`,
            `Positions: ${evaluatedPositions.length} tokens + native MON`,
            `Diversification: ${divScore}/100`,
            `STRONG: ${strongPositions.length}, HOLD: ${evaluatedPositions.filter((p) => p.signal === "HOLD").length}, WEAK: ${weakPositions.length}, EXIT: ${exitPositions.length}`,
          ],
          timestamp: Date.now(),
        });

        emit({
          type: "portfolio_health",
          totalValueMon,
          totalValueUsd,
          diversificationScore: divScore,
          riskLevel,
          concentrationRisk,
          largestPosition,
          timestamp: Date.now(),
        });
        await delay(150);

        // ── Step 7: Generate recommendations ─────────────────────────────
        emit({
          type: "tool_call",
          toolId: "recs_1",
          toolName: "generate_recommendations",
          status: "running",
          timestamp: Date.now(),
        });
        await delay(150);

        const recommendations: Array<{
          action: "HOLD" | "REDUCE" | "EXIT" | "REBALANCE" | "DIVERSIFY";
          symbol?: string;
          reasoning: string;
          urgency: "low" | "medium" | "high";
        }> = [];

        // EXIT recommendations
        for (const pos of exitPositions) {
          const topRisk = pos.riskFactors[0] || "Multiple critical risk factors detected";
          recommendations.push({
            action: "EXIT",
            symbol: pos.symbol,
            reasoning: `$${pos.symbol} scored ${pos.score}/100. ${topRisk}. Consider exiting this position to protect capital.`,
            urgency: "high",
          });
        }

        // WEAK position warnings
        for (const pos of weakPositions) {
          const topRisk = pos.riskFactors[0] || "Below-average fundamentals";
          recommendations.push({
            action: "REDUCE",
            symbol: pos.symbol,
            reasoning: `$${pos.symbol} is showing weakness (${pos.score}/100). ${topRisk}. Consider reducing exposure.`,
            urgency: "medium",
          });
        }

        // Concentration risk
        if (largestPosition.percentage > 50 && evaluatedPositions.length > 1) {
          recommendations.push({
            action: "REBALANCE",
            symbol: largestPosition.symbol,
            reasoning: `$${largestPosition.symbol} represents ${safeFix(largestPosition.percentage, 1)}% of your portfolio. Rebalancing would reduce single-asset risk exposure.`,
            urgency: largestPosition.percentage > 70 ? "high" : "medium",
          });
        }

        // Diversification
        if (evaluatedPositions.length < 3 && evaluatedPositions.length > 0) {
          recommendations.push({
            action: "DIVERSIFY",
            reasoning: `With only ${evaluatedPositions.length} position${evaluatedPositions.length > 1 ? "s" : ""}, your portfolio lacks diversification. Consider spreading risk across more assets.`,
            urgency: "low",
          });
        }

        // If everything looks good
        if (recommendations.length === 0) {
          recommendations.push({
            action: "HOLD",
            reasoning: "Portfolio looks healthy. Positions show adequate liquidity, reasonable holder counts, and stable trading activity. Continue monitoring.",
            urgency: "low",
          });
        }

        emit({
          type: "tool_call",
          toolId: "recs_1",
          toolName: "generate_recommendations",
          status: "complete",
          finding: `Generated ${recommendations.length} recommendation${recommendations.length !== 1 ? "s" : ""}`,
          severity: recommendations.some((r) => r.urgency === "high")
            ? "warning"
            : "info",
          details: recommendations.map(
            (r) => `${r.action}${r.symbol ? ` $${r.symbol}` : ""}: ${r.reasoning.slice(0, 80)}...`,
          ),
          timestamp: Date.now(),
        });
        await delay(150);

        // Emit each recommendation
        for (const rec of recommendations) {
          emit({
            type: "recommendation",
            action: rec.action,
            symbol: rec.symbol,
            reasoning: rec.reasoning,
            urgency: rec.urgency,
            timestamp: Date.now(),
          });
          await delay(100);
        }

        // ── Done ─────────────────────────────────────────────────────────
        emit({ type: "done", timestamp: Date.now() });
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
