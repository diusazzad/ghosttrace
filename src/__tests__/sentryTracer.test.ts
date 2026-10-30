import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Sentry from "@sentry/nextjs";
import {
  recordAgentBreadcrumb,
  startAgentWorkflowSpan,
  startAgentStepSpan,
  startGemmaInferenceSpan,
  captureAgentFailure,
  GEN_AI_SYSTEM,
  GEN_AI_OPERATION_NAME,
  GEN_AI_REQUEST_MODEL,
  GEN_AI_CONVERSATION_ID,
} from "@/lib/telemetry/sentryTracer";

vi.mock("@sentry/nextjs", () => {
  const mockSetAttribute = vi.fn();
  return {
    addBreadcrumb: vi.fn(),
    startSpan: vi.fn(async (_opts, fn) => {
      const mockSpan = { setAttribute: mockSetAttribute };
      return fn(mockSpan);
    }),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    withScope: vi.fn((fn) => {
      const scope = {
        setTag: vi.fn(),
        setContext: vi.fn(),
      };
      fn(scope);
    }),
  };
});

describe("Sentry Agent Tracing & GenAI Spans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records structured agent breadcrumbs with agent namespace", () => {
    recordAgentBreadcrumb("anomaly", "Infinite loop detected at evt_003", {
      traceId: "trace_loop_01",
      cycleLength: 3,
    });

    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(1);
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "agent.anomaly",
        message: "Infinite loop detected at evt_003",
        data: {
          traceId: "trace_loop_01",
          cycleLength: 3,
        },
        level: "info",
      })
    );
  });

  it("creates an end-to-end agent workflow span with GenAI attributes", async () => {
    const result = await startAgentWorkflowSpan("trace_wf_123", async () => {
      return { status: "investigated", findingsCount: 2 };
    });

    expect(result).toEqual({ status: "investigated", findingsCount: 2 });
    expect(Sentry.startSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "GhostTrace Agent Forensic Workflow",
        op: "gen_ai.workflow",
        attributes: expect.objectContaining({
          [GEN_AI_SYSTEM]: "ghosttrace",
          [GEN_AI_OPERATION_NAME]: "forensic_investigation",
          [GEN_AI_CONVERSATION_ID]: "trace_wf_123",
        }),
      }),
      expect.any(Function)
    );
  });

  it("creates granular step spans with attributes and breadcrumbs", async () => {
    const stepResult = await startAgentStepSpan(
      {
        stepName: "step2_detectAnomalies",
        op: "gen_ai.analysis",
        traceId: "trace_step_01",
        attributes: { "ghosttrace.anomalies_count": 1 },
      },
      async () => "analysis_complete"
    );

    expect(stepResult).toBe("analysis_complete");
    expect(Sentry.startSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "ai.step.step2_detectAnomalies",
        op: "gen_ai.analysis",
        attributes: expect.objectContaining({
          [GEN_AI_SYSTEM]: "ghosttrace",
          [GEN_AI_OPERATION_NAME]: "step2_detectAnomalies",
          [GEN_AI_CONVERSATION_ID]: "trace_step_01",
          "ghosttrace.anomalies_count": 1,
        }),
      }),
      expect.any(Function)
    );
    expect(Sentry.addBreadcrumb).toHaveBeenCalled();
  });

  it("instruments Google Gemma 2 inference with model and provider attributes", async () => {
    const hypothesis = await startGemmaInferenceSpan(
      "google/gemma-2-9b-it",
      "backboard",
      "trace_ai_99",
      async () => ({ title: "Grounded Root Cause" })
    );

    expect(hypothesis.title).toBe("Grounded Root Cause");
    expect(Sentry.startSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Google Gemma 2 Root Cause Reasoning",
        op: "gen_ai.chat",
        attributes: expect.objectContaining({
          [GEN_AI_SYSTEM]: "google_gemma",
          [GEN_AI_REQUEST_MODEL]: "google/gemma-2-9b-it",
          [GEN_AI_OPERATION_NAME]: "root_cause_hypothesis",
          [GEN_AI_CONVERSATION_ID]: "trace_ai_99",
          "gen_ai.provider": "backboard",
        }),
      }),
      expect.any(Function)
    );
  });

  it("enriches agent failures with trace tags and forensic scope context", () => {
    const error = new Error("Simulated agent tool timeout");
    captureAgentFailure(error, {
      traceId: "trace_err_404",
      model: "google/gemma-2-9b-it",
      phase: "tool_execution",
    });

    expect(Sentry.withScope).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
});
