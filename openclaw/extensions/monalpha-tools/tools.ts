/**
 * monAlpha Investigation Tools for OpenClaw
 *
 * Each tool is a thin HTTP wrapper that calls the monAlpha Next.js
 * internal API (/api/tools/:toolId). The actual analysis logic runs
 * in the Next.js process where viem, nad.fun API, and all analysis
 * code already lives.
 *
 * This architecture avoids duplicating analysis code and keeps a
 * clean separation: OpenClaw = brain, Next.js = hands.
 */

const MONALPHA_API_URL = process.env.MONALPHA_API_URL || "http://localhost:3000";
const INTERNAL_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";

interface ToolCallResult {
  finding: string;
  severity: "info" | "warning" | "critical";
  riskDelta: number;
  details: string[];
  flags?: string[];
  triggerTools?: string[];
  results?: Array<{
    modelId: string;
    modelName: string;
    signal: string;
    score: number;
    confidence: string;
    reasoning: string;
    risks: string[];
  }>;
}

async function callMonAlpha(
  toolId: string,
  params: Record<string, unknown>
): Promise<ToolCallResult> {
  const url = `${MONALPHA_API_URL}/api/tools/${toolId}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-token": INTERNAL_TOKEN,
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tool ${toolId} failed (${res.status}): ${err}`);
  }

  return res.json() as Promise<ToolCallResult>;
}

function formatResult(result: ToolCallResult): string {
  const lines = [
    `**Finding:** ${result.finding}`,
    `**Severity:** ${result.severity}`,
    `**Risk Delta:** ${result.riskDelta > 0 ? "+" : ""}${result.riskDelta}`,
  ];

  if (result.details.length > 0) {
    lines.push("**Details:**");
    for (const d of result.details) {
      lines.push(`  - ${d}`);
    }
  }

  if (result.flags && result.flags.length > 0) {
    lines.push(`**Flags set:** ${result.flags.join(", ")}`);
  }

  if (result.triggerTools && result.triggerTools.length > 0) {
    lines.push(`**Suggested follow-up:** ${result.triggerTools.join(", ")}`);
  }

  if (result.results) {
    lines.push("**Model Scores:**");
    for (const r of result.results) {
      lines.push(`  - ${r.modelName}: ${r.score}/100 — ${r.signal} (${r.confidence})`);
      lines.push(`    ${r.reasoning.slice(0, 200)}`);
    }
  }

  return lines.join("\n");
}

// ============================================================
// Tool Definitions
// ============================================================

const addressSchema = {
  type: "object" as const,
  properties: {
    tokenAddress: {
      type: "string" as const,
      description: "The token contract address on Monad (0x...)",
    },
  },
  required: ["tokenAddress"],
};

const scoreSchema = {
  type: "object" as const,
  properties: {
    tokenAddress: {
      type: "string" as const,
      description: "The token contract address on Monad (0x...)",
    },
    modelIds: {
      type: "array" as const,
      items: { type: "string" as const },
      description:
        "Optional array of model IDs to run. Defaults to all built-in models: rug-detector, whale-tracker, liquidity-scout",
    },
  },
  required: ["tokenAddress"],
};

