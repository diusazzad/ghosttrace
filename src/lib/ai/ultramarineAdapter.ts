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
  uncachedInputTokens: number | null;
  cachedInputTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  isEstimated: boolean;
  isKnown: boolean;
  formula: string;
}

export interface UltramarineEvidenceValidation {
  eventReferenceValid: boolean;
  validEventIds: string[];
  unsupportedEventIds: string[];
  causalClaimUnverified: boolean;
  humanReviewRequired: boolean;
  warningMessage?: string;
  causalStatus: "unverified_llm_hypothesis" | "unsupported_event_refs";
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
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    cachedPromptTokens: number | null;
  } | null;
  cost: UltramarineCost;
  rawTraceId: string;
  sanitizedEventCount: number;
}

export interface UltramarineAdapterOptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  client?: OpenAI;
}

export class UltramarineError extends Error {
  readonly code:
    | "API_KEY_MISSING"
    | "AUTHENTICATION_FAILED"
    | "RATE_LIMIT_OR_QUOTA_EXCEEDED"
    | "UPSTREAM_REQUEST_FAILED"
    | "SCHEMA_VALIDATION_FAILED"
    | "MALFORMED_JSON"
    | "EMPTY_RESPONSE";
  readonly statusCode: number;
  readonly requestId?: string;
  readonly isRetryable: boolean;

  constructor(
    message: string,
    code: UltramarineError["code"],
    statusCode: number = 500,
    requestId?: string,
    isRetryable: boolean = false
  ) {
    super(`[Ultramarine] ${message}`);
    this.name = "UltramarineError";
    this.code = code;
    this.statusCode = statusCode;
    this.requestId = requestId;
    this.isRetryable = isRetryable;
  }
}

/**
 * Harmless telemetry keys that might contain substrings like "token" or "author"
 * but MUST NOT be redacted.
 */
const PRESERVED_TELEMETRY_KEYS = new Set([
  "tokens",
  "totaltokens",
  "prompttokens",
  "completiontokens",
  "cachedtokens",
  "cachedprompttokens",
  "author",
  "authority",
  "tokenusage",
  "token_usage",
]);

/**
 * Determines whether an object property name represents sensitive credentials,
 * secrets, tokens, or auth headers (supporting camelCase, snake_case, kebab-case).
 * GT-UM-01: Detects authorization, api_key, x-api-key, client_secret,
 * stripe_secret_key, refreshToken, accessToken, password, cookie, privateKey, credentials.
 */
