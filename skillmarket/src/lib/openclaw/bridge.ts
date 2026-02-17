/**
 * OpenClaw Bridge — connects monAlpha to OpenClaw Gateway
 *
 * Implements a proper multi-turn agent loop:
 * 1. Send message to OpenClaw Gateway (OpenAI-compatible API)
 * 2. Stream response — collect reasoning + tool calls
 * 3. Execute tool calls locally via internal API
 * 4. Append tool results to conversation and loop back to step 1
 * 5. Repeat until LLM returns finish_reason="stop"
 */

import { OPENCLAW_CONFIG, SKILL_MAP, DEFAULT_SKILL } from "./config";
import { collectTokenData } from "@/lib/analysis/collector";
import { serializeTokenData } from "@/lib/analysis/engine";
import { getRiskSignal } from "@/lib/analysis/agent-context";
import type { AgentSSEEvent } from "@/lib/analysis/agent-types";

// OpenAI message types
interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: AssistantToolCall[];
  tool_call_id?: string;
}

interface AssistantToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

// Tool call state tracked during streaming
interface PendingToolCall {
  index: number;
  id: string;
  name: string;
  arguments: string;
}

// Risk tracking across the session
interface RiskState {
  score: number;
  components: Record<string, number>;
  flags: string[];
  toolsRun: string[];
}

// Result from executing a tool locally
interface ToolExecResult {
  toolCallId: string;
  toolName: string;
  content: string; // JSON string to send back to LLM
  finding: string;
  severity: string;
  riskDelta: number;
  details: string[];
  flags: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results?: any[]; // for score_token
}

const MAX_TURNS = 12; // safety limit

/**
 * Run analysis via OpenClaw Gateway with SSE streaming.
 * Implements a multi-turn agent loop with tool execution.
 */