export const tools = [
  // --- Data Collection ---
  {
    name: "collect_token_data",
    description:
      "Fetch all on-chain and API data for a Monad token. This collects bonding curve state, creator info, trading history, holder count, market data, and more. Always call this first before running any investigation tools.",
    inputSchema: addressSchema,
    async execute(params: Record<string, unknown>) {
      const result = await callMonAlpha("collect_token_data", params);
      return formatResult(result);
    },
  },

  // --- Tier 1: Primary Scan (Always Run) ---
  {
    name: "scan_liquidity",
    description:
      "Analyze bonding curve reserve, graduation progress, and price impact. Checks MON reserves, slippage across trade sizes, and token lock status. Always run this as part of primary scan.",
    inputSchema: addressSchema,
    async execute(params: Record<string, unknown>) {
      const result = await callMonAlpha("scan_liquidity", params);
      return formatResult(result);
    },
  },
  {
    name: "scan_creator",
    description:
      "Analyze the creator wallet history, number of tokens deployed, and track record. Identifies dead tokens, serial deployers, and first-time creators. Always run this as part of primary scan.",
    inputSchema: addressSchema,
    async execute(params: Record<string, unknown>) {
      const result = await callMonAlpha("scan_creator", params);
      return formatResult(result);
    },
  },
  {
    name: "scan_trading_activity",
    description:
      "Analyze buy/sell ratio, unique trader count, and volume patterns. Detects pump signals (>85% buys), dump signals (<20% buys), and wash trading indicators. Always run this as part of primary scan.",
    inputSchema: addressSchema,
    async execute(params: Record<string, unknown>) {
      const result = await callMonAlpha("scan_trading_activity", params);
      return formatResult(result);
    },
  },
  {
    name: "scan_token_maturity",
    description:
      "Analyze token age, holder count, and market cap stage. Flags very new tokens (<1h), low holder counts, and micro-cap risks. Always run this as part of primary scan.",
    inputSchema: addressSchema,
    async execute(params: Record<string, unknown>) {
      const result = await callMonAlpha("scan_token_maturity", params);
      return formatResult(result);
    },
  },

  // --- Tier 2: Conditional Deep Investigation ---
  {
    name: "investigate_whale_concentration",
    description:
      "Deep analysis of trader concentration and whale dominance. Checks top trader volume %, top 3 concentration, and creator self-dealing. Run when few unique traders or low holder count detected.",
    inputSchema: addressSchema,
    async execute(params: Record<string, unknown>) {
      const result = await callMonAlpha("investigate_whale_concentration", params);
      return formatResult(result);
    },
  },
  {
    name: "investigate_price_impact",
    description:
      "Deep analysis of slippage and liquidity depth across 1/10/100 MON trade sizes. Run when low liquidity or high slippage detected in primary scan.",
    inputSchema: addressSchema,
    async execute(params: Record<string, unknown>) {
      const result = await callMonAlpha("investigate_price_impact", params);
      return formatResult(result);
    },
  },
  {
    name: "investigate_wash_trading",
    description:
      "Detect self-trading, round-trip patterns (buy+sell from same wallet), and artificial volume from repeated amounts. Run when repeated trade amounts detected.",
    inputSchema: addressSchema,
    async execute(params: Record<string, unknown>) {
      const result = await callMonAlpha("investigate_wash_trading", params);
      return formatResult(result);
    },
  },
  {
    name: "investigate_buy_sell_imbalance",
    description:
      "Deep analysis of extreme buy or sell pressure patterns. Checks volume distribution, wallet concentration, and coordination signals. Run when pump or dump pattern detected.",
    inputSchema: addressSchema,
    async execute(params: Record<string, unknown>) {
      const result = await callMonAlpha("investigate_buy_sell_imbalance", params);
      return formatResult(result);
    },
  },

  // --- Tier 3: Composite Cross-Reference ---
  {
    name: "investigate_serial_rug_pattern",
    description:
      "Cross-reference creator history with token health. Analyzes dead token ratio across creator's portfolio. Run when serial deployer AND dead tokens both flagged.",
    inputSchema: addressSchema,
    async execute(params: Record<string, unknown>) {
      const result = await callMonAlpha("investigate_serial_rug_pattern", params);
      return formatResult(result);
    },
  },
  {
    name: "investigate_coordinated_pump",
    description:
      "Cross-reference whale activity with pump patterns. Analyzes buy timing, speed (bot detection), and concentration. Run when pump pattern AND whale domination both flagged.",
    inputSchema: addressSchema,
    async execute(params: Record<string, unknown>) {
      const result = await callMonAlpha("investigate_coordinated_pump", params);
      return formatResult(result);
    },
  },
  {
    name: "investigate_dump_risk",
    description:
      "Assess combined dump pressure with low liquidity exit risk. Compares sell volume against available liquidity. Run when dump pattern AND low liquidity both flagged.",
    inputSchema: addressSchema,
    async execute(params: Record<string, unknown>) {
      const result = await callMonAlpha("investigate_dump_risk", params);
      return formatResult(result);
    },
  },

  // --- Final Scoring ---
  {
    name: "score_token",
    description:
      "Run scoring models to produce final risk assessment. Uses built-in models: rug-detector, whale-tracker, liquidity-scout. Call this after all investigation tools are complete.",
    inputSchema: scoreSchema,
    async execute(params: Record<string, unknown>) {
      const result = await callMonAlpha("score_token", params);
      return formatResult(result);
    },
  },
];
