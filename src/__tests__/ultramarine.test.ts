import { describe, it, expect, vi } from "vitest";
import OpenAI from "openai";
import {
  UltramarineAdapter,
  UltramarineError,
  calculateUltramarineCost,
  sanitizeTraceData,
  isSensitiveKey,
  UltramarineInvestigationSchema,
} from "@/lib/ai/ultramarineAdapter";
import { ReconstructedTimeline } from "@/types/schema";
import fixture04 from "@/fixtures/fixture_04_unhandled_tool_crash.json";
import { reconstructTimeline } from "@/lib/detector";

describe("Paper Instruments Ultramarine Integration (TASK 04.1)", () => {
  const sampleTimeline: ReconstructedTimeline = reconstructTimeline(fixture04);

  describe("1. GT-UM-01: Sensitive Data Sanitization (Targeted Tests)", () => {
    it("1.1 identifies and sanitizes 'authorization' and Bearer header values", () => {
      const payload = {
        authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_data",
        normalKey: "value",
      };
      const sanitized = sanitizeTraceData(payload) as Record<string, unknown>;
      expect(sanitized.authorization).toBe("[REDACTED_SECRET]");
      expect(sanitized.normalKey).toBe("value");
    });

    it("1.2 identifies and sanitizes api_key and its variants (apiKey, x-api-key, x_api_key, xApiKey)", () => {
      const payload = {
        api_key: "key_1",
        apiKey: "key_2",
        "x-api-key": "key_3",
        x_api_key: "key_4",
        xApiKey: "key_5",
      };
      const sanitized = sanitizeTraceData(payload) as Record<string, unknown>;
      expect(sanitized.api_key).toBe("[REDACTED_SECRET]");
      expect(sanitized.apiKey).toBe("[REDACTED_SECRET]");
      expect(sanitized["x-api-key"]).toBe("[REDACTED_SECRET]");
      expect(sanitized.x_api_key).toBe("[REDACTED_SECRET]");
      expect(sanitized.xApiKey).toBe("[REDACTED_SECRET]");
    });

    it("1.3 identifies and sanitizes client_secret and clientSecret", () => {
      const payload = {
        client_secret: "secret_1",
        clientSecret: "secret_2",
      };
      const sanitized = sanitizeTraceData(payload) as Record<string, unknown>;
      expect(sanitized.client_secret).toBe("[REDACTED_SECRET]");
      expect(sanitized.clientSecret).toBe("[REDACTED_SECRET]");
    });

    it("1.4 identifies and sanitizes stripe_secret_key and stripeSecretKey", () => {
      const payload = {
        stripe_secret_key: "sec_key_1",
        stripeSecretKey: "sec_key_2",
      };
      const sanitized = sanitizeTraceData(payload) as Record<string, unknown>;
      expect(sanitized.stripe_secret_key).toBe("[REDACTED_SECRET]");
      expect(sanitized.stripeSecretKey).toBe("[REDACTED_SECRET]");
    });

    it("1.5 identifies and sanitizes refreshToken, refresh_token, accessToken, access_token", () => {
      const payload = {
        refreshToken: "rt_1",
        refresh_token: "rt_2",
        accessToken: "at_1",
        access_token: "at_2",
      };
      const sanitized = sanitizeTraceData(payload) as Record<string, unknown>;
      expect(sanitized.refreshToken).toBe("[REDACTED_SECRET]");
      expect(sanitized.refresh_token).toBe("[REDACTED_SECRET]");
      expect(sanitized.accessToken).toBe("[REDACTED_SECRET]");
      expect(sanitized.access_token).toBe("[REDACTED_SECRET]");
    });

    it("1.6 identifies and sanitizes password, passwd, and pass", () => {
      const payload = {
        password: "p1",
        passwd: "p2",
        pass: "p3",
        dbPassword: "p4",
      };
      const sanitized = sanitizeTraceData(payload) as Record<string, unknown>;
      expect(sanitized.password).toBe("[REDACTED_SECRET]");
      expect(sanitized.passwd).toBe("[REDACTED_SECRET]");
      expect(sanitized.pass).toBe("[REDACTED_SECRET]");
      expect(sanitized.dbPassword).toBe("[REDACTED_SECRET]");
    });

    it("1.7 identifies and sanitizes cookie, cookies, set-cookie, set_cookie", () => {
      const payload = {
        cookie: "sess=123",
        cookies: ["c1", "c2"],
        "set-cookie": "token=abc",
        set_cookie: "token=def",
      };
      const sanitized = sanitizeTraceData(payload) as Record<string, unknown>;
      expect(sanitized.cookie).toBe("[REDACTED_SECRET]");
      expect(sanitized.cookies).toBe("[REDACTED_SECRET]");
      expect(sanitized["set-cookie"]).toBe("[REDACTED_SECRET]");
      expect(sanitized.set_cookie).toBe("[REDACTED_SECRET]");
    });

    it("1.8 identifies and sanitizes privateKey, private_key, credentials, credential", () => {
      const payload = {
        privateKey: "-----BEGIN PRIVATE KEY-----...",
        private_key: "-----BEGIN PRIVATE KEY-----...",
        credentials: { user: "admin" },
        credential: "cred_val",
      };
      const sanitized = sanitizeTraceData(payload) as Record<string, unknown>;
      expect(sanitized.privateKey).toBe("[REDACTED_SECRET]");
      expect(sanitized.private_key).toBe("[REDACTED_SECRET]");
      expect(sanitized.credentials).toBe("[REDACTED_SECRET]");
      expect(sanitized.credential).toBe("[REDACTED_SECRET]");
    });

    it("1.9 recursively sanitizes deep nested structures and arrays", () => {
      const payload = {
        service: "payment_webhook",
        steps: [
          {
            stepId: 1,
            env: {
              apiKey: "nested_secret_key",
              database: "prod_db",
            },
          },
        ],
      };
      const sanitized = sanitizeTraceData(payload) as Record<string, unknown>;
      expect(sanitized.service).toBe("payment_webhook");
      const steps = sanitized.steps as Array<Record<string, unknown>>;
      const env = steps[0].env as Record<string, unknown>;
      expect(env.apiKey).toBe("[REDACTED_SECRET]");
      expect(env.database).toBe("prod_db");
    });

    it("1.10 preserves legitimate telemetry keys (tokens, totalTokens, promptTokens)", () => {
      expect(isSensitiveKey("tokens")).toBe(false);
      expect(isSensitiveKey("totalTokens")).toBe(false);
      expect(isSensitiveKey("promptTokens")).toBe(false);
      expect(isSensitiveKey("completionTokens")).toBe(false);
      expect(isSensitiveKey("tokenUsage")).toBe(false);

      const telemetryObj = {
        totalTokens: 1500,
        tokens: { prompt: 1000, completion: 500 },
      };
      const sanitized = sanitizeTraceData(telemetryObj) as Record<string, unknown>;
      expect(sanitized.totalTokens).toBe(1500);
      const tokens = sanitized.tokens as Record<string, number>;
      expect(tokens.prompt).toBe(1000);
      expect(tokens.completion).toBe(500);
    });
  });

  describe("2. GT-UM-03: Evidence Grounding vs Causal Verification Separation", () => {
    it("marks eventReferenceValid: true but maintains causalClaimUnverified: true for LLM hypotheses", async () => {
      const mockCompletion = {
        id: "chatcmpl_grounding_valid",
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Unhandled tool crash in settlement call.",
                rootCause: "HTTP 500 on evt_302 caused unhandled rejection at evt_303.",
                failureCategory: "unhandled_tool_error",
                supportingEventIds: ["evt_302", "evt_303"],
                remediation: "Add structured try/catch.",
                uncertaintyWarnings: [],
                humanReviewRequired: false,
              }),
            },
          },
        ],
        usage: { prompt_tokens: 1500, completion_tokens: 250, total_tokens: 1750 },
      };

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue(mockCompletion),
          },
        },
      } as unknown as OpenAI;

      const adapter = new UltramarineAdapter({ apiKey: "test_key", client: mockClient });
      const result = await adapter.analyzeFailureTrace(sampleTimeline);

      expect(result.evidenceValidation.eventReferenceValid).toBe(true);
      expect(result.evidenceValidation.validEventIds).toEqual(["evt_302", "evt_303"]);
      expect(result.evidenceValidation.unsupportedEventIds).toEqual([]);
      expect(result.evidenceValidation.causalClaimUnverified).toBe(true);
      expect(result.evidenceValidation.humanReviewRequired).toBe(true);
      expect(result.evidenceValidation.causalStatus).toBe("unverified_llm_hypothesis");
    });

    it("flags unsupported event IDs as hallucination and marks reference invalid", async () => {
      const mockCompletion = {
        id: "chatcmpl_hallucination",
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Fabricated failure scenario.",
                rootCause: "Triggered by non-existent event evt_9999.",
                failureCategory: "unhandled_tool_error",
                supportingEventIds: ["evt_302", "evt_9999"],
                remediation: "Review logs.",
                uncertaintyWarnings: [],
                humanReviewRequired: false,
              }),
            },
          },
        ],
        usage: { prompt_tokens: 1000, completion_tokens: 100, total_tokens: 1100 },
      };

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue(mockCompletion),
          },
        },
      } as unknown as OpenAI;

      const adapter = new UltramarineAdapter({ apiKey: "test_key", client: mockClient });
      const result = await adapter.analyzeFailureTrace(sampleTimeline);

      expect(result.evidenceValidation.eventReferenceValid).toBe(false);
      expect(result.evidenceValidation.unsupportedEventIds).toContain("evt_9999");
      expect(result.evidenceValidation.causalClaimUnverified).toBe(true);
      expect(result.evidenceValidation.humanReviewRequired).toBe(true);
      expect(result.evidenceValidation.causalStatus).toBe("unsupported_event_refs");
    });
  });

  describe("3. GT-UM-04: Accurate Cost & Missing Usage Handling", () => {
    it("handles missing usage metadata cleanly without claiming zero cost ($0.000000)", async () => {
      const mockCompletionNoUsage = {
        id: "chatcmpl_no_usage",
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Tool crash in payment webhook.",
                rootCause: "Settlement error on evt_302.",
                failureCategory: "unhandled_tool_error",
                supportingEventIds: ["evt_302"],
                remediation: "Add catch block.",
                uncertaintyWarnings: [],
                humanReviewRequired: false,
              }),
            },
          },
        ],
      };

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue(mockCompletionNoUsage),
          },
        },
      } as unknown as OpenAI;

      const adapter = new UltramarineAdapter({ apiKey: "test_key", client: mockClient });
      const result = await adapter.analyzeFailureTrace(sampleTimeline);

      expect(result.cost.isKnown).toBe(false);
      expect(result.cost.costUsd).toBeNull();
      expect(result.cost.totalTokens).toBeNull();
      expect(result.cost.uncachedInputTokens).toBeNull();
      expect(result.cost.cachedInputTokens).toBeNull();
      expect(result.cost.completionTokens).toBeNull();
      expect(result.tokenUsage?.totalTokens).toBeNull();
    });

    it("preserves full calculation precision when usage is present", () => {
      const cost = calculateUltramarineCost(20000, 1000, 0);
      expect(cost.isKnown).toBe(true);
      expect(cost.costUsd).toBeCloseTo(0.0035, 6);
      expect(cost.uncachedInputTokens).toBe(20000);
      expect(cost.completionTokens).toBe(1000);
      expect(cost.cachedInputTokens).toBe(0);

      const costCached = calculateUltramarineCost(10000, 1000, 8000);
      expect(costCached.isKnown).toBe(true);
      expect(costCached.uncachedInputTokens).toBe(2000);
      expect(costCached.cachedInputTokens).toBe(8000);
      expect(costCached.costUsd).toBeCloseTo(0.00104, 6);
    });
  });

  describe("4. GT-UM-05: Retry Behaviour & Safeguards", () => {
    it("strictly does NOT retry on 401 Authentication Failure", async () => {
      const authError = Object.assign(new Error("Invalid API Key"), { status: 401 });
      const mockClient = {
        chat: { completions: { create: vi.fn().mockRejectedValue(authError) } },
      } as unknown as OpenAI;

      const adapter = new UltramarineAdapter({ apiKey: "bad_key", client: mockClient });
      await expect(adapter.analyzeFailureTrace(sampleTimeline)).rejects.toThrow(
        UltramarineError
      );
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it("strictly does NOT retry on 429 Rate Limit / Quota Exceeded", async () => {
      const quotaError = Object.assign(new Error("Insufficient quota"), { status: 429 });
      const mockClient = {
        chat: { completions: { create: vi.fn().mockRejectedValue(quotaError) } },
      } as unknown as OpenAI;

      const adapter = new UltramarineAdapter({ apiKey: "test_key", client: mockClient });
      await expect(adapter.analyzeFailureTrace(sampleTimeline)).rejects.toThrow(
        UltramarineError
      );
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it("retries at most once on transient 502/503 or x-should-retry header", async () => {
      const transientError = Object.assign(new Error("Bad Gateway"), {
        status: 502,
        headers: { "x-should-retry": "true", "retry-after": "1" },
      });

      const successCompletion = {
        id: "chatcmpl_recovered",
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Recovered from retry.",
                rootCause: "Transient gateway reset on evt_302.",
                failureCategory: "unhandled_tool_error",
                supportingEventIds: ["evt_302"],
                remediation: "Add gateway retry.",
                uncertaintyWarnings: [],
                humanReviewRequired: false,
              }),
            },
          },
        ],
        usage: { prompt_tokens: 1000, completion_tokens: 100, total_tokens: 1100 },
      };

      const mockClient = {
        chat: {
          completions: {
            create: vi
              .fn()
              .mockRejectedValueOnce(transientError)
              .mockResolvedValueOnce(successCompletion),
          },
        },
      } as unknown as OpenAI;

      const adapter = new UltramarineAdapter({ apiKey: "test_key", client: mockClient });
      const result = await adapter.analyzeFailureTrace(sampleTimeline);
      expect(result.success).toBe(true);
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("5. Schema & Configuration", () => {
    it("throws a clean typed UltramarineError when API key is missing", async () => {
      const adapter = new UltramarineAdapter({ apiKey: "" });
      expect(adapter.isConfigured()).toBe(false);

      await expect(adapter.analyzeFailureTrace(sampleTimeline)).rejects.toThrow(
        UltramarineError
      );
    });

    it("rejects invalid output that fails Zod schema validation", () => {
      const invalid = {
        summary: "Invalid output",
        failureCategory: "unhandled_tool_error",
      };
      const result = UltramarineInvestigationSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