export async function runOpenClawAnalysis(
  tokenAddress: string,
  modelIds: string[],
  emit: (event: AgentSSEEvent) => void,
  skillId?: string
): Promise<void> {
  const { llmBaseUrl, llmApiKey, model, timeout } = OPENCLAW_CONFIG;
  const resolvedSkill = skillId || DEFAULT_SKILL;
  const skillName = SKILL_MAP[resolvedSkill] || resolvedSkill;

  const risk: RiskState = {
    score: 50,
    components: {},
    flags: [],
    toolsRun: [],
  };

  emit({
    type: "step",
    step: "Connecting to research agent",
    status: "running",
    timestamp: Date.now(),
  });

  // Build initial messages
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(skillName, tokenAddress, modelIds) },
    {
      role: "user",
      content: `Investigate token ${tokenAddress} on Monad blockchain. Use the ${skillName} strategy. Available model IDs for scoring: ${modelIds.join(", ")}.`,
    },
  ];

  const tools = buildToolDefinitions();

  emit({
    type: "step",
    step: "Connecting to research agent",
    status: "complete",
    detail: `Using ${skillName} strategy via DeepSeek`,
    timestamp: Date.now(),
  });

  // === Multi-turn agent loop ===
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let response: Response;
    try {
      response = await fetch(`${llmBaseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llmApiKey}`,
        },
        body: JSON.stringify({
          model,
          stream: true,
          messages,
          tools,
          tool_choice: "auto",
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      emit({
        type: "step",
        step: "Research agent",
        status: "error",
        detail: `DeepSeek API unavailable: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      });
      throw new Error(`DeepSeek API unavailable: ${err instanceof Error ? err.message : String(err)}`);
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown");
      throw new Error(`DeepSeek API error (${response.status}): ${errText}`);
    }

    // Parse the streaming response
    const { assistantContent, toolCalls, finishReason } = await parseStreamResponse(
      response,
      emit,
      risk
    );

    // Append assistant message to conversation history
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: assistantContent || null,
    };
    if (toolCalls.length > 0) {
      assistantMsg.tool_calls = toolCalls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.arguments },
      }));
    }
    messages.push(assistantMsg);

    // If no tool calls, we're done
    if (toolCalls.length === 0 || finishReason === "stop") {
      break;
    }

    // Execute tool calls and append results
    const toolResults = await executeAllToolCalls(
      toolCalls,
      emit,
      risk,
      tokenAddress,
      modelIds
    );

    // Emit confidence after each batch of tool calls
    if (risk.toolsRun.length > 0) {
      emit({
        type: "confidence",
        riskScore: risk.score,
        signal: getRiskSignal(risk.score),
        components: { ...risk.components },
        timestamp: Date.now(),
      });
    }

    // Append tool results as messages for next turn
    for (const result of toolResults) {
      messages.push({
        role: "tool",
        tool_call_id: result.toolCallId,
        content: result.content,
      });

      // Emit score_token results
      if (result.results) {
        for (const r of result.results) {
          emit({
            type: "result",
            modelId: r.modelId,
            modelName: r.modelName,
            signal: r.signal,
            score: r.score,
            confidence: r.confidence,
            reasoning: r.reasoning,
            risks: r.risks,
            breakdown: r.breakdown || {},
            isAIPowered: r.isAIPowered,
          });
        }
      }
    }
  }

  // Emit final done event
  try {
    const data = await collectTokenData(tokenAddress);
    const tokenData = serializeTokenData(data);
    emit({
      type: "done",
      tokenData,
      tokenInfo: {
        name: data.name,
        symbol: data.symbol,
        address: data.address,
        imageUrl: data.imageUrl,
      },
      totalModels: modelIds.length,
      timestamp: Date.now(),
    });
  } catch {
    emit({
      type: "done",
      tokenData: {} as ReturnType<typeof serializeTokenData>,
      tokenInfo: { name: "", symbol: "", address: tokenAddress, imageUrl: "" },
      totalModels: modelIds.length,
      timestamp: Date.now(),
    });
  }
}

// ============================================================
// Stream Parser
// ============================================================

async function parseStreamResponse(
  response: Response,
  emit: (event: AgentSSEEvent) => void,
  risk: RiskState
): Promise<{
  assistantContent: string;
  toolCalls: PendingToolCall[];
  finishReason: string;
}> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body from Gateway");

  const decoder = new TextDecoder();
  let buffer = "";
  let contentBuffer = "";
  let reasoningChunk = "";
  const pendingToolCalls: Map<number, PendingToolCall> = new Map();
  let finishReason = "stop";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;

        let chunk;
        try {
          chunk = JSON.parse(trimmed.slice(6));
        } catch {
          continue;
        }

        const choice = chunk.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta;
        if (!delta) continue;

        // Content (reasoning)
        if (delta.content) {
          contentBuffer += delta.content;
          reasoningChunk += delta.content;

          // Emit thinking in reasonable chunks
          if (reasoningChunk.length > 80 || reasoningChunk.includes("\n")) {
            emit({
              type: "thinking",
              reasoning: reasoningChunk.trim(),
              nextTools: [],
              timestamp: Date.now(),
            });
            reasoningChunk = "";
          }
        }

        // Tool calls
        if (delta.tool_calls) {
          // Flush remaining reasoning before tool calls
          if (reasoningChunk.trim()) {
            emit({
              type: "thinking",
              reasoning: reasoningChunk.trim(),
              nextTools: [],
              timestamp: Date.now(),
            });
            reasoningChunk = "";
          }

          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;

            if (tc.id) {
              // New tool call
              pendingToolCalls.set(idx, {
                index: idx,
                id: tc.id,
                name: tc.function?.name || "",
                arguments: tc.function?.arguments || "",
              });

              if (tc.function?.name) {
                emit({
                  type: "tool_call",
                  toolId: tc.function.name,
                  toolName: formatToolName(tc.function.name),
                  tier: getToolTier(tc.function.name),
                  status: "running",
                  timestamp: Date.now(),
                });
              }
            } else {
              // Accumulate arguments
              const pending = pendingToolCalls.get(idx);
              if (pending) {
                if (tc.function?.arguments) pending.arguments += tc.function.arguments;
                if (tc.function?.name && !pending.name) pending.name = tc.function.name;
              }
            }
          }
        }

        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Flush final reasoning
  if (reasoningChunk.trim()) {
    emit({
      type: "thinking",
      reasoning: reasoningChunk.trim(),
      nextTools: [],
      timestamp: Date.now(),
    });
  }

  return {
    assistantContent: contentBuffer,
    toolCalls: Array.from(pendingToolCalls.values()),
    finishReason,
  };
}

// ============================================================
// Tool Execution
// ============================================================

async function executeAllToolCalls(
  toolCalls: PendingToolCall[],
  emit: (event: AgentSSEEvent) => void,
  risk: RiskState,
  tokenAddress: string,
  modelIds: string[]
): Promise<ToolExecResult[]> {
  const results: ToolExecResult[] = [];

  for (const tc of toolCalls) {
    const result = await executeSingleTool(tc, emit, risk, tokenAddress, modelIds);
    results.push(result);
  }

  return results;
}

async function executeSingleTool(
  pending: PendingToolCall,
  emit: (event: AgentSSEEvent) => void,
  risk: RiskState,
  tokenAddress: string,
  modelIds: string[]
): Promise<ToolExecResult> {
  const toolName = pending.name;
  const tier = getToolTier(toolName);

  // Parse arguments
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(pending.arguments || "{}");
  } catch {
    args = { tokenAddress };
  }

  if (!args.tokenAddress) args.tokenAddress = tokenAddress;
  if (toolName === "score_token" && !args.modelIds) args.modelIds = modelIds;

  const internalUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/tools/${toolName}`;

  try {
    const res = await fetch(internalUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-token": OPENCLAW_CONFIG.gatewayToken,
      },
      body: JSON.stringify(args),
    });

    if (!res.ok) {
      const errText = await res.text();
      const errorResult = {
        toolCallId: pending.id,
        toolName,
        content: JSON.stringify({ error: errText }),
        finding: `Tool failed: ${errText}`,
        severity: "warning",
        riskDelta: 0,
        details: [] as string[],
        flags: [] as string[],
      };

      emit({
        type: "tool_call",
        toolId: toolName,
        toolName: formatToolName(toolName),
        tier,
        status: "complete",
        finding: errorResult.finding,
        severity: "warning",
        details: [],
        riskDelta: 0,
        timestamp: Date.now(),
      });

      return errorResult;
    }

    const result = await res.json();

    // Update risk
    const riskDelta = result.riskDelta || 0;
    risk.score = Math.max(0, Math.min(100, risk.score + riskDelta));
    risk.components[toolName] = riskDelta;
    risk.toolsRun.push(toolName);
    if (result.flags) risk.flags.push(...result.flags);

    // Emit tool_call complete
    emit({
      type: "tool_call",
      toolId: toolName,
      toolName: formatToolName(toolName),
      tier,
      status: "complete",
      finding: result.finding || "Analysis complete",
      severity: result.severity || "info",
      details: result.details || [],
      riskDelta,
      timestamp: Date.now(),
    });

    // Build the content string that goes back to the LLM
    const contentForLLM = JSON.stringify({
      finding: result.finding,
      severity: result.severity,
      riskDelta: result.riskDelta,
      details: result.details,
      flags: result.flags,
      currentRiskScore: risk.score,
    });

    return {
      toolCallId: pending.id,
      toolName,
      content: contentForLLM,
      finding: result.finding || "",
      severity: result.severity || "info",
      riskDelta,
      details: result.details || [],
      flags: result.flags || [],
      results: result.results, // for score_token
    };
  } catch (err) {
    const errorContent = JSON.stringify({
      error: err instanceof Error ? err.message : String(err),
    });

    emit({
      type: "tool_call",
      toolId: toolName,
      toolName: formatToolName(toolName),
      tier,
      status: "complete",
      finding: `Internal error: ${err instanceof Error ? err.message : String(err)}`,
      severity: "warning",
      details: [],
      riskDelta: 0,
      timestamp: Date.now(),
    });

    return {
      toolCallId: pending.id,
      toolName,
      content: errorContent,
      finding: "Tool execution error",
      severity: "warning",
      riskDelta: 0,
      details: [],
      flags: [],
    };
  }
}

// ============================================================
// Helpers
// ============================================================

function buildSystemPrompt(skillName: string, tokenAddress: string, modelIds: string[]): string {
  return `You are monAlpha's autonomous research agent. You are using the "${skillName}" investigation strategy.

Your task: Investigate token ${tokenAddress} on the Monad blockchain to determine its safety and quality.

You have access to 13 investigation tools. Use them according to your strategy:
1. Start with collect_token_data to fetch all on-chain data
2. Run primary scans (scan_liquidity, scan_creator, scan_trading_activity, scan_token_maturity)
3. Based on findings, run conditional deep investigations
4. If compound patterns emerge, run composite analysis
5. End with score_token to get final scores (modelIds: ${modelIds.join(", ")})

Think step-by-step. Explain your reasoning between tool calls. Be specific with data.
Risk scoring: starts at 50 (neutral). Each tool reports riskDelta. SAFE=0-33, CAUTION=34-66, DANGER=67-100.

IMPORTANT: After receiving tool results, analyze them and decide what to investigate next. When you have gathered enough data, call score_token and then provide your final summary.`;
}

function buildToolDefinitions() {
  const addressParam = {
    type: "object" as const,
    properties: {
      tokenAddress: {
        type: "string" as const,
        description: "The token contract address on Monad (0x...)",
      },
    },
    required: ["tokenAddress"],
  };

  const scoreParam = {
    type: "object" as const,
    properties: {
      tokenAddress: {
        type: "string" as const,
        description: "The token contract address on Monad (0x...)",
      },
      modelIds: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "Model IDs to run (rug-detector, whale-tracker, liquidity-scout)",
      },
    },
    required: ["tokenAddress"],
  };

  const toolDefs = [
    { name: "collect_token_data", description: "Fetch all on-chain and API data for a Monad token. Call first.", parameters: addressParam },
    { name: "scan_liquidity", description: "Analyze bonding curve reserve, graduation progress, and price impact", parameters: addressParam },
    { name: "scan_creator", description: "Analyze creator wallet history, token count, and track record", parameters: addressParam },
    { name: "scan_trading_activity", description: "Analyze buy/sell ratio, unique traders, and volume patterns", parameters: addressParam },
    { name: "scan_token_maturity", description: "Analyze token age, holder count, and market cap stage", parameters: addressParam },
    { name: "investigate_whale_concentration", description: "Deep analysis of trader concentration and whale dominance", parameters: addressParam },
    { name: "investigate_price_impact", description: "Deep analysis of slippage and liquidity depth", parameters: addressParam },
    { name: "investigate_wash_trading", description: "Detect self-trading and round-trip patterns", parameters: addressParam },
    { name: "investigate_buy_sell_imbalance", description: "Deep analysis of extreme buy or sell pressure", parameters: addressParam },
    { name: "investigate_serial_rug_pattern", description: "Cross-reference creator history with token health", parameters: addressParam },
    { name: "investigate_coordinated_pump", description: "Cross-reference whale activity with pump patterns", parameters: addressParam },
    { name: "investigate_dump_risk", description: "Assess dump pressure with low liquidity exit risk", parameters: addressParam },
    { name: "score_token", description: "Run scoring models for final risk assessment", parameters: scoreParam },
  ];

  return toolDefs.map((t) => ({
    type: "function" as const,
    function: t,
  }));
}

function getToolTier(toolName: string): 1 | 2 | 3 {
  const tier1 = ["scan_liquidity", "scan_creator", "scan_trading_activity", "scan_token_maturity", "collect_token_data"];
  const tier2 = ["investigate_whale_concentration", "investigate_price_impact", "investigate_wash_trading", "investigate_buy_sell_imbalance"];
  if (tier1.includes(toolName)) return 1;
  if (tier2.includes(toolName)) return 2;
  return 3;
}

function formatToolName(toolId: string): string {
  return toolId
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
