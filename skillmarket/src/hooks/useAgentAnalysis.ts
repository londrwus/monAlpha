"use client";

import { useState, useCallback, useRef } from "react";
import type {
  AgentSSEEvent,
  AgentStepEvent,
  AgentResultEvent,
  AgentInvestigationEvent,
  AgentThinkingEvent,
  AgentToolCallEvent,
  AgentConfidenceEvent,
} from "@/lib/analysis/agent-types";
import type { SerializedTokenData } from "@/lib/analysis/types";

export type AgentState = "idle" | "running" | "complete" | "error";

// Unified timeline event — all events in chronological order
export type TimelineEntry =
  | { kind: "step"; data: AgentStepEvent }
  | { kind: "thinking"; data: AgentThinkingEvent }
  | { kind: "tool_call"; data: AgentToolCallEvent }
  | { kind: "investigation"; data: AgentInvestigationEvent }
  | { kind: "confidence"; data: AgentConfidenceEvent }
  | { kind: "result"; data: AgentResultEvent };

export interface UseAgentAnalysisReturn {
  state: AgentState;
  timeline: TimelineEntry[];
  steps: AgentStepEvent[];
  results: AgentResultEvent[];
  investigations: AgentInvestigationEvent[];
  thinkingSteps: AgentThinkingEvent[];
  toolCalls: AgentToolCallEvent[];
  confidence: AgentConfidenceEvent | null;
  tokenData: SerializedTokenData | null;
  tokenInfo: { name: string; symbol: string; address: string; imageUrl: string } | null;
  error: string | null;
  run: (tokenAddress: string, modelIds: string[], paymentInfo?: { txHash: string; userWallet: string }) => void;
  cancel: () => void;
}

export function useAgentAnalysis(): UseAgentAnalysisReturn {
  const [state, setState] = useState<AgentState>("idle");
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [steps, setSteps] = useState<AgentStepEvent[]>([]);
  const [results, setResults] = useState<AgentResultEvent[]>([]);
  const [investigations, setInvestigations] = useState<AgentInvestigationEvent[]>([]);
  const [thinkingSteps, setThinkingSteps] = useState<AgentThinkingEvent[]>([]);
  const [toolCalls, setToolCalls] = useState<AgentToolCallEvent[]>([]);
  const [confidence, setConfidence] = useState<AgentConfidenceEvent | null>(null);
  const [tokenData, setTokenData] = useState<SerializedTokenData | null>(null);
  const [tokenInfo, setTokenInfo] = useState<{ name: string; symbol: string; address: string; imageUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState((s) => (s === "running" ? "error" : s));
  }, []);

  const run = useCallback((tokenAddress: string, modelIds: string[], paymentInfo?: { txHash: string; userWallet: string }) => {
    // Reset
    setState("running");
    setTimeline([]);
    setSteps([]);
    setResults([]);
    setInvestigations([]);
    setThinkingSteps([]);
    setToolCalls([]);
    setConfidence(null);
    setTokenData(null);
    setTokenInfo(null);
    setError(null);

    // Abort previous
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    (async () => {
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: tokenAddress,
            modelIds,
            txHash: paymentInfo?.txHash,
            userWallet: paymentInfo?.userWallet,
          }),
          signal: controller.signal,
        });

        // Check for JSON error responses (validation errors return JSON, not SSE)
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const json = await res.json();
          setError(json.error || "Analysis failed");
          setState("error");
          return;
        }

        if (!res.body) {
          setError("No response body");
          setState("error");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE lines
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // keep incomplete last line

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;

            try {
              const event = JSON.parse(trimmed.slice(6)) as AgentSSEEvent;

              switch (event.type) {
                case "step":
                  setSteps((prev) => {
                    const existing = prev.findIndex((s) => s.step === event.step);
                    if (existing >= 0) {
                      const updated = [...prev];
                      updated[existing] = event;
                      return updated;
                    }
                    return [...prev, event];
                  });
                  // Only add to timeline on first appearance (not updates)
                  setTimeline((prev) => {
                    const exists = prev.some((e) => e.kind === "step" && e.data.step === event.step);
                    if (exists) {
                      return prev.map((e) =>
                        e.kind === "step" && e.data.step === event.step
                          ? { kind: "step" as const, data: event }
                          : e
                      );
                    }
                    return [...prev, { kind: "step", data: event }];
                  });
                  break;

                case "thinking":
                  setThinkingSteps((prev) => [...prev, event]);
                  setTimeline((prev) => [...prev, { kind: "thinking", data: event }]);
                  break;

                case "tool_call":
                  setToolCalls((prev) => {
                    const existing = prev.findIndex((t) => t.toolId === event.toolId);
                    if (existing >= 0) {
                      const updated = [...prev];
                      updated[existing] = event;
                      return updated;
                    }
                    return [...prev, event];
                  });
                  // Add running events to timeline, update existing on complete
                  setTimeline((prev) => {
                    const exists = prev.some((e) => e.kind === "tool_call" && e.data.toolId === event.toolId);
                    if (exists) {
                      return prev.map((e) =>
                        e.kind === "tool_call" && e.data.toolId === event.toolId
                          ? { kind: "tool_call" as const, data: event }
                          : e
                      );
                    }
                    return [...prev, { kind: "tool_call", data: event }];
                  });
                  break;

                case "confidence":
                  setConfidence(event);
                  setTimeline((prev) => [...prev, { kind: "confidence", data: event }]);
                  break;

                case "result":
                  setResults((prev) => [...prev, event]);
                  setTimeline((prev) => [...prev, { kind: "result", data: event }]);
                  break;

                case "investigation":
                  setInvestigations((prev) => [...prev, event]);
                  setTimeline((prev) => [...prev, { kind: "investigation", data: event }]);
                  break;

                case "done":
                  setTokenData(event.tokenData);
                  setTokenInfo(event.tokenInfo);
                  setState("complete");
                  break;

                case "error":
                  setError(event.message);
                  setState("error");
                  break;
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }

        // If we didn't get a done event, mark complete anyway
        setState((s) => (s === "running" ? "complete" : s));
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
        setState("error");
      }
    })();
  }, []);

  return {
    state,
    timeline,
    steps,
    results,
    investigations,
    thinkingSteps,
    toolCalls,
    confidence,
    tokenData,
    tokenInfo,
    error,
    run,
    cancel,
  };
}
