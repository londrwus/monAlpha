import { JsonStore } from "../storage/json-store";
import type { CustomModelStoreData, StoredCustomModel, CreateModelParams } from "./types";
import { DEFAULT_ADVANCED_SETTINGS } from "./types";

const store = new JsonStore<CustomModelStoreData>("models.json", { models: [] });

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

export function getAllCustomModels(): StoredCustomModel[] {
  return store.get().models;
}

export function getCustomModel(id: string): StoredCustomModel | undefined {
  return store.get().models.find((m) => m.id === id);
}

export function createCustomModel(params: CreateModelParams): StoredCustomModel {
  const slug = slugify(params.parsedSkill.name);
  const id = `custom-${slug}-${Date.now()}`;

  const advSettings = { ...DEFAULT_ADVANCED_SETTINGS, ...params.advancedSettings };
  const modelType = params.modelType || (params.parsedSkill.type === "DEEP_RESEARCH" ? "DEEP_RESEARCH" as const : "RESEARCH" as const);

  const model: StoredCustomModel = {
    id,
    name: params.parsedSkill.name,
    description: advSettings.description || params.parsedSkill.aiSystemPrompt.slice(0, 200),
    version: "1.0",
    creator: params.creator,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    price: params.price,
    ipfsHash: params.ipfsHash || "",
    skillMarkdown: params.skillMarkdown,
    parsedSkill: params.parsedSkill,
    usageCount: 0,
    isBuiltIn: false,
    modelType,
    advancedSettings: advSettings,
  };

  store.update((data) => ({
    models: [...data.models, model],
  }));

  return model;
}

export function updateCustomModel(
  id: string,
  updates: Partial<Pick<StoredCustomModel, "price" | "skillMarkdown" | "parsedSkill" | "ipfsHash" | "name" | "description">>
): StoredCustomModel | null {
  let found: StoredCustomModel | null = null;

  store.update((data) => ({
    models: data.models.map((m) => {
      if (m.id === id) {
        found = { ...m, ...updates, updatedAt: Date.now() };
        return found;
      }
      return m;
    }),
  }));

  return found;
}

export function deleteCustomModel(id: string): boolean {
  const before = store.get().models.length;
  store.update((data) => ({
    models: data.models.filter((m) => m.id !== id),
  }));
  return store.get().models.length < before;
}

export function incrementUsage(id: string): void {
  store.update((data) => ({
    models: data.models.map((m) =>
      m.id === id ? { ...m, usageCount: m.usageCount + 1 } : m
    ),
  }));
}
