import { JsonStore } from "../storage/json-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TradingStrategy {
  id: string;
  name: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  createdBy: string; // wallet address
  createdAt: number;
  active: boolean;

  // Conditions
  conditions: {
    checkInterval: "30m" | "1h" | "4h" | "12h" | "24h";
    scoreThreshold: number; // alert if score drops below this
    riskThreshold: number; // alert if risk score exceeds this (0-100)
    priceDropPercent: number; // alert if price drops more than X%
    volumeSpikeFactor: number; // alert if volume spikes Nx above average
    holderDropPercent: number; // alert if holders drop by X%
  };

  // Actions
  actions: {
    alertOnTrigger: boolean;
    autoAnalyze: boolean; // run full analysis when triggered
    recommendSell: boolean; // include sell recommendation
    recommendBuy: boolean; // include buy recommendation on positive signals
  };

  // Stats
  lastChecked: number | null;
  timesTriggered: number;
  lastTriggeredAt: number | null;
}

export interface StrategyAlert {
  id: string;
  strategyId: string;
  strategyName: string;
  tokenAddress: string;
  tokenSymbol: string;
  triggeredConditions: string[]; // which conditions fired
  agentReasoning: string; // agent's analysis
  recommendation: "BUY" | "HOLD" | "SELL" | "URGENT_SELL";
  score: number;
  riskScore: number;
  timestamp: number;
  dismissed: boolean;
}

interface StrategyStore {
  strategies: TradingStrategy[];
  alerts: StrategyAlert[];
}

// ---------------------------------------------------------------------------
// Store singleton
// ---------------------------------------------------------------------------

const store = new JsonStore<StrategyStore>("trading-strategies.json", {
  strategies: [],
  alerts: [],
});

// ---------------------------------------------------------------------------
// ID helpers
// ---------------------------------------------------------------------------

function generateStrategyId(): string {
  return `strat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function generateAlertId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ---------------------------------------------------------------------------
// Strategy CRUD
// ---------------------------------------------------------------------------

export interface CreateStrategyParams {
  name: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  createdBy: string;
  conditions: TradingStrategy["conditions"];
  actions: TradingStrategy["actions"];
}

export function createStrategy(params: CreateStrategyParams): TradingStrategy {
  const strategy: TradingStrategy = {
    id: generateStrategyId(),
    name: params.name,
    tokenAddress: params.tokenAddress.toLowerCase(),
    tokenSymbol: params.tokenSymbol,
    tokenName: params.tokenName,
    createdBy: params.createdBy.toLowerCase(),
    createdAt: Date.now(),
    active: true,
    conditions: params.conditions,
    actions: params.actions,
    lastChecked: null,
    timesTriggered: 0,
    lastTriggeredAt: null,
  };

  store.update((data) => ({
    ...data,
    strategies: [...data.strategies, strategy],
  }));

  return strategy;
}

export function getStrategy(id: string): TradingStrategy | undefined {
  const data = store.get();
  return data.strategies.find((s) => s.id === id);
}

export function getAllStrategies(creatorWallet?: string): TradingStrategy[] {
  const data = store.get();
  if (creatorWallet) {
    const normalized = creatorWallet.toLowerCase();
    return data.strategies.filter((s) => s.createdBy === normalized);
  }
  return data.strategies;
}

export function updateStrategy(
  id: string,
  updates: Partial<
    Pick<
      TradingStrategy,
      | "name"
      | "conditions"
      | "actions"
      | "active"
      | "lastChecked"
      | "timesTriggered"
      | "lastTriggeredAt"
    >
  >
): TradingStrategy | null {
  let updated: TradingStrategy | null = null;

  store.update((data) => ({
    ...data,
    strategies: data.strategies.map((s) => {
      if (s.id === id) {
        updated = { ...s, ...updates };
        return updated;
      }
      return s;
    }),
  }));

  return updated;
}

export function deleteStrategy(id: string): boolean {
  let found = false;

  store.update((data) => {
    found = data.strategies.some((s) => s.id === id);
    return {
      ...data,
      strategies: data.strategies.filter((s) => s.id !== id),
      // Also clean up alerts for this strategy
      alerts: data.alerts.filter((a) => a.strategyId !== id),
    };
  });

  return found;
}

export function toggleStrategy(id: string): TradingStrategy | null {
  let toggled: TradingStrategy | null = null;

  store.update((data) => ({
    ...data,
    strategies: data.strategies.map((s) => {
      if (s.id === id) {
        toggled = { ...s, active: !s.active };
        return toggled;
      }
      return s;
    }),
  }));

  return toggled;
}

// ---------------------------------------------------------------------------
// Alert CRUD
// ---------------------------------------------------------------------------

export type CreateAlertParams = Omit<StrategyAlert, "id" | "timestamp" | "dismissed">;

export function addAlert(params: CreateAlertParams): StrategyAlert {
  const alert: StrategyAlert = {
    ...params,
    id: generateAlertId(),
    timestamp: Date.now(),
    dismissed: false,
  };

  store.update((data) => ({
    ...data,
    alerts: [...data.alerts, alert],
  }));

  return alert;
}

export function getAlerts(strategyId?: string, limit = 50): StrategyAlert[] {
  const data = store.get();
  let alerts = [...data.alerts];

  if (strategyId) {
    alerts = alerts.filter((a) => a.strategyId === strategyId);
  }

  // Newest first
  alerts.sort((a, b) => b.timestamp - a.timestamp);

  return alerts.slice(0, limit);
}

export function dismissAlert(id: string): boolean {
  let found = false;

  store.update((data) => ({
    ...data,
    alerts: data.alerts.map((a) => {
      if (a.id === id) {
        found = true;
        return { ...a, dismissed: true };
      }
      return a;
    }),
  }));

  return found;
}

export function getActiveAlerts(): StrategyAlert[] {
  const data = store.get();
  return data.alerts
    .filter((a) => !a.dismissed)
    .sort((a, b) => b.timestamp - a.timestamp);
}
