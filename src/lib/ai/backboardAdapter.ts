import { z } from "zod";
import { ReconstructedTimeline } from "@/types/schema";
import { recordAgentBreadcrumb } from "@/lib/telemetry/sentryTracer";

/**
 * Zod schema enforcing the structure of Backboard's forensic investigation output
 */
export const BackboardInvestigationSchema = z.object({
  summary: z.string().min(1, "Summary must not be empty"),
  rootCause: z.string().min(1, "Root cause explanation must not be empty"),
  failureCategory: z.string().min(1, "Failure category must not be empty"),
  supportingEventIds: z.array(z.string()),
  remediation: z.string().min(1, "Remediation recommendation must not be empty"),
  uncertaintyWarnings: z.array(z.string()),
  humanReviewRequired: z.boolean(),
});

export type BackboardInvestigationOutput = z.infer<
  typeof BackboardInvestigationSchema
>;

export interface BackboardCost {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  isKnown: boolean;
  formula: string;
}

export interface BackboardEvidenceValidation {
  eventReferenceValid: boolean;
  validEventIds: string[];
  unsupportedEventIds: string[];
  causalClaimUnverified: boolean;
  humanReviewRequired: boolean;
  warningMessage?: string;
  causalStatus: "unverified_llm_hypothesis" | "unsupported_event_refs";
}

export interface BackboardInvestigationResult {
  success: boolean;
  provider: "backboard";
  model: string;
  executionMode: "live_inference";
  requestId?: string;
  latencyMs: number;
  investigation: BackboardInvestigationOutput;
  evidenceValidation: BackboardEvidenceValidation;
  tokenUsage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  } | null;
  cost: BackboardCost;
  rawTraceId: string;
  sanitizedEventCount: number;
}

export interface BackboardAdapterOptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  fetchFn?: typeof fetch;
}

export class BackboardError extends Error {
  readonly code:
    | "API_KEY_MISSING"
    | "AUTHENTICATION_FAILED"
    | "RATE_LIMIT_EXCEEDED"
    | "UPSTREAM_REQUEST_FAILED"
    | "SCHEMA_VALIDATION_FAILED"
    | "MALFORMED_JSON"
    | "EMPTY_RESPONSE";
  readonly statusCode: number;
  readonly requestId?: string;
  readonly isRetryable: boolean;

  constructor(
    message: string,
    code: BackboardError["code"],
    statusCode: number = 500,
    requestId?: string,
    isRetryable: boolean = false
  ) {
    super(`[Backboard] ${message}`);
    this.name = "BackboardError";
    this.code = code;
    this.statusCode = statusCode;
    this.requestId = requestId;
    this.isRetryable = isRetryable;
  }
}

/**
 * Harmless telemetry keys that MUST NOT be redacted.
 */
const PRESERVED_TELEMETRY_KEYS = new Set([
  "tokens",
  "totaltokens",
  "prompttokens",
  "completiontokens",
  "cachedtokens",
  "author",
  "authority",
  "tokenusage",
  "token_usage",
]);

/**
 * Checks whether a key corresponds to sensitive credentials.
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

  if (
    /(?:^|[_-])(auth|authorization|token|secret|password|passwd|cookie|credential|credentials|privkey|private[_-]?key|api[_-]?key)(?:$|[_-])/i.test(
      rawKey
    )
  ) {
    return true;
  }

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
 * Recursively scrubs credentials and sensitive headers before network transmission.
 */
