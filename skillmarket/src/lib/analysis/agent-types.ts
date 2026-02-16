import type { Signal, Confidence, SerializedTokenData } from "./types";

// === SSE event types for the agentic analysis system ===

export type StepStatus = "pending" | "running" | "complete" | "error";

export interface AgentStepEvent {
  type: "step";
  step: string;
  status: StepStatus;
  detail?: string;
  timestamp: number;
}

export interface AgentResultEvent {
  type: "result";
  modelId: string;
  modelName: string;
  signal: Signal;
  score: number;
  confidence: Confidence;
  reasoning: string;
  risks: string[];
  breakdown: Record<string, number>;
  isAIPowered?: boolean;
  thoughts?: string[];
}

export interface AgentInvestigationEvent {
  type: "investigation";
  title: string;
  finding: string;
  severity: "info" | "warning" | "critical";
}

export interface AgentThinkingEvent {
  type: "thinking";
  reasoning: string;
  nextTools: string[];
  timestamp: number;
}

export interface AgentToolCallEvent {
  type: "tool_call";
  toolId: string;
  toolName: string;
  tier: 1 | 2 | 3;
  status: "running" | "complete" | "skipped";
  finding?: string;
  severity?: "info" | "warning" | "critical";
  details?: string[];
  riskDelta?: number;
  timestamp: number;
}

export interface AgentConfidenceEvent {
  type: "confidence";
  riskScore: number; // 0-100 (0=safe, 100=dangerous)
  signal: "SAFE" | "CAUTION" | "DANGER";
  components: Record<string, number>;
  timestamp: number;
}

export interface AgentDoneEvent {
  type: "done";
  tokenData: SerializedTokenData;
  tokenInfo: {
    name: string;
    symbol: string;
    address: string;
    imageUrl: string;
  };
  totalModels: number;
  timestamp: number;
}

export interface AgentErrorEvent {
  type: "error";
  message: string;
}

export type AgentSSEEvent =
  | AgentStepEvent
  | AgentResultEvent
  | AgentInvestigationEvent
  | AgentThinkingEvent
  | AgentToolCallEvent
  | AgentConfidenceEvent
  | AgentDoneEvent
  | AgentErrorEvent;
