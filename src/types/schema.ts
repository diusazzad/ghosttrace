import { z } from "zod";

export const TraceEventTypeSchema = z.enum(["llm", "tool", "state", "error"]);
export type TraceEventType = z.infer<typeof TraceEventTypeSchema>;

export const TraceEventStatusSchema = z.enum(["success", "error", "warning"]);
export type TraceEventStatus = z.infer<typeof TraceEventStatusSchema>;

export const TokenUsageSchema = z.object({
  prompt: z.number().int().nonnegative().default(0),
  completion: z.number().int().nonnegative().default(0),
  total: z.number().int().nonnegative().default(0),
});
export type TokenUsage = z.infer<typeof TokenUsageSchema>;

export const RawTraceEventSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: TraceEventTypeSchema,
  timestamp: z.union([z.string(), z.number()]).optional(),
  startTimeMs: z.number().nonnegative().optional(),
  durationMs: z.number().nonnegative().default(0),
  status: TraceEventStatusSchema.default("success"),
  input: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
  output: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
  tokens: TokenUsageSchema.optional(),
  error: z.string().optional(),
  isCausalAnomaly: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type RawTraceEvent = z.infer<typeof RawTraceEventSchema>;

export const FailureCategorySchema = z.enum([
  "infinite_loop",
  "parameter_hallucination",
  "context_overflow",
  "unhandled_tool_error",
  "latency_stall",
  "none",
]);
export type FailureCategory = z.infer<typeof FailureCategorySchema>;

export const RawTraceSchema = z.object({
  id: z.string().min(1),
  agentName: z.string().default("UnknownAgent"),
  startedAt: z.union([z.string(), z.number()]).optional(),
  endedAt: z.union([z.string(), z.number()]).optional(),
  events: z.array(RawTraceEventSchema).min(1),
  environment: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type RawTrace = z.infer<typeof RawTraceSchema>;

export const AnomalyFindingSchema = z.object({
  category: FailureCategorySchema,
  severity: z.enum(["critical", "high", "medium", "low"]),
  title: z.string(),
  description: z.string(),
  groundedEventIds: z.array(z.string()),
  evidenceQuotes: z.array(z.string()),
  suggestedRemediation: z.string(),
});
export type AnomalyFinding = z.infer<typeof AnomalyFindingSchema>;

export const ReconstructedTimelineSchema = z.object({
  traceId: z.string(),
  agentName: string(),
  totalDurationMs: z.number().nonnegative(),
  totalTokens: z.number().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  status: z.enum(["failed", "completed", "degraded"]),
  primaryFailureCategory: FailureCategorySchema,
  events: z.array(
    RawTraceEventSchema.extend({
      startTimeMs: z.number().nonnegative(),
      durationMs: z.number().nonnegative(),
      relativeOffsetPercent: z.number().min(0).max(100),
      durationPercent: z.number().min(0).max(100),
    })
  ),
  anomalies: z.array(AnomalyFindingSchema),
});
export type ReconstructedTimeline = z.infer<typeof ReconstructedTimelineSchema>;

function string() {
  return z.string().default("Agent");
}
