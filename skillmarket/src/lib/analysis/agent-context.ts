import type { CollectedTokenData } from "./types";

// === Agent Context — accumulates findings as the agent investigates ===

export interface Finding {
  toolId: string;
  toolName: string;
  severity: "info" | "warning" | "critical";
  finding: string;
  details: string[];
  timestamp: number;
}

export interface AgentContext {
  tokenData: CollectedTokenData;
  findings: Finding[];
  toolsRun: string[];
  riskScore: number; // starts at 50 (neutral), tools shift it via riskDelta
  riskComponents: Record<string, number>; // per-tool risk contributions
  tier1Complete: boolean;
  tier2Complete: boolean;
  flags: Set<string>; // e.g. "LOW_LIQUIDITY", "SERIAL_DEPLOYER", "PUMP_PATTERN"
}

export function createAgentContext(data: CollectedTokenData): AgentContext {
  return {
    tokenData: data,
    findings: [],
    toolsRun: [],
    riskScore: 50,
    riskComponents: {},
    tier1Complete: false,
    tier2Complete: false,
    flags: new Set(),
  };
}

export function addFinding(ctx: AgentContext, finding: Finding): void {
  ctx.findings.push(finding);
}

export function addToolRun(ctx: AgentContext, toolId: string): void {
  ctx.toolsRun.push(toolId);
}

export function shiftRisk(ctx: AgentContext, toolId: string, delta: number): void {
  ctx.riskScore = Math.max(0, Math.min(100, ctx.riskScore + delta));
  ctx.riskComponents[toolId] = delta;
}

export function addFlag(ctx: AgentContext, flag: string): void {
  ctx.flags.add(flag);
}

export function hasFlag(ctx: AgentContext, flag: string): boolean {
  return ctx.flags.has(flag);
}

export function getRiskSignal(riskScore: number): "SAFE" | "CAUTION" | "DANGER" {
  if (riskScore <= 33) return "SAFE";
  if (riskScore <= 66) return "CAUTION";
  return "DANGER";
}
