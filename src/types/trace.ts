import type { UltramarineInvestigationResult } from "@/lib/ai/ultramarineAdapter";

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
  hallucinatedEventIds?: string[];
  unsupportedEventIds?: string[];
  humanReviewRequired: boolean;
  warningMessage?: string;
}

export interface TraceHypothesisCost {
  uncachedInputTokens?: number;
  cachedInputTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  isEstimated?: boolean;
  formula?: string;
}

export interface TraceHypothesis {
  title: string;
  model: string;
  provider?:
    | "ollama"
    | "backboard"
    | "deterministic_rules"
    | "gemini"
    | "paperinstruments"
    | "ultramarine"
    | "deterministic"
    | "mock";
  executionMode?: "live_inference" | "deterministic_fallback" | "replay";
  latencyMs?: number;
  fallbackReason?: string;
  explanation: string;
  groundedEventIds: string[];
  confidence: number;
  validationStatus: "grounded" | "unverified" | "hallucination_flagged";
  suggestedFix: string;
  uncertaintyWarnings?: string[];
  evidenceValidation?: EvidenceValidationInfo;
  cost?: TraceHypothesisCost;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  requestId?: string;
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
  ultramarineInvestigation?: UltramarineInvestigationResult;
}

export type AgentTrace = TraceRun;

export interface MastraWorkflowOutput {
  status: "success" | "failed";
  durationMs: number;
  totalTokens: number;
  estimatedCostUsd: number;
  workflowEngine: string;
  steps: MastraWorkflowStepInfo[];
  hypothesis: TraceHypothesis;
  generatedTestCode: string;
  deterministicFallbackUsed: boolean;
  provider?: string;
  model?: string;
  executionMode?: string;
  evidenceValidation?: EvidenceValidationInfo;
  cost?: TraceHypothesisCost;
  requestId?: string;
  ultramarineInvestigation?: UltramarineInvestigationResult;
}
