import { describe, it, expect, vi } from "vitest";
import OpenAI from "openai";
import {
  UltramarineAdapter,
  UltramarineError,
  calculateUltramarineCost,
  sanitizeTraceData,
  UltramarineInvestigationSchema,
} from "@/lib/ai/ultramarineAdapter";
import { ReconstructedTimeline } from "@/types/schema";
import fixture04 from "@/fixtures/fixture_04_unhandled_tool_crash.json";
import { reconstructTimeline } from "@/lib/detector";

describe("Paper Instruments Ultramarine Integration (TASK 04)", () => {
  const sampleTimeline: ReconstructedTimeline = reconstructTimeline(fixture04);

  describe("1. Configuration & Security Safeguards", () => {
    it("throws a clean typed UltramarineError when API key is missing", async () => {
      const adapter = new UltramarineAdapter({ apiKey: "" });
      expect(adapter.isConfigured()).toBe(false);

      await expect(
        adapter.analyzeFailureTrace(sampleTimeline)
      ).rejects.toThrowError(
        /PAPERINSTRUMENTS_API_KEY is not configured/
      );
    });

    it("does not fake live inference with deterministic fallback when API key is missing", async () => {
      const adapter = new UltramarineAdapter({ apiKey: "" });

      try {
        await adapter.analyzeFailureTrace(sampleTimeline);
        expect.unreachable("Should have thrown UltramarineError");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UltramarineError);
        const ultramarineError = err as UltramarineError;
        expect(ultramarineError.code).toBe("API_KEY_MISSING");
        expect(ultramarineError.statusCode).toBe(401);
      }
    });

    it("properly sanitizes secrets, authorization headers, JWTs, and API keys", () => {
      const sensitivePayload = {
        authorization: "Bearer dummy_test_token_content_12345",
        apiKey: "pi_test_dummy_mock_key_0987654321",
        password: "super_secret_password",
        toolArgs: {
          token: "secret_token_val",
          publicParam: "charge_ch_123",
          deepNested: {
            cookie: "session=xyz123",
            normalData: "stripe_settlement",
          },
        },
      };

      const sanitized = sanitizeTraceData(sensitivePayload) as Record<string, unknown>;

      expect(sanitized.authorization).toBe("[REDACTED_SECRET]");
      expect(sanitized.apiKey).toBe("[REDACTED_SECRET]");
      expect(sanitized.password).toBe("[REDACTED_SECRET]");
      const toolArgs = sanitized.toolArgs as Record<string, unknown>;
      expect(toolArgs.token).toBe("[REDACTED_SECRET]");
      expect(toolArgs.publicParam).toBe("charge_ch_123");
      const deepNested = toolArgs.deepNested as Record<string, unknown>;
      expect(deepNested.cookie).toBe("[REDACTED_SECRET]");
      expect(deepNested.normalData).toBe("stripe_settlement");
    });
  });

  describe("2. Documented Rate & Cost Calculation", () => {
    it("calculates exact USD cost using official rates: $0.15/1M uncached, $0.03/1M cached, $0.50/1M completion", () => {
      // Official documentation example: 20,000 uncached input + 1,000 output = $0.003500
      const cost = calculateUltramarineCost(20000, 1000, 0);
      expect(cost.uncachedInputTokens).toBe(20000);
      expect(cost.cachedInputTokens).toBe(0);
      expect(cost.completionTokens).toBe(1000);
      expect(cost.totalTokens).toBe(21000);
      expect(cost.costUsd).toBe(0.0035);
      expect(cost.isEstimated).toBe(false);
    });

    it("correctly factors cached prompt token discount ($0.03/1M)", () => {
      // 10,000 total prompt tokens, 8,000 cached, 2,000 uncached, 1,000 completion
      // Uncached: 2,000 * 0.15 / 1e6 = $0.000300
      // Cached: 8,000 * 0.03 / 1e6 = $0.000240
      // Completion: 1,000 * 0.50 / 1e6 = $0.000500
      // Total: 0.000300 + 0.000240 + 0.000500 = $0.001040
      const cost = calculateUltramarineCost(10000, 1000, 8000);
      expect(cost.uncachedInputTokens).toBe(2000);
      expect(cost.cachedInputTokens).toBe(8000);
      expect(cost.completionTokens).toBe(1000);
      expect(cost.costUsd).toBe(0.00104);
    });
  });

  describe("3. Zod Schema Validation & Grounding", () => {
    it("validates valid Ultramarine investigation output schema", () => {
      const validOutput = {
        summary: "Process exited due to unhandled promise rejection in payment settlement.",
        rootCause:
          "call_stripe_settlement (evt_302) failed with HTTP 500 which was not caught, causing unhandled_process_exit (evt_303).",
        failureCategory: "unhandled_tool_error",
        supportingEventIds: ["evt_302", "evt_303"],
        remediation: "Wrap call_stripe_settlement in try/catch block with exponential backoff.",
        uncertaintyWarnings: [
          "External Stripe status could not be verified without upstream telemetry.",
        ],
        humanReviewRequired: false,
      };

      const result = UltramarineInvestigationSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it("fails validation if required fields are missing", () => {
      const invalidOutput = {
        summary: "Missing root cause",
        // rootCause missing
        failureCategory: "unhandled_tool_error",
        supportingEventIds: ["evt_302"],
      };

      const result = UltramarineInvestigationSchema.safeParse(invalidOutput);
      expect(result.success).toBe(false);
    });
  });

  describe("4. End-to-End Mocked Inference & Error Handling", () => {
    it("successfully parses model response, calculates cost, and validates supporting evidence", async () => {
      const mockCompletion = {
        id: "chatcmpl_pi_98765",
        _request_id: "req_ultramarine_abc123",
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Payment settlement crashed due to uncaught HTTP 500 error from gateway.",
                rootCause:
                  "Event evt_302 returned HTTP 500 connection reset, which triggered unhandled rejection at evt_303.",
                failureCategory: "unhandled_tool_error",
                supportingEventIds: ["evt_302", "evt_303"],
                remediation: "Add structured error handling and retry mechanism around call_stripe_settlement.",
                uncertaintyWarnings: [],
                humanReviewRequired: false,
              }),
            },
          },
        ],
        usage: {
          prompt_tokens: 1500,
          completion_tokens: 350,
          total_tokens: 1850,
        },
      };

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue(mockCompletion),
          },
        },
      } as unknown as OpenAI;

      const adapter = new UltramarineAdapter({
        apiKey: "test_key",
        client: mockClient,
      });

      const result = await adapter.analyzeFailureTrace(sampleTimeline);

      expect(result.success).toBe(true);
      expect(result.provider).toBe("paperinstruments");
      expect(result.model).toBe("ultramarine-1-flash");
      expect(result.executionMode).toBe("live_inference");
      expect(result.requestId).toBe("req_ultramarine_abc123");
      expect(result.evidenceValidation.eventReferenceValid).toBe(true);
      expect(result.evidenceValidation.validEventIds).toEqual(["evt_302", "evt_303"]);
      expect(result.cost.costUsd).toBeGreaterThan(0);
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it("flags unsupported event IDs as hallucination and marks humanReviewRequired", async () => {
      const mockCompletion = {
        id: "chatcmpl_pi_hallucination",
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Fabricated failure scenario.",
                rootCause: "Attributing error to non-existent event evt_999.",
                failureCategory: "unhandled_tool_error",
                supportingEventIds: ["evt_302", "evt_999"], // evt_999 does not exist in Fixture 04
                remediation: "Check server logs.",
                uncertaintyWarnings: [],
                humanReviewRequired: false,
              }),
            },
          },
        ],
        usage: { prompt_tokens: 1000, completion_tokens: 200, total_tokens: 1200 },
      };

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue(mockCompletion),
          },
        },
      } as unknown as OpenAI;

      const adapter = new UltramarineAdapter({
        apiKey: "test_key",
        client: mockClient,
      });

      const result = await adapter.analyzeFailureTrace(sampleTimeline);

      expect(result.evidenceValidation.eventReferenceValid).toBe(false);
      expect(result.evidenceValidation.unsupportedEventIds).toContain("evt_999");
      expect(result.evidenceValidation.causalClaimUnverified).toBe(true);
      expect(result.evidenceValidation.humanReviewRequired).toBe(true);
    });

    it("handles 401 authentication failures cleanly without automatic retries", async () => {
      const authError = Object.assign(new Error("Invalid API Key"), { status: 401 });

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(authError),
          },
        },
      } as unknown as OpenAI;

      const adapter = new UltramarineAdapter({
        apiKey: "bad_key",
        client: mockClient,
      });

      await expect(adapter.analyzeFailureTrace(sampleTimeline)).rejects.toThrowError(
        /Paper Instruments authentication failed/
      );
      // 401 must NOT be retried
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it("handles 429 quota failures cleanly without automatic retries", async () => {
      const quotaError = Object.assign(new Error("Insufficient quota"), { status: 429 });

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(quotaError),
          },
        },
      } as unknown as OpenAI;

      const adapter = new UltramarineAdapter({
        apiKey: "test_key",
        client: mockClient,
      });

      await expect(adapter.analyzeFailureTrace(sampleTimeline)).rejects.toThrowError(
        /rate limit or quota exceeded/
      );
      // 429 must NOT be retried
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it("retries at most once on transient 502/503 upstream errors", async () => {
      const transientError = Object.assign(new Error("Bad Gateway"), { status: 502 });

      const successfulCompletion = {
        id: "chatcmpl_retry",
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Resolved after 1 transient retry.",
                rootCause: "Stripe connection drop at evt_302.",
                failureCategory: "unhandled_tool_error",
                supportingEventIds: ["evt_302"],
                remediation: "Add network timeout handling.",
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
              .mockResolvedValueOnce(successfulCompletion),
          },
        },
      } as unknown as OpenAI;

      const adapter = new UltramarineAdapter({
        apiKey: "test_key",
        client: mockClient,
      });

      const result = await adapter.analyzeFailureTrace(sampleTimeline);
      expect(result.success).toBe(true);
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it("rejects malformed non-JSON responses without pretending success", async () => {
      const badJsonCompletion = {
        id: "chatcmpl_bad_json",
        choices: [{ message: { content: "Internal Server Error: Oops <html..." } }],
      };

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue(badJsonCompletion),
          },
        },
      } as unknown as OpenAI;

      const adapter = new UltramarineAdapter({
        apiKey: "test_key",
        client: mockClient,
      });

      await expect(adapter.analyzeFailureTrace(sampleTimeline)).rejects.toThrowError(
        /Malformed JSON/
      );
    });
  });
});
