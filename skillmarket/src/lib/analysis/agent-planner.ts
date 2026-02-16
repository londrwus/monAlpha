import type { AgentContext, Finding } from "./agent-context";
import { hasFlag } from "./agent-context";
import { getToolsByTier } from "./agent-tools";
import type { CollectedTokenData } from "./types";
import { callDeepSeekAgent } from "../deepseek";

// === Agent Planner — uses DeepSeek AI for real reasoning between tiers ===

export interface PlannerDecision {
  reasoning: string;
  nextTools: string[];
}

/** Format findings for AI context */
function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) return "No findings yet.";
  return findings
    .map(
      (f) =>
        `[${f.severity.toUpperCase()}] ${f.toolName}: ${f.finding}${f.details.length > 0 ? "\n  Details: " + f.details.slice(0, 3).join("; ") : ""}`
    )
    .join("\n");
}

/** Format token data summary for AI context */
function formatTokenBrief(data: CollectedTokenData): string {
  const lines: string[] = [
    `Token: $${data.symbol} (${data.name})`,
    `Address: ${data.address}`,
  ];

  if (data.hasApiData) {
    lines.push(`Price: $${data.priceUsd}, MCap: $${data.marketCapUsd}, Holders: ${data.holderCount}`);
    lines.push(`24h Volume: $${data.volume24h}, Trades: ${data.trades.length}`);
  } else {
    lines.push("API data: limited (using on-chain data only)");
  }

  if (data.curveState) {
    const liq = Number(data.curveState.realMonReserve) / 1e18;
    lines.push(`Liquidity: ${liq.toFixed(2)} MON, Graduated: ${data.curveState.isGraduated}`);
  }

  if (data.trades.length > 0) {
    const buys = data.trades.filter((t) => t.type === "BUY").length;
    const uniqueTraders = new Set(data.trades.filter((t) => t.trader).map((t) => t.trader.toLowerCase())).size;
    lines.push(`Buy ratio: ${((buys / data.trades.length) * 100).toFixed(0)}%, Unique traders: ${uniqueTraders}`);
  }

  if (data.creator) {
    lines.push(`Creator: ${data.creator.slice(0, 10)}..., Tokens deployed: ${data.creatorTokenCount}`);
  }

  if (data.createdAt) {
    const ageH = (Date.now() - new Date(data.createdAt).getTime()) / 3600000;
    lines.push(`Age: ${ageH < 24 ? ageH.toFixed(1) + "h" : (ageH / 24).toFixed(1) + " days"}`);
  }

  return lines.join("\n");
}

/**
 * Plan the initial investigation strategy (before Tier 1).
 */
export async function planInitial(data: CollectedTokenData): Promise<PlannerDecision> {
  const brief = formatTokenBrief(data);

  const aiReasoning = await callDeepSeekAgent(
    `I'm about to investigate this token. Here's what I know so far:\n\n${brief}\n\nBriefly describe what you notice at first glance and what you plan to check. What stands out? What concerns you?`
  );

  const reasoning =
    aiReasoning ||
    `Beginning investigation of $${data.symbol}. Starting primary scan across liquidity, creator history, trading activity, and token maturity.${!data.hasApiData ? " Note: API data is limited." : ""}`;

  return {
    reasoning,
    nextTools: getToolsByTier(1).map((t) => t.id),
  };
}

/**
 * Plan Tier 2 investigation based on Tier 1 findings.
 * Always runs at least whale_concentration + price_impact for thorough analysis.
 */
export async function planTier2(ctx: AgentContext): Promise<PlannerDecision> {
  const tier2Tools = getToolsByTier(2);

  // Determine which tools to run: flag-triggered + always-run base set
  const triggeredIds = new Set(
    tier2Tools.filter((t) => t.shouldRun(ctx.tokenData, ctx)).map((t) => t.id)
  );

  // Always run whale_concentration and price_impact — they provide value for any token
  triggeredIds.add("investigate_whale_concentration");
  triggeredIds.add("investigate_price_impact");

  // If there are any trades at all, also check buy/sell imbalance
  if (ctx.tokenData.trades.length > 0) {
    triggeredIds.add("investigate_buy_sell_imbalance");
  }

  const nextTools = Array.from(triggeredIds);

  // Ask AI to reason about Tier 1 findings
  const findingsText = formatFindings(ctx.findings);
  const brief = formatTokenBrief(ctx.tokenData);

  const aiReasoning = await callDeepSeekAgent(
    `I just completed a primary scan of this token. Here are my findings:\n\n${findingsText}\n\nToken summary:\n${brief}\n\nCurrent risk score: ${ctx.riskScore}/100 (50 = neutral).\nFlags raised: ${ctx.flags.size > 0 ? Array.from(ctx.flags).join(", ") : "none"}.\n\nBased on these findings, what patterns do you see? What concerns you most? I'm about to run deeper investigations: ${nextTools.join(", ")}.`
  );

  const reasoning =
    aiReasoning ||
    buildTier2Fallback(ctx, nextTools);

  return { reasoning, nextTools };
}

