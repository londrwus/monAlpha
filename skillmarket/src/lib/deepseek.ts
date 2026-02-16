import type { SerializedTokenData } from "./analysis/types";
import type { Signal, Confidence } from "./analysis/types";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

export interface DeepSeekAnalysis {
  signal: Signal;
  score: number;
  confidence: Confidence;
  reasoning: string;
  risks: string[];
  breakdown: Record<string, number>;
  thoughts?: string[];
}

// Cache: 5 min per (token + modelId)
const cache = new Map<string, { data: DeepSeekAnalysis; ts: number }>();
const CACHE_TTL = 300_000;

function formatTokenSummary(data: SerializedTokenData): string {
  const lines: string[] = [
    `Token: ${data.name} (${data.symbol})`,
    `Address: ${data.address}`,
    `Created: ${data.createdAt || "unknown"}`,
    `Graduated to DEX: ${data.isGraduated ? "Yes" : "No"}`,
    "",
    "== Market Data ==",
    `Price: $${data.priceUsd} (${data.priceMon} MON)`,
    `Market Cap: $${data.marketCapUsd}`,
    `24h Volume: $${data.volume24h}`,
    `Holders: ${data.holderCount}`,
    `ATH Price: $${data.athPrice}`,
    "",
    "== Liquidity ==",
    `Bonding Curve Reserve: ${data.realMonReserve} MON`,
    `Graduation Progress: ${data.graduationProgress !== null ? data.graduationProgress.toFixed(1) + "%" : "N/A"}`,
    `Locked: ${data.isLocked}`,
  ];

  if (data.priceImpact.buy1Mon || data.priceImpact.buy100Mon) {
    lines.push(
      "",
      "== Price Impact ==",
      `1 MON buy: ${data.priceImpact.buy1Mon || "N/A"} tokens`,
      `10 MON buy: ${data.priceImpact.buy10Mon || "N/A"} tokens`,
      `100 MON buy: ${data.priceImpact.buy100Mon || "N/A"} tokens`,
    );
  }

  lines.push(
    "",
    "== Trading Activity ==",
    `Total Trades: ${data.totalTrades}`,
    `Buys: ${data.buyCount}, Sells: ${data.sellCount}`,
    `Unique Traders: ${data.uniqueTraders}`,
  );

  if (data.metrics.h1) {
    lines.push(
      "",
      "== 1h Metrics ==",
      `Change: ${data.metrics.h1.percent}%`,
      `Transactions: ${data.metrics.h1.transactions}`,
      `Volume: $${data.metrics.h1.volume}`,
      `Makers: ${data.metrics.h1.makers}`,
    );
  }

  if (data.metrics.d1) {
    lines.push(
      "",
      "== 24h Metrics ==",
      `Change: ${data.metrics.d1.percent}%`,
      `Transactions: ${data.metrics.d1.transactions}`,
      `Volume: $${data.metrics.d1.volume}`,
      `Makers: ${data.metrics.d1.makers}`,
    );
  }

  lines.push(
    "",
    "== Creator ==",
    `Creator: ${data.creatorTokenCount} total tokens created`,
  );
  if (data.creatorTokens.length > 0) {
    lines.push("Creator's other tokens:");
    for (const ct of data.creatorTokens.slice(0, 5)) {
      lines.push(`  - ${ct.name} (${ct.symbol}): MCap $${ct.marketCapUsd}`);
    }
  }

  if (data.recentTrades.length > 0) {
    lines.push("", "== Recent Trades (last 10) ==");
    for (const t of data.recentTrades.slice(0, 10)) {
      lines.push(`  ${t.type} ${t.amountMon} MON by ${t.trader?.slice(0, 10)}... at $${t.priceUsd}`);
    }
  }

  lines.push(
    "",
    `Total Supply: ${data.totalSupply}`,
    `API Data Available: ${data.hasApiData}`,
  );

  return lines.join("\n");
}

// === Lightweight agent reasoning call (for thinking between tiers) ===

export interface AgentReasoningResult {
  reasoning: string;
  nextTools: string[];
  riskAssessment?: string;
}

