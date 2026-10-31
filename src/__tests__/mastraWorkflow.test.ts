import { describe, it, expect, vi } from "vitest";
import {
  executeForensicWorkflow,
  mastraForensicEngine,
} from "@/lib/workflows/forensicWorkflow";
import { POST } from "../app/api/traces/workflow/route";
import { NextRequest } from "next/server";
import { defaultGemmaAdapter } from "@/lib/ai/gemmaAdapter";

import fixture01 from "@/fixtures/fixture_01_infinite_tool_loop.json";
import fixture04 from "@/fixtures/fixture_04_unhandled_tool_crash.json";
import fixture07 from "@/fixtures/fixture_07_healthy_agent_run.json";

describe("Mastra Agent Workflow Orchestration", () => {
  vi.spyOn(defaultGemmaAdapter, "analyzeFailureTrace").mockResolvedValue({
    title: "Mastra Grounded Loop Diagnosis",
    model: "Google Gemma 2 (Mastra Orchestrated)",
    provider: "deterministic_rules",
    executionMode: "deterministic_fallback",
    latencyMs: 4,
    explanation: "Infinite tool invocation cycle at evt_003.",
    groundedEventIds: ["evt_003", "evt_004", "evt_005"],
    confidence: 0.98,
    validationStatus: "grounded",
    suggestedFix: "Configure circuit breaker with max 2 retries.",
    uncertaintyWarnings: [],
    evidenceValidation: {
      eventReferenceValid: true,
      causalClaimUnverified: false,
      validEventIds: ["evt_003", "evt_004", "evt_005"],
      hallucinatedEventIds: [],
      humanReviewRequired: false,
    },
  });

  it("orchestrates all 4 forensic steps sequentially through Mastra engine", async () => {
    expect(mastraForensicEngine.getWorkflow("forensic-investigator")).toBeDefined();
    const result = await executeForensicWorkflow(fixture01);

    expect(result).toBeDefined();
    expect(result.status).toBe("failed");
    expect(result.timeline.primaryFailureCategory).toBe("infinite_loop");
    expect(result.hypothesis.title).toBe("Mastra Grounded Loop Diagnosis");
    expect(result.hypothesis.groundedEventIds).toContain("evt_003");
    expect(result.testCode).toContain("Infinite Loop Regression");
    expect(result.completedAt).toBeDefined();
    expect(result.steps.length).toBe(4);
    expect(result.steps[0].stepId).toBe("step1_ingestAndNormalize");
    expect(result.steps[1].stepId).toBe("step2_detectAnomalies");
    expect(result.steps[2].stepId).toBe("step3_hypothesizeRootCause");
    expect(result.steps[3].stepId).toBe("step4_verifyAndSynthesize");
  });

  it("executes complete forensic workflow for Fixture 04 (Unhandled Tool Crash)", async () => {
    const result = await executeForensicWorkflow(fixture04);

    expect(result).toBeDefined();
    expect(result.status).toBe("failed");
    expect(result.timeline.primaryFailureCategory).toBe("unhandled_tool_error");
    expect(result.steps.length).toBe(4);
    expect(result.steps.every((s) => s.status === "success")).toBe(true);
    expect(result.steps.every((s) => s.durationMs >= 0)).toBe(true);
    expect(result.testCode).toContain("describe");
    expect(result.workflowEngine).toBe("Mastra v1.80.0");
  });

  it("handles healthy trace through Mastra workflow without errors", async () => {
    vi.spyOn(defaultGemmaAdapter, "analyzeFailureTrace").mockResolvedValueOnce({
      title: "Healthy Execution",
      model: "Google Gemma 2",
      provider: "deterministic_rules",
      executionMode: "deterministic_fallback",
      latencyMs: 2,
      explanation: "No anomalies detected.",
      groundedEventIds: [],
      confidence: 1.0,
      validationStatus: "grounded",
      suggestedFix: "No action needed.",
      uncertaintyWarnings: [],
      evidenceValidation: {
        eventReferenceValid: true,
        causalClaimUnverified: false,
        validEventIds: [],
        hallucinatedEventIds: [],
        humanReviewRequired: false,
      },
    });

    const result = await executeForensicWorkflow(fixture07);

    expect(result.status).toBe("completed");
    expect(result.timeline.primaryFailureCategory).toBe("none");
    expect(result.testCode).toContain("Baseline Happy Path");
  });

  it("exposes Mastra workflow endpoint via /api/traces/workflow", async () => {
    const req = new NextRequest("http://localhost:3000/api/traces/workflow", {
      method: "POST",
      body: JSON.stringify({ trace: fixture01 }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.workflowEngine).toContain("Mastra");
    expect(data.hypothesis.groundedEventIds).toEqual(["evt_003", "evt_004", "evt_005"]);
    expect(data.steps.length).toBe(4);
  });
});
