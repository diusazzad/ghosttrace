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

export interface MastraWorkflowStepInfo {
  stepId: string;
  name: string;
  status: "success" | "failed" | "running";
  durationMs: number;
  inputSummary: string;
  outputSummary: string;
  error?: string;
}

export interface EvidenceValidationInfo {
  eventReferenceValid: boolean;
  causalClaimUnverified: boolean;
  validEventIds: string[];
  hallucinatedEventIds: string[];
  humanReviewRequired: boolean;
  warningMessage?: string;
}

export interface TraceHypothesis {
  title: string;
  model: string;
  provider?: "ollama" | "backboard" | "deterministic_rules";
  executionMode?: "live_inference" | "deterministic_fallback";
  latencyMs?: number;
  fallbackReason?: string;
  explanation: string;
  groundedEventIds: string[];
  confidence: number;
  validationStatus: "grounded" | "unverified" | "hallucination_flagged";
  suggestedFix: string;
  uncertaintyWarnings?: string[];
  evidenceValidation?: EvidenceValidationInfo;
}

export interface TraceRun {
  id: string;
  agentName: string;
  failureCategory:
    | "infinite_loop"
    | "parameter_hallucination"
    | "context_overflow"
    | "unhandled_tool_error"
    | "latency_stall"
    | "none"
    | string;
  failureDescription: string;
  startedAt: string;
  totalDurationMs: number;
  totalTokens: number;
  estimatedCostUsd: number;
  status: "failed" | "completed" | "recovered" | "degraded";
  events: TraceEvent[];
  hypothesis: TraceHypothesis;
  generatedTestCode: string;
  mastraSteps?: MastraWorkflowStepInfo[];
  workflowEngine?: string;
}