export function sanitizeTraceData(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
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
 * Calculates inference cost for Backboard models (e.g. Gemma 27B / Sanzio):
 * Standard rate baseline: $0.20 / 1M prompt tokens, $0.60 / 1M completion tokens.
 */
export function calculateBackboardCost(
  promptTokens?: number | null,
  completionTokens?: number | null
): BackboardCost {
  if (
    promptTokens === undefined ||
    promptTokens === null ||
    completionTokens === undefined ||
    completionTokens === null
  ) {
    return {
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      estimatedCostUsd: null,
      isKnown: false,
      formula: "Usage metadata unavailable from Backboard API",
    };
  }

  const prompt = Math.max(0, promptTokens);
  const completion = Math.max(0, completionTokens);
  const total = prompt + completion;

  // Rate: $0.20/1M prompt, $0.60/1M completion
  const promptCost = (prompt * 0.2) / 1_000_000;
  const completionCost = (completion * 0.6) / 1_000_000;
  const totalCost = promptCost + completionCost;

  return {
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: total,
    estimatedCostUsd: totalCost,
    isKnown: true,
    formula: `(${prompt} × $0.20 + ${completion} × $0.60) / 1,000,000 = $${totalCost.toFixed(6)}`,
  };
}

export class BackboardAdapter {
  private apiKey?: string;
  private baseURL: string;
  private modelName: string;
  private fetchFn: typeof fetch;

  constructor(options: BackboardAdapterOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.BACKBOARD_API_KEY;
    this.baseURL =
      options.baseURL ??
      process.env.BACKBOARD_BASE_URL ??
      "https://api.backboard.io/v1";
    this.modelName =
      options.model ??
      process.env.BACKBOARD_MODEL ??
      "google/gemma-2-27b-it";
    this.fetchFn = options.fetchFn ?? fetch;
  }

  isConfigured(): boolean {
    return Boolean(
      this.apiKey &&
      this.apiKey.trim().length > 0 &&
      this.apiKey !== "your_backboard_api_key_here"
    );
  }

  buildForensicPrompt(timeline: ReconstructedTimeline): {
    systemPrompt: string;
    userPrompt: string;
  } {
    const sanitizedEvents = sanitizeTraceData(timeline.events);

    const systemPrompt = `You are GhostTrace's Senior Autonomous Agent Forensic Diagnostician, powered by Backboard Studio / Sanzio.
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
Deterministic Findings:
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
   * Executes live forensic analysis using Backboard Studio API
   */
  async analyzeFailureTrace(
    timeline: ReconstructedTimeline
  ): Promise<BackboardInvestigationResult> {
    if (!this.isConfigured()) {
      throw new BackboardError(
        "BACKBOARD_API_KEY is not configured in environment. Cannot perform live inference.",
        "API_KEY_MISSING",
        401,
        undefined,
        false
      );
    }

    const { systemPrompt, userPrompt } = this.buildForensicPrompt(timeline);
    const validEventIds = new Set(
      timeline.events.map((e) => (e as unknown as { id?: string; eventId?: string }).id || (e as unknown as { id?: string; eventId?: string }).eventId || "")
    );
    const startTime = Date.now();

    recordAgentBreadcrumb(
      "inference",
      `Dispatching sanitized trace ${timeline.traceId} to Backboard Studio (${this.modelName})`,
      {
        traceId: timeline.traceId,
        model: this.modelName,
        eventsCount: timeline.events.length,
      }
    );

    let lastError: unknown;
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        const url = `${this.baseURL}/chat/completions`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        let res: Response;
        try {
          res = await this.fetchFn(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.apiKey}`,
            },
            signal: controller.signal,
            body: JSON.stringify({
              model: this.modelName,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              response_format: { type: "json_object" },
              temperature: 0.1,
            }),
          });
        } finally {
          clearTimeout(timeout);
        }

        const requestId = res.headers.get("x-request-id") ?? undefined;
        const xShouldRetry = res.headers.get("x-should-retry") === "true";
        const retryAfter = res.headers.get("retry-after");

        if (!res.ok) {
          if (res.status === 401) {
            throw new BackboardError(
              "Backboard authentication failed: Invalid or expired BACKBOARD_API_KEY",
              "AUTHENTICATION_FAILED",
              401,
              requestId,
              false
            );
          }
          if (res.status === 429) {
            throw new BackboardError(
              "Backboard rate limit or quota exceeded",
              "RATE_LIMIT_EXCEEDED",
              429,
              requestId,
              false
            );
          }

          const isTransient = res.status === 500 || res.status === 502 || res.status === 503 || xShouldRetry;
          if (attempt === 0 && isTransient) {
            let delayMs = 500;
            if (retryAfter) {
              const parsed = parseInt(retryAfter, 10);
              if (!isNaN(parsed) && parsed > 0) delayMs = Math.min(3000, parsed * 1000);
            }
            await new Promise((r) => setTimeout(r, delayMs));
            continue;
          }

          throw new BackboardError(
            `Backboard upstream HTTP error: ${res.status} ${res.statusText}`,
            "UPSTREAM_REQUEST_FAILED",
            res.status,
            requestId,
            false
          );
        }

        const data = await res.json();
        const latencyMs = Math.max(1, Date.now() - startTime);
        const rawContent = data.choices?.[0]?.message?.content;

        if (!rawContent || String(rawContent).trim().length === 0) {
          throw new BackboardError(
            "Backboard API returned an empty completion response",
            "EMPTY_RESPONSE",
            200,
            requestId,
            false
          );
        }

        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(rawContent);
        } catch {
          throw new BackboardError(
            `Malformed JSON from Backboard API: ${String(rawContent).slice(0, 150)}...`,
            "MALFORMED_JSON",
            200,
            requestId,
            false
          );
        }

        const parseResult = BackboardInvestigationSchema.safeParse(parsedJson);
        if (!parseResult.success) {
          throw new BackboardError(
            `Response schema validation failed: ${parseResult.error.message}`,
            "SCHEMA_VALIDATION_FAILED",
            200,
            requestId,
            false
          );
        }

        const investigation = parseResult.data;

        // Evidence validation against timeline events
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
        const eventReferenceValid = !hasUnsupported && supportedIds.length > 0;
        const causalClaimUnverified = true;
        const humanReviewRequired =
          hasUnsupported ||
          supportedIds.length === 0 ||
          investigation.humanReviewRequired ||
          causalClaimUnverified;

        const evidenceValidation: BackboardEvidenceValidation = {
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

        // Usage and cost calculation
        const rawUsage = data.usage;
        let tokenUsage: {
          promptTokens: number | null;
          completionTokens: number | null;
          totalTokens: number | null;
        } | null = null;
        let cost: BackboardCost;

        if (rawUsage && typeof rawUsage.prompt_tokens === "number") {
          tokenUsage = {
            promptTokens: rawUsage.prompt_tokens,
            completionTokens: rawUsage.completion_tokens,
            totalTokens: rawUsage.total_tokens,
          };
          cost = calculateBackboardCost(rawUsage.prompt_tokens, rawUsage.completion_tokens);
        } else {
          tokenUsage = {
            promptTokens: null,
            completionTokens: null,
            totalTokens: null,
          };
          cost = calculateBackboardCost(null, null);
        }

        return {
          success: true,
          provider: "backboard",
          model: this.modelName,
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
        if (err instanceof BackboardError) {
          if (err.code === "AUTHENTICATION_FAILED" || err.code === "RATE_LIMIT_EXCEEDED") {
            throw err;
          }
        }
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        break;
      }
    }

    if (lastError instanceof BackboardError) {
      throw lastError;
    }

    throw new BackboardError(
      `Backboard inference request failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
      "UPSTREAM_REQUEST_FAILED",
      500,
      undefined,
      false
    );
  }
}

export const defaultBackboardAdapter = new BackboardAdapter();
