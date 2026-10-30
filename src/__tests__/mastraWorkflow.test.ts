import { describe, it, expect, vi } from "vitest";
import {
  executeForensicWorkflow,
  mastraForensicEngine,
} from "@/lib/workflows/forensicWorkflow";
import { POST } from "../app/api/traces/workflow/route";
import { NextRequest } from "next/server";
import { defaultGemmaAdapter } from "@/lib/ai/gemmaAdapter";

import fixture01 from "@/fixtures/fixture_01_infinite_tool_loop.json";
import fixture07 from "@/fixtures/fixture_07_healthy_agent_run.json";

describe("Mastra Agent Workflow Orchestration", () => {
  vi.spyOn(defaultGemmaAdapter, "analyzeFailureTrace").mockResolvedValue({
    title: "Mastra Grounded Loop Diagnosis",
    model: "Google Gemma 2 (Mastra Orchestrated)",
    explanation: "Infinite tool invocation cycle at evt_003.",
    groundedEventIds: ["evt_003", "evt_004", "evt_005"],
    confidence: 0.98,
    validationStatus: "grounded",
    suggestedFix: "Configure circuit breaker with max 2 retries.",
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
  });

  it("handles healthy trace through Mastra workflow without errors", async () => {
    vi.spyOn(defaultGemmaAdapter, "analyzeFailureTrace").mockResolvedValueOnce({
      title: "Healthy Execution",
      model: "Google Gemma 2",
      explanation: "No anomalies detected.",
      groundedEventIds: [],
      confidence: 1.0,
      validationStatus: "grounded",
      suggestedFix: "No action needed.",
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
  });
});
