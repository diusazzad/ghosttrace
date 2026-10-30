import { describe, it, expect, beforeEach } from "vitest";
import {
  saveInvestigation,
  getInvestigationByTraceId,
  listInvestigations,
  getTraceStatistics,
  inMemoryTraceStore,
  StoredInvestigation,
} from "@/lib/db/traceRepository";
import { POST as saveRoute } from "@/app/api/traces/save/route";
import { GET as historyRoute } from "@/app/api/traces/history/route";
import { NextRequest } from "next/server";

describe("MongoDB Atlas Trace Repository & Historical Persistence", () => {
  beforeEach(() => {
    inMemoryTraceStore.clear();
  });

  const mockInvestigation: StoredInvestigation = {
    traceId: "trace_loop_mongo_01",
    agentName: "CodeRefactorAgent",
    status: "failed",
    primaryFailureCategory: "infinite_loop",
    totalDurationMs: 4200,
    totalTokens: 12500,
    estimatedCostUsd: 0.025,
    eventsCount: 8,
    anomaliesCount: 1,
    hypothesis: {
      title: "Self-Referential Refactor Loop",
      model: "Google Gemma 2",
      explanation: "Agent repeatedly invoked ast_rewrite on line 42 without progress.",
      groundedEventIds: ["evt_002", "evt_003"],
      confidence: 0.96,
      validationStatus: "grounded",
      suggestedFix: "Limit max iterations to 2 per file block.",
    },
    generatedTestCode: "// Vitest regression test suite",
    createdAt: new Date().toISOString(),
  };

  it("saves and retrieves an investigation record with full forensic metadata", async () => {
    const saveResult = await saveInvestigation(mockInvestigation);
    expect(saveResult.persisted).toBe(true);
    expect(saveResult.id).toBeDefined();

    const retrieved = await getInvestigationByTraceId("trace_loop_mongo_01");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.traceId).toBe("trace_loop_mongo_01");
    expect(retrieved?.agentName).toBe("CodeRefactorAgent");
    expect(retrieved?.primaryFailureCategory).toBe("infinite_loop");
    expect(retrieved?.hypothesis.groundedEventIds).toEqual(["evt_002", "evt_003"]);
  });

  it("returns null when searching for non-existent traceId", async () => {
    const result = await getInvestigationByTraceId("non_existent_trace_999");
    expect(result).toBeNull();
  });

  it("filters historical investigations by category and agentName", async () => {
    await saveInvestigation(mockInvestigation);
    await saveInvestigation({
      ...mockInvestigation,
      traceId: "trace_cascade_02",
      agentName: "DataPipelineAgent",
      primaryFailureCategory: "tool_cascade_failure",
      totalTokens: 8000,
    });

    const loopTraces = await listInvestigations({ category: "infinite_loop" });
    expect(loopTraces.length).toBe(1);
    expect(loopTraces[0].traceId).toBe("trace_loop_mongo_01");

    const pipelineTraces = await listInvestigations({ agentName: "DataPipelineAgent" });
    expect(pipelineTraces.length).toBe(1);
    expect(pipelineTraces[0].traceId).toBe("trace_cascade_02");
  });

  it("computes accurate aggregate failure statistics across stored traces", async () => {
    await saveInvestigation(mockInvestigation);
    await saveInvestigation({
      ...mockInvestigation,
      traceId: "trace_healthy_03",
      status: "completed",
      primaryFailureCategory: "none",
      totalTokens: 4000,
    });

    const stats = await getTraceStatistics();
    expect(stats.totalTraces).toBe(2);
    expect(stats.failureCategoryCounts["infinite_loop"]).toBe(1);
    expect(stats.failureCategoryCounts["none"]).toBe(1);
    // (12500 + 4000) / 2 = 8250
    expect(stats.averageTokens).toBe(8250);
  });

  it("handles persistence via POST /api/traces/save", async () => {
    const req = new NextRequest("http://localhost:3000/api/traces/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockInvestigation),
    });

    const res = await saveRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.persisted).toBe(true);
  });

  it("retrieves history and statistics via GET /api/traces/history", async () => {
    await saveInvestigation(mockInvestigation);

    const req = new NextRequest("http://localhost:3000/api/traces/history?limit=10");
    const res = await historyRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.count).toBe(1);
    expect(body.investigations[0].traceId).toBe("trace_loop_mongo_01");
    expect(body.statistics.totalTraces).toBe(1);
  });
});
