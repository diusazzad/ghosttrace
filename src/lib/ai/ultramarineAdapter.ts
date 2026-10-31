import OpenAI from "openai";
import { z } from "zod";
import { ReconstructedTimeline } from "@/types/schema";
import { recordAgentBreadcrumb } from "@/lib/telemetry/sentryTracer";

/**
 * Zod schema enforcing the structure of Ultramarine's forensic investigation output
 */
export const UltramarineInvestigationSchema = z.object({
  summary: z.string().min(1, "Summary must not be empty"),
  rootCause: z.string().min(1, "Root cause explanation must not be empty"),
  failureCategory: z.string().min(1, "Failure category must not be empty"),
  supportingEventIds: z.array(z.string()),
  remediation: z.string().min(1, "Remediation recommendation must not be empty"),
  uncertaintyWarnings: z.array(z.string()),
  humanReviewRequired: z.boolean(),
});

export type UltramarineInvestigationOutput = z.infer<
  typeof UltramarineInvestigationSchema
>;

export interface UltramarineCost {
  uncachedInputTokens: number;
  cachedInputTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  isEstimated: false;
  formula: string;
}

export interface UltramarineEvidenceValidation {
  eventReferenceValid: boolean;
  validEventIds: string[];
  unsupportedEventIds: string[];
  causalClaimUnverified: boolean;
  humanReviewRequired: boolean;
  warningMessage?: string;
}

export interface UltramarineInvestigationResult {
  success: boolean;
  provider: "paperinstruments";
  model: "ultramarine-1-flash";
  executionMode: "live_inference";
  requestId?: string;
  latencyMs: number;
  investigation: UltramarineInvestigationOutput;
  evidenceValidation: UltramarineEvidenceValidation;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedPromptTokens?: number;
  };
  cost: UltramarineCost;
  rawTraceId: string;
  sanitizedEventCount: number;
}

export interface UltramarineAdapterOptions {
  apiKey?: string;
  baseURL?: string;
  modelName?: string;
  client?: OpenAI;
}

export class UltramarineError extends Error {
  code: string;
  statusCode?: number;
  requestId?: string;
  isRetryable: boolean;

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    requestId?: string,
    isRetryable: boolean = false
  ) {
    super(message);
    this.name = "UltramarineError";
    this.code = code;
    this.statusCode = statusCode;
    this.requestId = requestId;
    this.isRetryable = isRetryable;
  }
}

/**
 * Sanitizes sensitive key/value pairs and credential patterns before sending
 * trace payload to external LLM provider.
 */
