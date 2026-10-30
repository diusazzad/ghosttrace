export type TraceEventType = "llm" | "tool" | "state" | "error";

export interface TraceEvent {
  id: string;
  name: string;
  type: TraceEventType;
  startTimeMs: number;
  durationMs: number;
  status: "success" | "error" | "warning";
  input?: Record<string, unknown> | string;
  output?: Record<string, unknown> | string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  error?: string;
  isCausalAnomaly?: boolean;
}

export interface TraceRun {
  id: string;
  agentName: string;
  failureCategory: "infinite_loop" | "parameter_hallucination" | "context_overflow" | "unhandled_tool_error";
  failureDescription: string;
  startedAt: string;
  totalDurationMs: number;
  totalTokens: number;
  estimatedCostUsd: number;
  status: "failed" | "completed" | "recovered";
  events: TraceEvent[];
  hypothesis: {
    title: string;
    model: string;
    explanation: string;
    groundedEventIds: string[];
    confidence: number;
    validationStatus: "grounded" | "unverified" | "hallucination_flagged";
    suggestedFix: string;
  };
  generatedTestCode: string;
}
