import { describe, it, expect, vi } from "vitest";
import {
  BackboardAdapter,
  BackboardError,
  calculateBackboardCost,
  sanitizeTraceData,
  isSensitiveKey,
  BackboardInvestigationSchema,
} from "@/lib/ai/backboardAdapter";
import { ReconstructedTimeline } from "@/types/schema";
import fixture04 from "@/fixtures/fixture_04_unhandled_tool_crash.json";
import { reconstructTimeline } from "@/lib/detector";

describe("Backboard Studio / Sanzio Integration (TASK 05)", () => {
  const sampleTimeline: ReconstructedTimeline = reconstructTimeline(fixture04);

  describe("1. Sensitive Data Sanitization", () => {
    it("1.1 identifies and sanitizes 'authorization' header values", () => {
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

    it("1.6 identifies and sanitizes password, passwd, pass, and dbPassword", () => {
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
        promptTokens: 1200,
        completionTokens: 300,
        author: "Agent Smith",
      };
      const sanitized = sanitizeTraceData(telemetryObj) as Record<string, unknown>;
      expect(sanitized.totalTokens).toBe(1500);
      expect(sanitized.promptTokens).toBe(1200);
      expect(sanitized.completionTokens).toBe(300);
      expect(sanitized.author).toBe("Agent Smith");
    });
  });

  describe("2. Backboard Cost Calculation Formula", () => {
    it("2.1 calculates cost correctly for Gemma 2 27B IT ($0.20/1M prompt, $0.60/1M completion)", () => {
      // 1,000 prompt tokens = $0.0002
      // 500 completion tokens = $0.0003
      // Total = $0.0005
      const cost = calculateBackboardCost(1000, 500);
      expect(cost.isKnown).toBe(true);
      expect(cost.promptTokens).toBe(1000);
      expect(cost.completionTokens).toBe(500);
      expect(cost.totalTokens).toBe(1500);
      expect(cost.estimatedCostUsd).toBeCloseTo(0.0005, 6);
      expect(cost.formula).toContain("$0.20");
      expect(cost.formula).toContain("$0.60");
    });

    it("2.2 handles missing or null usage metadata gracefully without throwing", () => {
      const costNull = calculateBackboardCost(null, null);
      expect(costNull.isKnown).toBe(false);
      expect(costNull.promptTokens).toBeNull();
      expect(costNull.completionTokens).toBeNull();
      expect(costNull.totalTokens).toBeNull();
      expect(costNull.estimatedCostUsd).toBeNull();
      expect(costNull.formula).toContain("unavailable");

      const costUndefined = calculateBackboardCost(undefined, undefined);
      expect(costUndefined.isKnown).toBe(false);
      expect(costUndefined.estimatedCostUsd).toBeNull();
    });
  });

  describe("3. Missing API Key Verification", () => {
    it("3.1 rejects analysis with API_KEY_MISSING and 401 when unconfigured", async () => {
      const adapter = new BackboardAdapter({ apiKey: "" });
      expect(adapter.isConfigured()).toBe(false);

      await expect(adapter.analyzeFailureTrace(sampleTimeline)).rejects.toThrow(
        BackboardError
      );

      try {
        await adapter.analyzeFailureTrace(sampleTimeline);
      } catch (err: unknown) {
        const backboardErr = err as BackboardError;
        expect(backboardErr.code).toBe("API_KEY_MISSING");
        expect(backboardErr.statusCode).toBe(401);
      }
    });
  });

  describe("4. Schema Validation & Grounding Verification", () => {
    it("4.1 validates BackboardInvestigationSchema successfully with valid input", () => {
      const valid = {
        summary: "Trace crashed due to unhandled API 500",
        rootCause: "External service returned 500 which was not caught in the handler loop",
        failureCategory: "unhandled_tool_error",
        supportingEventIds: ["ev_1", "ev_2"],
        remediation: "Wrap fetch call in try/catch block",
        uncertaintyWarnings: ["Potential retry storm"],
        humanReviewRequired: false,
      };
      const parsed = BackboardInvestigationSchema.parse(valid);
      expect(parsed.summary).toBe(valid.summary);
      expect(parsed.humanReviewRequired).toBe(false);
    });

    it("4.2 rejects schema when required fields are missing", () => {
      const invalid = {
        summary: "Only summary provided",
      };
      expect(() => BackboardInvestigationSchema.parse(invalid)).toThrow();
    });

    it("4.3 detects hallucinated event IDs and sets causalStatus to unsupported_event_refs", async () => {
      const validIds = sampleTimeline.events.map(
        (e) => (e as unknown as { id?: string; eventId?: string }).id || (e as unknown as { id?: string; eventId?: string }).eventId || "evt_mock"
      );
      const mockResponseBody = {
        id: "bb_req_123",
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Hallucinated trace investigation",
                rootCause: "Agent hallucinated event reference",
                failureCategory: "parameter_hallucination",
                supportingEventIds: [validIds[0], "ev_hallucinated_9999"],
                remediation: "Verify event IDs against ground-truth timeline",
                uncertaintyWarnings: [],
                humanReviewRequired: false,
              }),
            },
          },
        ],
        usage: {
          prompt_tokens: 800,
          completion_tokens: 200,
          total_tokens: 1000,
        },
      };

      const mockFetch: typeof fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "x-request-id": "bb_req_123" }),
        json: () => Promise.resolve(mockResponseBody),
        text: () => Promise.resolve(JSON.stringify(mockResponseBody)),
      } as unknown as Response);

      const adapter = new BackboardAdapter({
        apiKey: "bb_test_key_valid",
        fetchFn: mockFetch,
      });

      const result = await adapter.analyzeFailureTrace(sampleTimeline);

      expect(result.success).toBe(true);
      expect(result.evidenceValidation.eventReferenceValid).toBe(false);
      expect(result.evidenceValidation.unsupportedEventIds).toContain(
        "ev_hallucinated_9999"
      );
      expect(result.evidenceValidation.causalClaimUnverified).toBe(true);
      expect(result.evidenceValidation.humanReviewRequired).toBe(true);
      expect(result.evidenceValidation.causalStatus).toBe(
        "unsupported_event_refs"
      );
    });

    it("4.4 sets causalStatus to unverified_llm_hypothesis when all event IDs exist", async () => {
      const validIds = sampleTimeline.events.map(
        (e) => (e as unknown as { id?: string; eventId?: string }).id || (e as unknown as { id?: string; eventId?: string }).eventId || "evt_mock"
      );
      const mockResponseBody = {
        id: "bb_req_456",
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Properly grounded investigation",
                rootCause: "Root cause found in valid events",
                failureCategory: "unhandled_tool_error",
                supportingEventIds: [validIds[0]],
                remediation: "Safe fix applied",
                uncertaintyWarnings: [],
                humanReviewRequired: false,
              }),
            },
          },
        ],
        usage: {
          prompt_tokens: 500,
          completion_tokens: 150,
          total_tokens: 650,
        },
      };

      const mockFetch: typeof fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "x-request-id": "bb_req_456" }),
        json: () => Promise.resolve(mockResponseBody),
        text: () => Promise.resolve(JSON.stringify(mockResponseBody)),
      } as unknown as Response);

      const adapter = new BackboardAdapter({
        apiKey: "bb_test_key_valid",
        fetchFn: mockFetch,
      });

      const result = await adapter.analyzeFailureTrace(sampleTimeline);

      expect(result.evidenceValidation.eventReferenceValid).toBe(true);
      expect(result.evidenceValidation.unsupportedEventIds.length).toBe(0);
      expect(result.evidenceValidation.causalClaimUnverified).toBe(true); // LLM hypothesis always unverified
      expect(result.evidenceValidation.causalStatus).toBe(
        "unverified_llm_hypothesis"
      );
    });
  });

  describe("5. Retry & Error Behavior", () => {
    it("5.1 fails immediately without retry on 401 Unauthorized", async () => {
      const mockFetch: typeof fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers(),
        text: () => Promise.resolve("Invalid API key provided"),
      } as unknown as Response);

      const adapter = new BackboardAdapter({
        apiKey: "bb_bad_key",
        fetchFn: mockFetch,
      });

      await expect(adapter.analyzeFailureTrace(sampleTimeline)).rejects.toThrow(
        BackboardError
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("5.2 fails immediately without retry on 429 Rate Limit", async () => {
      const mockFetch: typeof fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers(),
        text: () => Promise.resolve("Rate limit exceeded"),
      } as unknown as Response);

      const adapter = new BackboardAdapter({
        apiKey: "bb_test_key",
        fetchFn: mockFetch,
      });

      await expect(adapter.analyzeFailureTrace(sampleTimeline)).rejects.toThrow(
        BackboardError
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("5.3 retries once on 500 server error and succeeds if second attempt passes", async () => {
      const validIds = sampleTimeline.events.map(
        (e) => (e as unknown as { id?: string; eventId?: string }).id || (e as unknown as { id?: string; eventId?: string }).eventId || "evt_mock"
      );
      const validBody = {
        id: "bb_req_retry_ok",
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Recovered after retry",
                rootCause: "Temporary server error",
                failureCategory: "latency_stall",
                supportingEventIds: [validIds[0]],
                remediation: "Implement backoff",
                uncertaintyWarnings: [],
                humanReviewRequired: false,
              }),
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      };

      let callCount = 0;
      const mockFetch: typeof fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
            headers: new Headers(),
            text: () => Promise.resolve("Internal Server Error"),
          } as unknown as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "x-request-id": "bb_req_retry_ok" }),
          json: () => Promise.resolve(validBody),
          text: () => Promise.resolve(JSON.stringify(validBody)),
        } as unknown as Response);
      });

      const adapter = new BackboardAdapter({
        apiKey: "bb_test_key",
        fetchFn: mockFetch,
      });

      const result = await adapter.analyzeFailureTrace(sampleTimeline);
      expect(callCount).toBe(2);
      expect(result.success).toBe(true);
      expect(result.requestId).toBe("bb_req_retry_ok");
    });
  });
});