export function sanitizeTraceData(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    // Redact JWT tokens, Bearer tokens, and common API key patterns
    return obj
      .replace(/Bearer\s+[A-Za-z0-9\-_.~+/]+=*/gi, "Bearer [REDACTED_TOKEN]")
      .replace(/ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, "[REDACTED_JWT]")
      .replace(/(?:sk|bk|pi|live|test)_[0-9a-zA-Z]{16,}/g, "[REDACTED_API_KEY]");
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeTraceData(item));
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (
        /^(authorization|cookie|password|secret|apikey|api_key|token|access_token|private_key)$/i.test(
          key
        )
      ) {
        sanitized[key] = "[REDACTED_SECRET]";
      } else {
        sanitized[key] = sanitizeTraceData(value);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Calculates real inference cost using Paper Instruments' documented rates:
 * - Uncached input: $0.15 / 1M tokens ($0.00000015 / token)
 * - Cached input: $0.03 / 1M tokens ($0.00000003 / token)
 * - Output (including reasoning): $0.50 / 1M tokens ($0.0000005 / token)
 */
export function calculateUltramarineCost(
  promptTokens: number,
  completionTokens: number,
  cachedTokens: number = 0
): UltramarineCost {
  const safeCached = Math.min(promptTokens, Math.max(0, cachedTokens));
  const uncachedInput = Math.max(0, promptTokens - safeCached);

  const uncachedCost = (uncachedInput * 0.15) / 1_000_000;
  const cachedCost = (safeCached * 0.03) / 1_000_000;
  const completionCost = (completionTokens * 0.5) / 1_000_000;

  const totalCost = uncachedCost + cachedCost + completionCost;

  return {
    uncachedInputTokens: uncachedInput,
    cachedInputTokens: safeCached,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    costUsd: Number(totalCost.toFixed(6)),
    isEstimated: false,
    formula: `(${uncachedInput} × $0.15 + ${safeCached} × $0.03 + ${completionTokens} × $0.50) / 1,000,000 = $${totalCost.toFixed(6)}`,
  };
}

export class UltramarineAdapter {
  private apiKey?: string;
  private baseURL: string;
  private modelName: string;
  private client?: OpenAI;

  constructor(options: UltramarineAdapterOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.PAPERINSTRUMENTS_API_KEY;
    this.baseURL =
      options.baseURL ??
      process.env.PAPERINSTRUMENTS_BASE_URL ??
      "https://api.paperinstruments.com/v1";
    this.modelName =
      options.modelName ??
      process.env.PAPERINSTRUMENTS_MODEL ??
      "ultramarine-1-flash";
    this.client = options.client;
  }

  /**
   * Helper to check whether a valid API key is present
   */
  isConfigured(): boolean {
    return Boolean(
      this.apiKey &&
        this.apiKey.trim().length > 0 &&
        this.apiKey !== "your_actual_api_key" &&
        this.apiKey !== "your_paperinstruments_api_key_here"
    );
  }

  private getClient(): OpenAI {
    if (this.client) {
      return this.client;
    }
    if (!this.isConfigured()) {
      throw new UltramarineError(
        "PAPERINSTRUMENTS_API_KEY is not configured. Please add your Paper Instruments API key to .env.local to enable live inference.",
        "API_KEY_MISSING",
        401,
        undefined,
        false
      );
    }
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
      maxRetries: 0, // Retries are handled with explicit boundaries below
    });
    return this.client;
  }

  /**
   * Constructs the specialized prompt for Ultramarine's reasoning engine
   */
  private buildForensicPrompt(timeline: ReconstructedTimeline): {
    systemPrompt: string;
    userPrompt: string;
  } {
    const sanitizedEvents = timeline.events.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      startTimeMs: e.startTimeMs,
      durationMs: e.durationMs,
      status: e.status,
      input: sanitizeTraceData(e.input),
      output: sanitizeTraceData(e.output),
      error: sanitizeTraceData(e.error),
      isCausalAnomaly: e.isCausalAnomaly,
    }));

    const systemPrompt = `You are GhostTrace's lead forensic investigator powered by Paper Instruments Ultramarine.
Your role is to perform rigorous causal root cause analysis on failed AI agent execution traces.

CRITICAL GROUNDING RULES:
1. Every claim in 'rootCause' must cite only verified event IDs present in the trace (e.g. evt_301, evt_302).
2. DO NOT hallucinate or extrapolate events that do not appear in the provided timeline.
3. If an upstream service or tool error caused a subsequent process crash, clearly map the causal dependency chain.
4. If certain context or external telemetry is missing, list them explicitly under 'uncertaintyWarnings' and set 'humanReviewRequired' to true.
5. Return ONLY a single valid JSON object adhering strictly to the requested schema.`;

    const userPrompt = `Investigate the following failed AI agent trace:

Agent: ${timeline.agentName}
Trace ID: ${timeline.traceId}
Status: ${timeline.status}
Total Duration: ${timeline.totalDurationMs}ms
Deterministic Detector Findings:
- Primary Failure Category: ${timeline.primaryFailureCategory}
- Detected Anomalies: ${JSON.stringify(timeline.anomalies, null, 2)}

Execution Timeline Events:
${JSON.stringify(sanitizedEvents, null, 2)}

Respond with a JSON object adhering to this schema:
{
  "summary": "Concise 1-2 sentence executive summary of the failure",
  "rootCause": "Detailed causal explanation linking trigger event to terminal failure",
  "failureCategory": "unhandled_tool_error | infinite_loop | parameter_hallucination | context_overflow | latency_stall | unknown",
  "supportingEventIds": ["string array of existing event IDs that directly substantiate the root cause"],
  "remediation": "Concrete, actionable engineering fix to prevent this failure",
  "uncertaintyWarnings": ["list of unverified assumptions or missing telemetry"],
  "humanReviewRequired": boolean
}`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Executes live forensic analysis using Paper Instruments Ultramarine-1-Flash
   */
  async analyzeFailureTrace(
    timeline: ReconstructedTimeline
  ): Promise<UltramarineInvestigationResult> {
    const client = this.getClient();
    const { systemPrompt, userPrompt } = this.buildForensicPrompt(timeline);
    const validEventIds = new Set(timeline.events.map((e) => e.id));
    const startTime = Date.now();

    recordAgentBreadcrumb(
      "inference",
      `Dispatching sanitized trace ${timeline.traceId} to Paper Instruments Ultramarine-1-Flash`,
      {
        traceId: timeline.traceId,
        model: this.modelName,
        eventsCount: timeline.events.length,
      }
    );

    // Bounded execution with max 1 retry for transient 502/503 errors
    let lastError: unknown;
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model: this.modelName,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_completion_tokens: 2048,
          reasoning_effort: "high",
          response_format: { type: "json_object" },
          stream: false,
        });

        const latencyMs = Math.max(1, Date.now() - startTime);
        const rawContent = response.choices?.[0]?.message?.content;
        const requestId = response._request_id ?? response.id;

        if (!rawContent || rawContent.trim().length === 0) {
          throw new UltramarineError(
            "Paper Instruments API returned an empty completion response",
            "EMPTY_RESPONSE",
            200,
            requestId,
            false
          );
        }

        // Parse and validate with Zod
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(rawContent);
        } catch {
          throw new UltramarineError(
            `Malformed JSON from Ultramarine API: ${rawContent.slice(0, 150)}...`,
            "MALFORMED_JSON",
            200,
            requestId,
            false
          );
        }

        const parseResult = UltramarineInvestigationSchema.safeParse(parsedJson);
        if (!parseResult.success) {
          throw new UltramarineError(
            `Response schema validation failed: ${parseResult.error.message}`,
            "SCHEMA_VALIDATION_FAILED",
            200,
            requestId,
            false
          );
        }

        const investigation = parseResult.data;

        // Evidence validation against actual trace events
        const supportedIds: string[] = [];
        const unsupportedIds: string[] = [];

        for (const id of investigation.supportingEventIds) {
          if (validEventIds.has(id)) {
            supportedIds.push(id);
          } else {
            unsupportedIds.push(id);
          }
        }

        const hasUnsupported = unsupportedIds.length > 0;
        const evidenceValidation: UltramarineEvidenceValidation = {
          eventReferenceValid: !hasUnsupported,
          validEventIds: supportedIds,
          unsupportedEventIds: unsupportedIds,
          causalClaimUnverified: hasUnsupported || investigation.humanReviewRequired,
          humanReviewRequired: hasUnsupported || investigation.humanReviewRequired,
          warningMessage: hasUnsupported
            ? `Model referenced non-existent event IDs: ${unsupportedIds.join(", ")}`
            : undefined,
        };

        // Usage and cost calculation
        const usage = response.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        };

        const cachedTokens =
          (usage as { prompt_tokens_details?: { cached_tokens?: number } })
            .prompt_tokens_details?.cached_tokens ?? 0;
        const cost = calculateUltramarineCost(
          usage.prompt_tokens,
          usage.completion_tokens,
          cachedTokens
        );

        recordAgentBreadcrumb(
          "grounding",
          `Ultramarine investigation completed for ${timeline.traceId} in ${latencyMs}ms ($${cost.costUsd})`,
          {
            traceId: timeline.traceId,
            costUsd: cost.costUsd,
            supportedIds,
            unsupportedIds,
            tokens: usage.total_tokens,
          }
        );

        return {
          success: true,
          provider: "paperinstruments",
          model: "ultramarine-1-flash",
          executionMode: "live_inference",
          requestId,
          latencyMs,
          investigation,
          evidenceValidation,
          tokenUsage: {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
            cachedPromptTokens: cachedTokens,
          },
          cost,
          rawTraceId: timeline.traceId,
          sanitizedEventCount: timeline.events.length,
        };
      } catch (err: unknown) {
        lastError = err;
        const errorRecord = err as { status?: number; statusCode?: number };
        const status = errorRecord?.status || errorRecord?.statusCode;
        const isTransient = status === 502 || status === 503;

        // Do not retry 401, 429 quota exhaustion, or client-side bad requests
        if (attempt === 0 && isTransient) {
          await new Promise((res) => setTimeout(res, 500));
          continue;
        }
        break;
      }
    }

    // Process typed error
    if (lastError instanceof UltramarineError) {
      throw lastError;
    }

    const errorRecord = lastError as {
      status?: number;
      statusCode?: number;
      message?: string;
    };
    const errorStatus = errorRecord?.status || errorRecord?.statusCode;
    const errorMsg = errorRecord?.message || String(lastError);

    if (errorStatus === 401) {
      throw new UltramarineError(
        "Paper Instruments authentication failed: Invalid or expired PAPERINSTRUMENTS_API_KEY",
        "AUTHENTICATION_FAILED",
        401,
        undefined,
        false
      );
    }

    if (errorStatus === 429) {
      throw new UltramarineError(
        "Paper Instruments rate limit or quota exceeded",
        "RATE_LIMIT_OR_QUOTA_EXCEEDED",
        429,
        undefined,
        false
      );
    }

    throw new UltramarineError(
      `Paper Instruments Ultramarine inference request failed: ${errorMsg}`,
      "UPSTREAM_REQUEST_FAILED",
      errorStatus || 500,
      undefined,
      false
    );
  }
}

export const defaultUltramarineAdapter = new UltramarineAdapter();
