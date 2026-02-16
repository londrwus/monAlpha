import type { ParsedSkill } from "./parser";

export type RiskTolerance = "conservative" | "moderate" | "aggressive";
export type ModelType = "RESEARCH" | "DEEP_RESEARCH";

export interface AdvancedSettings {
  riskTolerance: RiskTolerance;
  requireApiData: boolean;
  minTradesRequired: number;
  customBuyThreshold: number | null;
  customAvoidThreshold: number | null;
  description: string;
  icon: string;
}

export const DEFAULT_ADVANCED_SETTINGS: AdvancedSettings = {
  riskTolerance: "moderate",
  requireApiData: false,
  minTradesRequired: 0,
  customBuyThreshold: null,
  customAvoidThreshold: null,
  description: "",
  icon: "",
};

export interface StoredCustomModel {
  id: string;
  name: string;
  description: string;
  version: string;
  creator: string;
  createdAt: number;
  updatedAt: number;
  price: number;
  ipfsHash: string;
  skillMarkdown: string;
  parsedSkill: ParsedSkill;
  usageCount: number;
  isBuiltIn: false;
  modelType: ModelType;
  advancedSettings: AdvancedSettings;
}

export interface CustomModelStoreData {
  models: StoredCustomModel[];
}

export interface CreateModelParams {
  skillMarkdown: string;
  parsedSkill: ParsedSkill;
  price: number;
  creator: string;
  ipfsHash?: string;
  modelType?: ModelType;
  advancedSettings?: Partial<AdvancedSettings>;
}
