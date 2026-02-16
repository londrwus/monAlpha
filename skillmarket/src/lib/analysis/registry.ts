import type { ModelDefinition } from "./types";
import { computeConfidence } from "./types";
import { serializeTokenData } from "./engine";
import { rugDetector } from "./models/rug-detector";
import { whaleTracker } from "./models/whale-tracker";
import { liquidityScout } from "./models/liquidity-scout";
import { getAllCustomModels, getCustomModel as getStoredCustomModel, incrementUsage } from "../skills/model-store";
import { runCustomScoring } from "../skills/scoring";
import { callDeepSeek } from "../deepseek";
import type { StoredCustomModel } from "../skills/types";

const builtInRegistry = new Map<string, ModelDefinition>([
  ["rug-detector", rugDetector],
  ["whale-tracker", whaleTracker],
  ["liquidity-scout", liquidityScout],
]);

function wrapCustomModel(stored: StoredCustomModel): ModelDefinition {
  const adv = stored.advancedSettings;
  const isDeepResearch = stored.modelType === "DEEP_RESEARCH";

  // Compute effective thresholds (advanced settings override SKILL.md)
  let buyThreshold = adv?.customBuyThreshold ?? stored.parsedSkill.signalLogic.buyThreshold;
  let avoidThreshold = adv?.customAvoidThreshold ?? stored.parsedSkill.signalLogic.avoidThreshold;

  // Apply risk tolerance modifier
  if (adv?.riskTolerance === "conservative") {
    buyThreshold += 10;
    avoidThreshold += 5;
  } else if (adv?.riskTolerance === "aggressive") {
    buyThreshold -= 10;
    avoidThreshold -= 10;
  }

  buyThreshold = Math.max(30, Math.min(95, buyThreshold));
  avoidThreshold = Math.max(10, Math.min(80, avoidThreshold));

  return {
    id: stored.id,
    name: stored.name,
    description: stored.description,
    version: stored.version,
    creator: stored.creator,
    breakdownLabels: stored.parsedSkill.scoringBreakdown.map((c) => c.label),
    run(data) {
      // Pre-run data requirement checks
      if (adv?.requireApiData && !data.hasApiData) {
        incrementUsage(stored.id);
        return {
          modelId: stored.id,
          modelName: stored.name,
          signal: "AVOID" as const,
          score: 15,
          confidence: "LOW" as const,
          breakdown: {},
          reasoning: `Analysis skipped: ${stored.name} requires full API data but nad.fun data was unavailable for this token.`,
          risks: ["Insufficient data — model requires API data to produce reliable scores"],
        };
      }

      if (adv && adv.minTradesRequired > 0 && data.trades.length < adv.minTradesRequired) {
        incrementUsage(stored.id);
        return {
          modelId: stored.id,
          modelName: stored.name,
          signal: "AVOID" as const,
          score: 20,
          confidence: "LOW" as const,
          breakdown: {},
          reasoning: `Analysis skipped: ${stored.name} requires at least ${adv.minTradesRequired} trades but only ${data.trades.length} found.`,
          risks: [`Insufficient trade data (${data.trades.length}/${adv.minTradesRequired} required)`],
        };
      }

      // Deep Research: async path using DeepSeek
      if (isDeepResearch) {
        const serialized = serializeTokenData(data);
        const categories = stored.parsedSkill.scoringBreakdown.map((c) => c.label);

        return callDeepSeek(
          stored.parsedSkill.aiSystemPrompt,
          serialized,
          categories,
          { buyThreshold, avoidThreshold }
        ).then((result) => {
          incrementUsage(stored.id);
          return {
            modelId: stored.id,
            modelName: stored.name,
            signal: result.signal,
            score: result.score,
            confidence: result.confidence,
            breakdown: result.breakdown,
            reasoning: result.reasoning,
            risks: result.risks,
            isAIPowered: true,
          };
        }).catch((err) => {
          incrementUsage(stored.id);
          return {
            modelId: stored.id,
            modelName: stored.name,
            signal: "AVOID" as const,
            score: 0,
            confidence: "LOW" as const,
            breakdown: {},
            reasoning: `Deep Research analysis failed: ${String(err)}. Check DEEPSEEK_API_KEY configuration.`,
            risks: ["AI analysis failed — results unavailable"],
            isAIPowered: true,
          };
        });
      }

      // Standard Research: deterministic scoring path
      const result = runCustomScoring(data, stored.parsedSkill.scoringBreakdown);
      incrementUsage(stored.id);

      const signal = result.totalScore >= buyThreshold
        ? "BUY" as const
        : result.totalScore >= avoidThreshold
          ? "WATCH" as const
          : "AVOID" as const;

      const parts: string[] = [`Custom analysis for $${data.symbol} using ${stored.name}.`];
      if (data.holderCount > 0) parts.push(`${data.holderCount} holders.`);
      if (data.hasApiData) parts.push(`Creator has ${data.creatorTokenCount} token(s).`);
      if (result.unmatchedLabels.length > 0) {
        parts.push(`Note: categories [${result.unmatchedLabels.join(", ")}] used neutral scoring.`);
      }
      if (adv?.riskTolerance && adv.riskTolerance !== "moderate") {
        parts.push(`Risk profile: ${adv.riskTolerance}.`);
      }

      return {
        modelId: stored.id,
        modelName: stored.name,
        signal,
        score: result.totalScore,
        confidence: computeConfidence(result.totalScore),
        breakdown: result.breakdown,
        reasoning: parts.join(" "),
        risks: result.risks,
      };
    },
  };
}

export function getModel(id: string): ModelDefinition | undefined {
  const builtIn = builtInRegistry.get(id);
  if (builtIn) return builtIn;

  const stored = getStoredCustomModel(id);
  if (stored) return wrapCustomModel(stored);

  return undefined;
}

export function getAllModels(): ModelDefinition[] {
  const builtIn = Array.from(builtInRegistry.values());
  const custom = getAllCustomModels().map(wrapCustomModel);
  return [...builtIn, ...custom];
}

export function getModelIds(): string[] {
  const builtIn = Array.from(builtInRegistry.keys());
  const custom = getAllCustomModels().map((m) => m.id);
  return [...builtIn, ...custom];
}

export function isBuiltIn(id: string): boolean {
  return builtInRegistry.has(id);
}
