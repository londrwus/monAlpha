import { collectTokenData } from "./collector";
import { getModel } from "./registry";
import { analysisStore } from "./store";
import { serializeTokenData } from "./engine";
import { createAgentContext, addFinding, addToolRun, shiftRisk, getRiskSignal } from "./agent-context";
import { getToolById } from "./agent-tools";
import { planInitial, planTier2, planTier3, planFinalSummary } from "./agent-planner";
import type { AgentSSEEvent } from "./agent-types";
import type { AnalysisResult, CollectedTokenData } from "./types";

let idCounter = 0;
function generateId(): string {
  idCounter++;
  return `analysis_${Date.now()}_${idCounter}`;
}

/** Small delay for visual streaming effect */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run the full agentic investigation loop.
 * Emits SSE events as the agent progresses through tiered investigation.
 */
export async function runAgentLoop(
  tokenAddress: string,
  modelIds: string[],
  emit: (event: AgentSSEEvent) => void
): Promise<void> {
  const now = Date.now();

  // Validate models
  const validModels = modelIds
    .map((id) => getModel(id))
    .filter((m) => m !== undefined);

  if (validModels.length === 0) {
    emit({ type: "error", message: "No valid model IDs provided" });
    return;
  }

  // Step 1: Collect on-chain data
  emit({ type: "step", step: "Collecting on-chain data", status: "running", timestamp: Date.now() });

  let data: CollectedTokenData;
  try {
    data = await collectTokenData(tokenAddress);
    emit({
      type: "step",
      step: "Collecting on-chain data",
      status: "complete",
      detail: `Found $${data.symbol} — ${data.trades.length} bonding curve trades, ${data.holderCount.toLocaleString()} holders${(data.curveState?.isGraduated || data.isGraduatedApi) ? " (graduated)" : ""}`,
      timestamp: Date.now(),
    });
  } catch (err) {
    emit({ type: "step", step: "Collecting on-chain data", status: "error", detail: String(err), timestamp: Date.now() });
    emit({ type: "error", message: `Data collection failed: ${err instanceof Error ? err.message : err}` });
    return;
  }

  // Initialize agent context
  const ctx = createAgentContext(data);

  // === THINKING: Plan initial investigation (AI-powered) ===
  const initialPlan = await planInitial(data);
  emit({
    type: "thinking",
    reasoning: initialPlan.reasoning,
    nextTools: initialPlan.nextTools,
    timestamp: Date.now(),
  });

  // === TIER 1: Primary Scan (always run all 4) ===
  for (const toolId of initialPlan.nextTools) {
    const tool = getToolById(toolId);
    if (!tool) continue;

    emit({
      type: "tool_call",
      toolId: tool.id,
      toolName: tool.name,
      tier: tool.tier,
      status: "running",
      timestamp: Date.now(),
    });

    await delay(100);

    const result = tool.run(data, ctx);
    addFinding(ctx, {
      toolId: tool.id,
      toolName: tool.name,
      severity: result.severity,
      finding: result.finding,
      details: result.details,
      timestamp: Date.now(),
    });
    addToolRun(ctx, tool.id);
    shiftRisk(ctx, tool.id, result.riskDelta);

    emit({
      type: "tool_call",
      toolId: tool.id,
      toolName: tool.name,
      tier: tool.tier,
      status: "complete",
      finding: result.finding,
      severity: result.severity,
      details: result.details,
      riskDelta: result.riskDelta,
      timestamp: Date.now(),
    });

    await delay(100);
  }

  ctx.tier1Complete = true;

  // Emit confidence after Tier 1
  emit({
    type: "confidence",
    riskScore: ctx.riskScore,
    signal: getRiskSignal(ctx.riskScore),
    components: { ...ctx.riskComponents },
    timestamp: Date.now(),
  });

  await delay(200);

  // === THINKING: Plan Tier 2 (AI-powered) ===
  const tier2Plan = await planTier2(ctx);
  emit({
    type: "thinking",
    reasoning: tier2Plan.reasoning,
    nextTools: tier2Plan.nextTools,
    timestamp: Date.now(),
  });

  // === TIER 2: Deep Investigation (always runs at least core tools) ===
  for (const toolId of tier2Plan.nextTools) {
    const tool = getToolById(toolId);
    if (!tool) continue;

    emit({
      type: "tool_call",
      toolId: tool.id,
      toolName: tool.name,
      tier: tool.tier,
      status: "running",
      timestamp: Date.now(),
    });

    await delay(100);

    const result = tool.run(data, ctx);
    addFinding(ctx, {
      toolId: tool.id,
      toolName: tool.name,
      severity: result.severity,
      finding: result.finding,
      details: result.details,
      timestamp: Date.now(),
    });
    addToolRun(ctx, tool.id);
    shiftRisk(ctx, tool.id, result.riskDelta);

    emit({
      type: "tool_call",
      toolId: tool.id,
      toolName: tool.name,
      tier: tool.tier,
      status: "complete",
      finding: result.finding,
      severity: result.severity,
      details: result.details,
      riskDelta: result.riskDelta,
      timestamp: Date.now(),
    });

    await delay(100);
  }

  ctx.tier2Complete = true;

  // Emit confidence after Tier 2
  emit({
    type: "confidence",
    riskScore: ctx.riskScore,
    signal: getRiskSignal(ctx.riskScore),
    components: { ...ctx.riskComponents },
    timestamp: Date.now(),
  });

  await delay(200);

  // === THINKING: Plan Tier 3 (AI-powered) ===
  const tier3Plan = await planTier3(ctx);
  emit({
    type: "thinking",
    reasoning: tier3Plan.reasoning,
    nextTools: tier3Plan.nextTools,
    timestamp: Date.now(),
  });

  // === TIER 3: Composite Analysis ===
  if (tier3Plan.nextTools.length > 0) {
    for (const toolId of tier3Plan.nextTools) {
      const tool = getToolById(toolId);
      if (!tool) continue;

      emit({
        type: "tool_call",
        toolId: tool.id,
        toolName: tool.name,
        tier: tool.tier,
        status: "running",
        timestamp: Date.now(),
      });

      await delay(100);

      const result = tool.run(data, ctx);
      addFinding(ctx, {
        toolId: tool.id,
        toolName: tool.name,
        severity: result.severity,
        finding: result.finding,
        details: result.details,
        timestamp: Date.now(),
      });
      addToolRun(ctx, tool.id);
      shiftRisk(ctx, tool.id, result.riskDelta);

      emit({
        type: "tool_call",
        toolId: tool.id,
        toolName: tool.name,
        tier: tool.tier,
        status: "complete",
        finding: result.finding,
        severity: result.severity,
        details: result.details,
        riskDelta: result.riskDelta,
        timestamp: Date.now(),
      });

      await delay(100);
    }

    // Emit confidence after Tier 3
    emit({
      type: "confidence",
      riskScore: ctx.riskScore,
      signal: getRiskSignal(ctx.riskScore),
      components: { ...ctx.riskComponents },
      timestamp: Date.now(),
    });

    await delay(200);
  }

  // === THINKING: Final AI summary before scoring models ===
  const finalSummary = await planFinalSummary(ctx);
  emit({
    type: "thinking",
    reasoning: finalSummary,
    nextTools: validModels.map((m) => m.id),
    timestamp: Date.now(),
  });

  // === Run scoring models ===
  const tokenData = serializeTokenData(data);

  for (const model of validModels) {
    emit({ type: "step", step: `Running ${model.name}`, status: "running", timestamp: Date.now() });

    try {
      const partial = await Promise.resolve(model.run(data));

      const result: AnalysisResult = {
        analysisId: generateId(),
        tokenAddress: data.address,
        tokenName: data.name,
        tokenSymbol: data.symbol,
        tokenImageUrl: data.imageUrl,
        timestamp: now,
        ...partial,
      };

      analysisStore.addAnalysis(result);

      emit({
        type: "step",
        step: `Running ${model.name}`,
        status: "complete",
        detail: `Score: ${result.score}/100 — ${result.signal}`,
        timestamp: Date.now(),
      });

      emit({
        type: "result",
        modelId: result.modelId,
        modelName: result.modelName,
        signal: result.signal,
        score: result.score,
        confidence: result.confidence,
        reasoning: result.reasoning,
        risks: result.risks,
        breakdown: result.breakdown,
        isAIPowered: result.isAIPowered,
      });
    } catch (err) {
      emit({
        type: "step",
        step: `Running ${model.name}`,
        status: "error",
        detail: `Failed: ${err instanceof Error ? err.message : err}`,
        timestamp: Date.now(),
      });
    }
  }

  // === Done ===
  emit({
    type: "done",
    tokenData,
    tokenInfo: {
      name: data.name,
      symbol: data.symbol,
      address: data.address,
      imageUrl: data.imageUrl,
    },
    totalModels: validModels.length,
    timestamp: Date.now(),
  });
}
