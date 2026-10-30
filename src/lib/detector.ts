import {
  RawTrace,
  RawTraceSchema,
  ReconstructedTimeline,
  AnomalyFinding,
  FailureCategory,
} from "@/types/schema";

interface ProcessedEvent {
  id: string;
  name: string;
  type: "llm" | "tool" | "state" | "error";
  startTimeMs: number;
  durationMs: number;
  relativeOffsetPercent: number;
  durationPercent: number;
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
  metadata?: Record<string, unknown>;
}

export function parseAndValidateTrace(input: unknown): RawTrace {
  const result = RawTraceSchema.safeParse(input);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid trace format: ${errorDetails}`);
  }
  return result.data;
}

export function reconstructTimeline(rawInput: unknown): ReconstructedTimeline {
  const raw = parseAndValidateTrace(rawInput);

  // 1. Determine baseline start time
  let baseTimestampMs = 0;
  if (raw.startedAt) {
    baseTimestampMs =
      typeof raw.startedAt === "number"
        ? raw.startedAt
        : new Date(raw.startedAt).getTime();
  } else if (raw.events[0]?.timestamp) {
    const firstTs = raw.events[0].timestamp;
    baseTimestampMs =
      typeof firstTs === "number" ? firstTs : new Date(firstTs).getTime();
  }

  // 2. Normalize timestamps & durations chronologically
  let cumulativeTimeMs = 0;
  const rawEventsWithTime = raw.events.map((evt) => {
    let startTimeMs = 0;

    if (typeof evt.startTimeMs === "number") {
      startTimeMs = evt.startTimeMs;
    } else if (evt.timestamp) {
      const eventTs =
        typeof evt.timestamp === "number"
          ? evt.timestamp
          : new Date(evt.timestamp).getTime();
      startTimeMs = Math.max(0, eventTs - baseTimestampMs);
    } else {
      startTimeMs = cumulativeTimeMs;
    }

    const durationMs = evt.durationMs ?? 0;
    cumulativeTimeMs = startTimeMs + durationMs;

    return {
      ...evt,
      startTimeMs,
      durationMs,
    };
  });

  // Sort chronologically
  rawEventsWithTime.sort((a, b) => a.startTimeMs - b.startTimeMs);

  // 3. Compute overall execution duration
  const lastEvent = rawEventsWithTime[rawEventsWithTime.length - 1];
  const maxEventEnd = lastEvent
    ? lastEvent.startTimeMs + (lastEvent.durationMs || 0)
    : 1;

  let totalDurationMs = maxEventEnd;
  if (raw.endedAt && baseTimestampMs > 0) {
    const endMs =
      typeof raw.endedAt === "number"
        ? raw.endedAt
        : new Date(raw.endedAt).getTime();
    const explicitDuration = endMs - baseTimestampMs;
    if (explicitDuration > totalDurationMs) {
      totalDurationMs = explicitDuration;
    }
  }
  totalDurationMs = Math.max(totalDurationMs, 1);

  // 4. Run deterministic anomaly detectors
  const anomalies: AnomalyFinding[] = [];
  const causalEventIds = new Set<string>();

  // Check 4a: Repetitive tool loop detection
  detectRepetitiveToolLoops(rawEventsWithTime, anomalies, causalEventIds);

  // Check 4b: Parameter hallucination / schema mismatch detection
  detectParameterHallucinations(rawEventsWithTime, anomalies, causalEventIds);

  // Check 4c: Context overflow detection
  detectContextOverflow(rawEventsWithTime, anomalies, causalEventIds);

  // Check 4d: Unhandled tool errors
  detectUnhandledToolErrors(rawEventsWithTime, anomalies, causalEventIds);

  // Check 4e: Latency stalls (>10s or disproportionate)
  detectLatencyStalls(rawEventsWithTime, totalDurationMs, anomalies, causalEventIds);

  // 5. Build final processed events
  let totalTokens = 0;
  const processedEvents: ProcessedEvent[] = rawEventsWithTime.map((evt) => {
    const isCausal = causalEventIds.has(evt.id) || evt.isCausalAnomaly === true;
    const offsetPercent = Math.min(
      (evt.startTimeMs / totalDurationMs) * 100,
      99
    );
    const durationPercent = Math.max(
      Math.min((evt.durationMs / totalDurationMs) * 100, 100 - offsetPercent),
      1
    );

    if (evt.tokens?.total) {
      totalTokens += evt.tokens.total;
    } else if (evt.tokens?.prompt || evt.tokens?.completion) {
      totalTokens += (evt.tokens.prompt || 0) + (evt.tokens.completion || 0);
    }

    return {
      id: evt.id,
      name: evt.name,
      type: evt.type,
      startTimeMs: evt.startTimeMs,
      durationMs: evt.durationMs,
      relativeOffsetPercent: Math.round(offsetPercent * 10) / 10,
      durationPercent: Math.round(durationPercent * 10) / 10,
      status: evt.status,
      input: evt.input,
      output: evt.output,
      tokens: evt.tokens,
      error: evt.error,
      isCausalAnomaly: isCausal,
      metadata: evt.metadata,
    };
  });

  // 6. Cost estimation ($0.0015 per 1k prompt, $0.002 per 1k completion)
  const estimatedCostUsd = Math.round((totalTokens / 1000) * 0.002 * 10000) / 10000;

  // 7. Determine Primary Failure Category & Overall Status
  let primaryCategory: FailureCategory = "none";
  let status: "failed" | "completed" | "degraded" = "completed";

  if (anomalies.some((a) => a.category === "infinite_loop")) {
    primaryCategory = "infinite_loop";
    status = "failed";
  } else if (anomalies.some((a) => a.category === "parameter_hallucination")) {
    primaryCategory = "parameter_hallucination";
    status = "failed";
  } else if (anomalies.some((a) => a.category === "context_overflow")) {
    primaryCategory = "context_overflow";
    status = "failed";
  } else if (anomalies.some((a) => a.category === "unhandled_tool_error")) {
    primaryCategory = "unhandled_tool_error";
    status = "failed";
  } else if (anomalies.some((a) => a.category === "latency_stall")) {
    primaryCategory = "latency_stall";
    status = "degraded";
  } else if (processedEvents.some((e) => e.status === "error" || e.type === "error")) {
    primaryCategory = "unhandled_tool_error";
    status = "failed";
  }

  return {
    traceId: raw.id,
    agentName: raw.agentName || "Agent",
    totalDurationMs,
    totalTokens,
    estimatedCostUsd,
    status,
    primaryFailureCategory: primaryCategory,
    events: processedEvents,
    anomalies,
  };
}

/* =========================================================================
   DETERMINISTIC ANOMALY DETECTOR IMPLEMENTATIONS (100% Offline / Zero LLM)
   ========================================================================= */

function detectRepetitiveToolLoops(
  events: Array<{
    id: string;
    name: string;
    type: string;
    input?: unknown;
    status: string;
    error?: string;
  }>,
  anomalies: AnomalyFinding[],
  causalIds: Set<string>
) {
  // Check consecutive or near-consecutive identical tool invocations
  const toolInvocations: Array<{ id: string; name: string; argsHash: string }> = [];

  for (const evt of events) {
    if (evt.type === "tool" || evt.name.startsWith("tool_")) {
      const argsHash = JSON.stringify(evt.input ?? {});
      toolInvocations.push({ id: evt.id, name: evt.name, argsHash });
    }
  }

  // Count identical consecutive or windowed (size 5) invocations
  let repetitionStreak = 1;
  let streakIds: string[] = [];
  let repeatingTool = "";

  for (let i = 1; i < toolInvocations.length; i++) {
    const prev = toolInvocations[i - 1];
    const curr = toolInvocations[i];

    if (prev.name === curr.name && prev.argsHash === curr.argsHash) {
      if (repetitionStreak === 1) {
        streakIds = [prev.id, curr.id];
        repeatingTool = curr.name;
      } else {
        streakIds.push(curr.id);
      }
      repetitionStreak++;
    } else {
      if (repetitionStreak >= 3) {
        break; // Captured streak
      }
      repetitionStreak = 1;
      streakIds = [];
    }
  }

  // Also check if circuit breaker tripped
  const circuitBreakerEvent = events.find(
    (e) =>
      e.error?.toLowerCase().includes("circuitbreaker") ||
      e.error?.toLowerCase().includes("loop") ||
      e.name.toLowerCase().includes("circuit_breaker")
  );

  if (repetitionStreak >= 3 || circuitBreakerEvent) {
    if (circuitBreakerEvent) {
      streakIds.push(circuitBreakerEvent.id);
    }
    streakIds.forEach((id) => causalIds.add(id));

    anomalies.push({
      category: "infinite_loop",
      severity: "critical",
      title: "Repetitive Tool Invocation Loop Detected",
      description: `Identical tool '${repeatingTool || "tool"}' was invoked ${repetitionStreak} times with identical arguments without mutating state or yielding progress.`,
      groundedEventIds: streakIds,
      evidenceQuotes: [
        `Repeated calls: [${streakIds.join(", ")}]`,
        circuitBreakerEvent?.error || "State unchanged across repetitions",
      ],
      suggestedRemediation:
        "Implement circuit breaker threshold (max 2 retries) or add an explicit fallback step when tool yields duplicate output.",
    });
  }
}

function detectParameterHallucinations(
  events: Array<{
    id: string;
    name: string;
    type: string;
    input?: unknown;
    status: string;
    error?: string;
  }>,
  anomalies: AnomalyFinding[],
  causalIds: Set<string>
) {
  const schemaErrorKeywords = [
    "validationerror",
    "extra inputs are not permitted",
    "extra_forbidden",
    "unexpected keyword argument",
    "unknown argument",
    "missing required",
    "invalid parameter",
    "schema violation",
  ];

  for (let i = 0; i < events.length; i++) {
    const evt = events[i];
    const errorText = (evt.error || "").toLowerCase();
    const hasSchemaError = schemaErrorKeywords.some((kw) =>
      errorText.includes(kw)
    );

    if (hasSchemaError) {
      causalIds.add(evt.id);
      // Mark preceding LLM call if present
      const precedingLlm = events
        .slice(0, i)
        .reverse()
        .find((e) => e.type === "llm");
      if (precedingLlm) {
        causalIds.add(precedingLlm.id);
      }

      anomalies.push({
        category: "parameter_hallucination",
        severity: "high",
        title: "Tool Parameter Schema Mismatch / Hallucination",
        description: `Tool '${evt.name}' rejected call with schema validation error: ${evt.error}`,
        groundedEventIds: [precedingLlm?.id, evt.id].filter(
          Boolean
        ) as string[],
        evidenceQuotes: [evt.error || "Schema violation"],
        suggestedRemediation:
          "Enforce strict tool parameter JSON schema (Zod/Pydantic) and specify tool parameters with clear examples in agent prompt.",
      });
      break;
    }
  }
}

function detectContextOverflow(
  events: Array<{
    id: string;
    name: string;
    type: string;
    tokens?: { prompt: number; completion: number; total: number };
    error?: string;
  }>,
  anomalies: AnomalyFinding[],
  causalIds: Set<string>
) {
  const contextErrorKeywords = [
    "context length exceeded",
    "maximum context length",
    "token limit exceeded",
    "out of memory",
    "too many tokens",
  ];

  for (const evt of events) {
    const errorText = (evt.error || "").toLowerCase();
    const hasContextError = contextErrorKeywords.some((kw) =>
      errorText.includes(kw)
    );
    const hasTokenSpike = (evt.tokens?.prompt || 0) > 16384;

    if (hasContextError || hasTokenSpike) {
      causalIds.add(evt.id);
      anomalies.push({
        category: "context_overflow",
        severity: "critical",
        title: "Context Window Overflow / Token Explosion",
        description: hasContextError
          ? `LLM call failed with context overflow: ${evt.error}`
          : `Excessive prompt tokens detected (${evt.tokens?.prompt} tokens in single call).`,
        groundedEventIds: [evt.id],
        evidenceQuotes: [
          evt.error ||
            `Prompt tokens: ${evt.tokens?.prompt}, Total: ${evt.tokens?.total}`,
        ],
        suggestedRemediation:
          "Implement conversation window truncation, vector retrieval chunking, or sliding-window message pruning.",
      });
      break;
    }
  }
}

function detectUnhandledToolErrors(
  events: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    error?: string;
    output?: unknown;
  }>,
  anomalies: AnomalyFinding[],
  causalIds: Set<string>
) {
  // If already flagged as loop or parameter hallucination, skip generic unhandled tool error
  if (anomalies.some((a) => a.category === "infinite_loop" || a.category === "parameter_hallucination")) {
    return;
  }

  for (const evt of events) {
    if (evt.type === "error" || evt.status === "error") {
      causalIds.add(evt.id);
      anomalies.push({
        category: "unhandled_tool_error",
        severity: "high",
        title: "Unhandled Execution Exception / API Crash",
        description: `Operation '${evt.name}' failed with error: ${evt.error || "Unknown Error"}`,
        groundedEventIds: [evt.id],
        evidenceQuotes: [evt.error || "Event marked with status=error"],
        suggestedRemediation:
          "Wrap tool invocations in try/catch blocks with exponential backoff or user-in-the-loop clarification fallback.",
      });
      break;
    }
  }
}

function detectLatencyStalls(
  events: Array<{
    id: string;
    name: string;
    durationMs: number;
  }>,
  totalDurationMs: number,
  anomalies: AnomalyFinding[],
  causalIds: Set<string>
) {
  // Find single operations that took > 15s or > 70% of entire execution
  for (const evt of events) {
    if (evt.durationMs >= 15000 || (totalDurationMs > 5000 && evt.durationMs / totalDurationMs > 0.75)) {
      causalIds.add(evt.id);
      anomalies.push({
        category: "latency_stall",
        severity: "medium",
        title: "Abnormal Latency Spike / Operation Stall",
        description: `Operation '${evt.name}' took ${evt.durationMs}ms (${Math.round((evt.durationMs / totalDurationMs) * 100)}% of total execution time).`,
        groundedEventIds: [evt.id],
        evidenceQuotes: [`durationMs: ${evt.durationMs}`],
        suggestedRemediation:
          "Configure per-tool timeout limits (e.g. 5000ms max) with async cancellation support.",
      });
      break;
    }
  }
}