/**
 * Plan Tier 3 composite investigation based on Tier 1+2 findings.
 */
export async function planTier3(ctx: AgentContext): Promise<PlannerDecision> {
  const tier3Tools = getToolsByTier(3);
  const triggered = tier3Tools.filter((t) => t.shouldRun(ctx.tokenData, ctx));

  if (triggered.length === 0) {
    // Even with no T3 tools, ask AI for a synthesis
    const findingsText = formatFindings(ctx.findings);

    const aiReasoning = await callDeepSeekAgent(
      `I've completed primary and deep investigation of this token. All findings so far:\n\n${findingsText}\n\nRisk score: ${ctx.riskScore}/100. Flags: ${Array.from(ctx.flags).join(", ") || "none"}.\n\nNo compound risk patterns were detected (serial rug + dead tokens, coordinated pump, dump with no liquidity). Summarize what you've found and your overall risk assessment before I run the scoring models.`
    );

    return {
      reasoning:
        aiReasoning ||
        `Investigation complete across ${ctx.toolsRun.length} tools. Risk score: ${ctx.riskScore}/100. Proceeding to model scoring.`,
      nextTools: [],
    };
  }

  const findingsText = formatFindings(ctx.findings);

  const aiReasoning = await callDeepSeekAgent(
    `I'm seeing compound patterns that need cross-referencing. All findings so far:\n\n${findingsText}\n\nRisk score: ${ctx.riskScore}/100. Flags: ${Array.from(ctx.flags).join(", ")}.\n\nI'm about to run these composite investigations: ${triggered.map((t) => t.name).join(", ")}. What compound risks do you suspect?`
  );

  return {
    reasoning:
      aiReasoning ||
      `Detected compound patterns. Running ${triggered.length} cross-reference investigation(s): ${triggered.map((t) => t.name).join(", ")}.`,
    nextTools: triggered.map((t) => t.id),
  };
}

/**
 * Generate final summary after all tools have run, before scoring models.
 */
export async function planFinalSummary(ctx: AgentContext): Promise<string> {
  const findingsText = formatFindings(ctx.findings);
  const criticals = ctx.findings.filter((f) => f.severity === "critical").length;
  const warnings = ctx.findings.filter((f) => f.severity === "warning").length;

  const aiReasoning = await callDeepSeekAgent(
    `Investigation complete. I ran ${ctx.toolsRun.length} tools. Here are ALL findings:\n\n${findingsText}\n\nFinal risk score: ${ctx.riskScore}/100 (0=safe, 100=dangerous). ${criticals} critical, ${warnings} warning findings.\nFlags: ${Array.from(ctx.flags).join(", ") || "none"}.\n\nGive your final assessment of this token before I run the scoring models. What's the verdict?`,
    500
  );

  return (
    aiReasoning ||
    `Investigation complete. Ran ${ctx.toolsRun.length} tools. Found ${criticals} critical and ${warnings} warning-level findings. Risk score: ${ctx.riskScore}/100. Running scoring models for final assessment.`
  );
}

// === Template fallbacks (used when DeepSeek is unavailable) ===

function buildTier2Fallback(ctx: AgentContext, nextTools: string[]): string {
  const parts: string[] = [];
  parts.push(`Primary scan complete. Running ${nextTools.length} deeper investigations.`);

  if (hasFlag(ctx, "FEW_TRADERS") || hasFlag(ctx, "LOW_TRADER_COUNT")) {
    parts.push("Low trader count detected — checking for whale concentration.");
  }
  if (hasFlag(ctx, "LOW_LIQUIDITY") || hasFlag(ctx, "CRITICALLY_LOW_LIQUIDITY")) {
    parts.push("Liquidity concerns — analyzing price impact across trade sizes.");
  }
  if (hasFlag(ctx, "PUMP_PATTERN")) {
    parts.push("Buy ratio unusually high — investigating coordination.");
  }
  if (hasFlag(ctx, "DUMP_PATTERN")) {
    parts.push("Heavy sell pressure — assessing dump risk.");
  }

  return parts.join(" ");
}
