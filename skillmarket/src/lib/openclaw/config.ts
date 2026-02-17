/**
 * OpenClaw & DeepSeek configuration.
 *
 * The bridge calls DeepSeek's API directly for LLM chat completions
 * (with our custom tool definitions), while the OpenClaw Gateway
 * provides monitoring dashboard and future skill orchestration.
 */

export const OPENCLAW_CONFIG = {
  /** Whether OpenClaw-powered analysis is enabled */
  enabled: process.env.USE_OPENCLAW === "true",

  /** DeepSeek API endpoint (OpenAI-compatible) */
  llmBaseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",

  /** DeepSeek API key */
  llmApiKey: process.env.DEEPSEEK_API_KEY || "",

  /** Model name */
  model: "deepseek-chat",

  /** OpenClaw Gateway URL (for dashboard/monitoring) */
  gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || "http://localhost:18789",

  /** Auth token (shared between Gateway and internal tool API) */
  gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN || "",

  /** Timeout for LLM requests (ms) */
  timeout: 120_000,
} as const;

/** Map skill IDs to OpenClaw skill names */
export const SKILL_MAP: Record<string, string> = {
  "token-investigator": "Token Investigator",
  "whale-tracker": "Whale Tracker",
  "rug-detector": "Rug Detector",
  "liquidity-scout": "Liquidity Scout",
};

/** Default skill when none specified */
export const DEFAULT_SKILL = "token-investigator";
