import type { AnalysisResult, ModelStats, Signal } from "./types";
import { getAllModels } from "./registry";
import { JsonStore } from "../storage/json-store";

const MAX_ANALYSES = 2000;

interface AnalysisStoreData {
  analyses: AnalysisResult[];
}

const store = new JsonStore<AnalysisStoreData>("analyses.json", { analyses: [] });

class AnalysisStore {
  addAnalysis(analysis: AnalysisResult): void {
    store.update((data) => {
      const analyses = [analysis, ...data.analyses];
      if (analyses.length > MAX_ANALYSES) analyses.length = MAX_ANALYSES;
      return { analyses };
    });
  }

  getRecent(limit: number): AnalysisResult[] {
    return store.get().analyses.slice(0, limit);
  }

  getByToken(tokenAddress: string): AnalysisResult[] {
    const key = tokenAddress.toLowerCase();
    return store.get().analyses.filter((a) => a.tokenAddress.toLowerCase() === key);
  }

  getByModel(modelId: string): AnalysisResult[] {
    return store.get().analyses.filter((a) => a.modelId === modelId);
  }

  getByCreator(creatorAddress: string): AnalysisResult[] {
    const models = getAllModels();
    const creatorModelIds = new Set(
      models
        .filter((m) => m.creator.toLowerCase() === creatorAddress.toLowerCase())
        .map((m) => m.id)
    );
    return store.get().analyses.filter((a) => creatorModelIds.has(a.modelId));
  }

  getModelStats(): ModelStats[] {
    const models = getAllModels();
    const analyses = store.get().analyses;

    return models.map((model) => {
      const modelAnalyses = analyses.filter((a) => a.modelId === model.id);
      const count = modelAnalyses.length;
      const avgScore = count > 0
        ? modelAnalyses.reduce((sum, a) => sum + a.score, 0) / count
        : 0;

      const dist = { BUY: 0, WATCH: 0, AVOID: 0 };
      for (const a of modelAnalyses) {
        dist[a.signal as Signal]++;
      }

      return {
        id: model.id,
        name: model.name,
        description: model.description,
        creator: model.creator,
        version: model.version,
        usageCount: count,
        avgScore: Math.round(avgScore * 10) / 10,
        signalDistribution: dist,
        lastUsed: count > 0 ? modelAnalyses[0].timestamp : null,
      };
    });
  }

  getLeaderboard(): ModelStats[] {
    return this.getModelStats().sort((a, b) => b.usageCount - a.usageCount);
  }

  getTotalCount(): number {
    return store.get().analyses.length;
  }

  getSignalDistribution(): { BUY: number; WATCH: number; AVOID: number } {
    const dist = { BUY: 0, WATCH: 0, AVOID: 0 };
    for (const a of store.get().analyses) {
      dist[a.signal as Signal]++;
    }
    return dist;
  }

  getAverageScore(): number {
    const analyses = store.get().analyses;
    if (analyses.length === 0) return 0;
    return analyses.reduce((sum, a) => sum + a.score, 0) / analyses.length;
  }

  clearAll(): void {
    store.reset();
  }
}

// Singleton — survives across requests in Next.js server process
export const analysisStore = new AnalysisStore();
