import * as Sentry from "@sentry/nextjs";

/**
 * OpenTelemetry GenAI Semantic Convention Constants for Sentry Agent Tracing
 */
export const GEN_AI_SYSTEM = "gen_ai.system";
export const GEN_AI_OPERATION_NAME = "gen_ai.operation.name";
export const GEN_AI_REQUEST_MODEL = "gen_ai.request.model";
export const GEN_AI_CONVERSATION_ID = "gen_ai.conversation.id";
export const GEN_AI_USAGE_INPUT_TOKENS = "gen_ai.usage.input_tokens";
export const GEN_AI_USAGE_OUTPUT_TOKENS = "gen_ai.usage.output_tokens";

export interface SentryAgentSpanOptions {
  traceId: string;
  stepName: string;
  op:
    | "gen_ai.workflow"
    | "gen_ai.data_processing"
    | "gen_ai.analysis"
    | "gen_ai.chat"
    | "gen_ai.code_generation";
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Record an audit breadcrumb in the active Sentry transaction
 */
export function recordAgentBreadcrumb(
  category:
    | "ingestion"
    | "anomaly"
    | "inference"
    | "synthesis"
    | "grounding"
    | "workflow",
  message: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category: `agent.${category}`,
    message,
    data,
    level: "info",
    timestamp: Date.now() / 1000,
  });
}

/**
 * Start an end-to-end Sentry agent tracing workflow span
 */
export async function startAgentWorkflowSpan<T>(
  traceId: string,
  runFn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      name: "GhostTrace Agent Forensic Workflow",
      op: "gen_ai.workflow",
      attributes: {
        [GEN_AI_SYSTEM]: "ghosttrace",
        [GEN_AI_OPERATION_NAME]: "forensic_investigation",
        [GEN_AI_CONVERSATION_ID]: traceId,
        "ghosttrace.engine": "Mastra + Google Gemma 2",
      },
    },
    async (span) => {
      recordAgentBreadcrumb(
        "workflow",
        `Started investigation workflow for trace ${traceId}`,
        { traceId }
      );
      try {
        const result = await runFn();
        span?.setAttribute("ghosttrace.status", "completed");
        return result;
      } catch (err) {
        span?.setAttribute("ghosttrace.status", "failed");
        captureAgentFailure(err, { traceId, phase: "workflow_root" });
        throw err;
      }
    }
  );
}

/**
 * Start a granular Sentry agent span for an individual pipeline step
 */
export async function startAgentStepSpan<T>(
  options: SentryAgentSpanOptions,
  stepFn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      name: `ai.step.${options.stepName}`,
      op: options.op,
      attributes: {
        [GEN_AI_SYSTEM]: "ghosttrace",
        [GEN_AI_OPERATION_NAME]: options.stepName,
        [GEN_AI_CONVERSATION_ID]: options.traceId,
        ...(options.attributes || {}),
      },
    },
    async (span) => {
      recordAgentBreadcrumb(
        options.stepName.includes("anomal") ? "anomaly" : "workflow",
        `Executing step ${options.stepName}`,
        { step: options.stepName, traceId: options.traceId }
      );
      try {
        const result = await stepFn();
        span?.setAttribute("ghosttrace.step_status", "ok");
        return result;
      } catch (err) {
        span?.setAttribute("ghosttrace.step_status", "error");
        captureAgentFailure(err, {
          traceId: options.traceId,
          step: options.stepName,
        });
        throw err;
      }
    }
  );
}

/**
 * Instrument LLM inference calls with Sentry GenAI attributes
 */
export async function startGemmaInferenceSpan<T>(
  model: string,
  provider: "backboard" | "ollama" | "deterministic_fallback",
  traceId: string,
  inferFn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      name: "Google Gemma 2 Root Cause Reasoning",
      op: "gen_ai.chat",
      attributes: {
        [GEN_AI_SYSTEM]: "google_gemma",
        [GEN_AI_REQUEST_MODEL]: model,
        [GEN_AI_OPERATION_NAME]: "root_cause_hypothesis",
        [GEN_AI_CONVERSATION_ID]: traceId,
        "gen_ai.provider": provider,
      },
    },
    async (span) => {
      recordAgentBreadcrumb("inference", `Invoking Gemma 2 via ${provider}`, {
        model,
        provider,
        traceId,
      });

      const startTime = performance.now();
      try {
        const result = await inferFn();
        const durationMs = Math.round(performance.now() - startTime);
        span?.setAttribute("ghosttrace.inference_duration_ms", durationMs);
        return result;
      } catch (err) {
        captureAgentFailure(err, {
          traceId,
          model,
          provider,
          phase: "llm_inference",
        });
        throw err;
      }
    }
  );
}

/**
 * Capture agent failures with enriched Sentry forensic tags
 */
export function captureAgentFailure(
  error: unknown,
  context: Record<string, unknown>
): void {
  Sentry.withScope((scope) => {
    scope.setTag("component", "agent-forensics");
    if (context.traceId) scope.setTag("trace_id", String(context.traceId));
    if (context.model) scope.setTag("gemma_model", String(context.model));
    scope.setContext("forensics_context", context);

    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(String(error), "error");
    }
  });
}