export function isSensitiveKey(rawKey: string): boolean {
  if (!rawKey || typeof rawKey !== "string") return false;

  const normalized = rawKey.trim().toLowerCase().replace(/[-_]/g, "");
  if (PRESERVED_TELEMETRY_KEYS.has(normalized)) {
    return false;
  }

  const TARGET_SENSITIVE_PATTERNS = [
    "authorization",
    "apikey",
    "xapikey",
    "clientsecret",
    "stripesecretkey",
    "stripesecret",
    "refreshtoken",
    "accesstoken",
    "idtoken",
    "authtoken",
    "jwttoken",
    "bearertoken",
    "password",
    "passwd",
    "pass",
    "cookie",
    "cookies",
    "setcookie",
    "privatekey",
    "privkey",
    "secretkey",
    "secret",
    "credentials",
    "credential",
    "sessionid",
    "sessionsecret",
    "webhooksecret",
    "signingsecret",
  ];

  for (const pattern of TARGET_SENSITIVE_PATTERNS) {
    if (normalized === pattern || normalized.endsWith(pattern)) {
      return true;
    }
  }

  // Broad regex to catch variants like userPassword, db_password, my_secret, etc.
  if (
    /(?:^|[_-])(auth|authorization|token|secret|password|passwd|cookie|credential|credentials|privkey|private[_-]?key|api[_-]?key)(?:$|[_-])/i.test(
      rawKey
    )
  ) {
    return true;
  }

  // Catch camelCase variants: e.g. clientSecret, stripeSecretKey, refreshToken
  if (
    /[a-z0-9](Secret|Token|Password|Cookie|ApiKey|PrivateKey|Credentials)/.test(
      rawKey
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Sanitizes sensitive key/value pairs and credential patterns before sending
 * trace payload to external LLM provider.
 * GT-UM-01: Recursive sanitizer for nested objects, arrays, and credential values.
 */
export function sanitizeTraceData(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    // Redact Bearer tokens, JWT tokens, API keys, and GitHub personal tokens
    return obj
      .replace(/Bearer\s+[A-Za-z0-9\-_.~+/]+=*/gi, "Bearer [REDACTED_TOKEN]")
      .replace(/ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, "[REDACTED_JWT]")
      .replace(/(?:sk|pk|bk|pi|live|test|sec)_[0-9a-zA-Z_]{16,}/g, "[REDACTED_API_KEY]")
      .replace(/(?:ghp|gho|ghu|ghs|ghr)_[0-9a-zA-Z]{36,}/g, "[REDACTED_TOKEN]");
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeTraceData(item));
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
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
 *
 * GT-UM-04:
 * 1. Preserves full floating-point calculation precision internally (no early toFixed truncation).
 * 2. If usage metadata is missing/null, returns isKnown: false, costUsd: null without pretending zero cost.
 */
export function calculateUltramarineCost(
  promptTokens?: number | null,
  completionTokens?: number | null,
  cachedTokens?: number | null
): UltramarineCost {
  if (
    promptTokens === undefined ||
    promptTokens === null ||
    completionTokens === undefined ||
    completionTokens === null
  ) {
    return {
      uncachedInputTokens: null,
      cachedInputTokens: null,
      completionTokens: null,
      totalTokens: null,
      costUsd: null,
      isEstimated: true,
      isKnown: false,
      formula: "Usage metadata unavailable from provider",
    };
  }

  const safeCached = Math.min(promptTokens, Math.max(0, cachedTokens ?? 0));
  const uncachedInput = Math.max(0, promptTokens - safeCached);
  const completion = Math.max(0, completionTokens);
  const total = uncachedInput + safeCached + completion;

  // Uncached: $0.15 / 1M, Cached: $0.03 / 1M, Output: $0.50 / 1M
  // Internal calculation maintains full IEEE 754 precision
  const uncachedCost = (uncachedInput * 0.15) / 1_000_000;
  const cachedCost = (safeCached * 0.03) / 1_000_000;
  const completionCost = (completion * 0.5) / 1_000_000;
  const totalCostUsd = uncachedCost + cachedCost + completionCost;

  return {
    uncachedInputTokens: uncachedInput,
    cachedInputTokens: safeCached,
    completionTokens: completion,
    totalTokens: total,
    costUsd: totalCostUsd,
    isEstimated: false,
    isKnown: true,
    formula: `(${uncachedInput} × $0.15 + ${safeCached} × $0.03 + ${completion} × $0.50) / 1,000,000 = $${totalCostUsd.toFixed(6)}`,
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
    this.modelName = options.model ?? "ultramarine-1-flash";
    this.client = options.client;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  getClient(): OpenAI {
    if (this.client) {
      return this.client;
    }

    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new UltramarineError(
        "PAPERINSTRUMENTS_API_KEY is not configured in environment. Cannot perform live inference.",
        "API_KEY_MISSING",
        401,
        undefined,
        false
      );
    }

    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
    });

    return this.client;
  }

  buildForensicPrompt(timeline: ReconstructedTimeline): {
    systemPrompt: string;
    userPrompt: string;
  } {
    const sanitizedEvents = sanitizeTraceData(timeline.events);

    const systemPrompt = `You are GhostTrace's Senior Autonomous Agent Forensic Diagnostician, powered by Paper Instruments Ultramarine-1-Flash.
Your mission is to perform a rigorous causal investigation into an AI agent execution failure.

CRITICAL INVESTIGATION DIRECTIVES:
1. Identify the root cause mechanism that triggered the fatal trajectory.
2. Ground all claims in specific, existing event IDs from the provided timeline.
3. Distinguish between correlation and direct causation.
4. Provide a concrete, production-ready code remediation.
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

    // GT-UM-05: Bounded retry respecting retry-after and x-should-retry (Max 1 retry)
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

        // GT-UM-03: Event reference validity and Causal claim verification separation
        const hasUnsupported = unsupportedIds.length > 0;
        const eventReferenceValid = !hasUnsupported && supportedIds.length > 0;

        // Causal claim is unverified unless confirmed by a formal symbolic or semantic verifier.
        // Existence of referenced event IDs alone does NOT prove causal entailment!
        const causalClaimUnverified = true;

        // Human review is required if:
        // 1. Any unsupported or non-existent event IDs were referenced
        // 2. No supporting events were provided
        // 3. The model itself indicated humanReviewRequired
        // 4. Or the causal claim is unverified (all LLM hypotheses)
        const humanReviewRequired =
          hasUnsupported ||
          supportedIds.length === 0 ||
          investigation.humanReviewRequired ||
          causalClaimUnverified;

        const evidenceValidation: UltramarineEvidenceValidation = {
          eventReferenceValid,
          validEventIds: supportedIds,
          unsupportedEventIds: unsupportedIds,
          causalClaimUnverified,
          humanReviewRequired,
          causalStatus: hasUnsupported
            ? "unsupported_event_refs"
            : "unverified_llm_hypothesis",
          warningMessage: hasUnsupported
            ? `Model referenced non-existent event IDs: ${unsupportedIds.join(", ")}`
            : "Event citations exist in trace, but causal attribution is an AI hypothesis requiring human/symbolic verification.",
        };

        // GT-UM-04: Usage and cost calculation (accurate handling of present vs missing usage)
        const rawUsage = response.usage;
        let tokenUsage: {
          promptTokens: number | null;
          completionTokens: number | null;
          totalTokens: number | null;
          cachedPromptTokens: number | null;
        } | null = null;

        let cost: UltramarineCost;

        if (rawUsage && typeof rawUsage.prompt_tokens === "number") {
          const cachedTokens =
            (rawUsage as { prompt_tokens_details?: { cached_tokens?: number } })
              .prompt_tokens_details?.cached_tokens ?? 0;

          tokenUsage = {
            promptTokens: rawUsage.prompt_tokens,
            completionTokens: rawUsage.completion_tokens,
            totalTokens: rawUsage.total_tokens,
            cachedPromptTokens: cachedTokens,
          };

          cost = calculateUltramarineCost(
            rawUsage.prompt_tokens,
            rawUsage.completion_tokens,
            cachedTokens
          );
        } else {
          // Usage missing from API response: do not claim $0.000000 or zero tokens
          tokenUsage = {
            promptTokens: null,
            completionTokens: null,
            totalTokens: null,
            cachedPromptTokens: null,
          };
          cost = calculateUltramarineCost(null, null, null);
        }

        recordAgentBreadcrumb(
          "grounding",
          `Ultramarine investigation completed for ${timeline.traceId} in ${latencyMs}ms ($${cost.costUsd ?? "unknown"})`,
          {
            traceId: timeline.traceId,
            costUsd: cost.costUsd,
            supportedIds,
            unsupportedIds,
            tokens: rawUsage?.total_tokens ?? "unknown",
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
          tokenUsage,
          cost,
          rawTraceId: timeline.traceId,
          sanitizedEventCount: timeline.events.length,
        };
      } catch (err: unknown) {
        lastError = err;
        const errorRecord = err as {
          status?: number;
          statusCode?: number;
          headers?: Record<string, string>;
        };
        const status = errorRecord?.status || errorRecord?.statusCode;
        const headers = errorRecord?.headers || {};
        const xShouldRetry = headers["x-should-retry"] === "true";
        const isTransient = status === 502 || status === 503 || xShouldRetry;

        // Strictly do NOT retry 401 (auth) or 429 (quota / rate limit)
        if (attempt === 0 && isTransient && status !== 401 && status !== 429) {
          let delayMs = 500;
          const retryAfter = headers["retry-after"];
          if (retryAfter) {
            const parsedSeconds = parseInt(retryAfter, 10);
            if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
              delayMs = Math.min(3000, parsedSeconds * 1000);
            }
          }
          await new Promise((res) => setTimeout(res, delayMs));
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