/**
 * Call DeepSeek for agent reasoning between investigation tiers.
 * Returns AI-generated reasoning about findings and what to investigate next.
 * Falls back to null if API key not set (caller should use template fallback).
 */
export async function callDeepSeekAgent(
  prompt: string,
  maxTokens: number = 400
): Promise<string | null> {
  if (!DEEPSEEK_API_KEY) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are monAlpha, an autonomous on-chain investigation agent analyzing memecoins on the Monad blockchain (nad.fun). " +
              "You speak in first person, concisely. You are analytical and direct. " +
              "Write 2-4 sentences max. No markdown, no bullet points. Just plain reasoning.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function callDeepSeek(
  systemPrompt: string,
  tokenData: SerializedTokenData,
  categories: string[],
  signalLogic: { buyThreshold: number; avoidThreshold: number }
): Promise<DeepSeekAnalysis> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY not configured. Add it to .env.local to enable AI-powered analysis.");
  }

  // Check cache
  const cacheKey = `${tokenData.address}:${systemPrompt.slice(0, 50)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const tokenSummary = formatTokenSummary(tokenData);

  const systemMessage = `${systemPrompt}

You are analyzing a token on the Monad blockchain (nad.fun platform). Provide your analysis as a JSON object with this exact structure:
{
  "thoughts": ["Step 1: <your first reasoning step>", "Step 2: ...", "Step 3: ..."],
  "signal": "BUY" or "WATCH" or "AVOID",
  "score": <number 0-100>,
  "confidence": "LOW" or "MEDIUM" or "HIGH",
  "reasoning": "<2-4 sentences explaining your analysis>",
  "risks": ["<risk 1>", "<risk 2>", ...],
  "breakdown": {${categories.length > 0 ? categories.map(c => `"${c}": <score 0-100>`).join(", ") : '"Overall": <score 0-100>'}}
}

The "thoughts" field should contain 3-6 steps showing your reasoning chain (e.g. "Step 1: Checking holder distribution...", "Step 2: Evaluating liquidity depth...").
Signal thresholds: BUY if score >= ${signalLogic.buyThreshold}, AVOID if score < ${signalLogic.avoidThreshold}, WATCH otherwise.
${categories.length > 0 ? `Score each category from 0-100: ${categories.join(", ")}` : ""}
Be data-driven. If data is missing, lower your confidence and score accordingly.`;

  const userMessage = `Analyze this token:\n\n${tokenSummary}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`DeepSeek API ${res.status}: ${text}`);
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from DeepSeek");

    const parsed = JSON.parse(content) as Record<string, unknown>;

    // Validate and sanitize
    const validSignals: Signal[] = ["BUY", "WATCH", "AVOID"];
    const validConfidences: Confidence[] = ["LOW", "MEDIUM", "HIGH"];

    const score = Math.max(0, Math.min(100, Number(parsed.score) || 50));
    const signal = validSignals.includes(parsed.signal as Signal)
      ? (parsed.signal as Signal)
      : score >= signalLogic.buyThreshold ? "BUY" : score >= signalLogic.avoidThreshold ? "WATCH" : "AVOID";
    const confidence = validConfidences.includes(parsed.confidence as Confidence)
      ? (parsed.confidence as Confidence)
      : "MEDIUM";

    const thoughts = Array.isArray(parsed.thoughts)
      ? (parsed.thoughts as unknown[]).map(String).slice(0, 8)
      : undefined;

    const result: DeepSeekAnalysis = {
      signal,
      score,
      confidence,
      reasoning: String(parsed.reasoning || "AI analysis completed."),
      risks: Array.isArray(parsed.risks)
        ? (parsed.risks as unknown[]).map(String).slice(0, 10)
        : [],
      thoughts,
      breakdown: typeof parsed.breakdown === "object" && parsed.breakdown !== null
        ? Object.fromEntries(
            Object.entries(parsed.breakdown as Record<string, unknown>)
              .map(([k, v]) => [k, Math.max(0, Math.min(100, Number(v) || 50))])
          )
        : {},
    };

    cache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  } finally {
    clearTimeout(timeout);
  }
}
