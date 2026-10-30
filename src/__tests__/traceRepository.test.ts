import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  saveInvestigation,
  getInvestigationByTraceId,
  listInvestigations,
  getTraceStatistics,
  inMemoryTraceStore,
  StoredInvestigation,
  DEFAULT_ANONYMOUS_OWNER,
} from "@/lib/db/traceRepository";
import { POST as saveRoute } from "@/app/api/traces/save/route";
import { GET as historyRoute } from "@/app/api/traces/history/route";
import { NextRequest } from "next/server";
import * as authModule from "@/lib/auth/auth0";

describe("MongoDB Atlas Trace Repository & Multi-Tenant Owner Isolation (TASK 01C)", () => {
  beforeEach(() => {
    inMemoryTraceStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockInvestigation: StoredInvestigation = {
    ownerId: "auth0|user_alpha_123",
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

  it("saves and retrieves an investigation record with full forensic metadata and ownerId", async () => {
    const saveResult = await saveInvestigation(mockInvestigation);
    expect(saveResult.persisted).toBe(true);
    expect(saveResult.id).toBeDefined();
    expect(saveResult.ownerId).toBe("auth0|user_alpha_123");

    const retrieved = await getInvestigationByTraceId("trace_loop_mongo_01", "auth0|user_alpha_123");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.traceId).toBe("trace_loop_mongo_01");
    expect(retrieved?.ownerId).toBe("auth0|user_alpha_123");
    expect(retrieved?.agentName).toBe("CodeRefactorAgent");
    expect(retrieved?.primaryFailureCategory).toBe("infinite_loop");
    expect(retrieved?.hypothesis.groundedEventIds).toEqual(["evt_002", "evt_003"]);
  });

  it("returns null when searching for non-existent traceId", async () => {
    const result = await getInvestigationByTraceId("non_existent_trace_999", "auth0|user_alpha_123");
    expect(result).toBeNull();
  });

  it("enforces multi-tenant trace isolation between different owners sharing same traceId", async () => {
    const userA = "auth0|user_alpha_123";
    const userB = "auth0|user_beta_456";

    // User A saves trace_shared_id
    await saveInvestigation({
      ...mockInvestigation,
      ownerId: userA,
      traceId: "trace_shared_id",
      hypothesis: {
        ...mockInvestigation.hypothesis,
        explanation: "User A diagnostic finding",
      },
    });

    // User B saves trace with the exact same traceId
    await saveInvestigation({
      ...mockInvestigation,
      ownerId: userB,
      traceId: "trace_shared_id",
      hypothesis: {
        ...mockInvestigation.hypothesis,
        explanation: "User B diagnostic finding",
      },
    });

    // User A retrieves their version
    const retrievedA = await getInvestigationByTraceId("trace_shared_id", userA);
    expect(retrievedA?.hypothesis.explanation).toBe("User A diagnostic finding");
    expect(retrievedA?.ownerId).toBe(userA);

    // User B retrieves their version
    const retrievedB = await getInvestigationByTraceId("trace_shared_id", userB);
    expect(retrievedB?.hypothesis.explanation).toBe("User B diagnostic finding");
    expect(retrievedB?.ownerId).toBe(userB);

    // In-memory store should contain 2 distinct partitioned records
    expect(inMemoryTraceStore.count()).toBe(2);
    expect(inMemoryTraceStore.count(userA)).toBe(1);
    expect(inMemoryTraceStore.count(userB)).toBe(1);
  });

  it("prevents unauthorized access across tenant boundaries (returns null for non-owner)", async () => {
    const userA = "auth0|user_alpha_123";
    const userB = "auth0|user_beta_456";

    await saveInvestigation({
      ...mockInvestigation,
      ownerId: userA,
      traceId: "trace_confidential_alpha",
    });

    // User B attempts to access User A's trace by traceId
    const unauthorizedAccess = await getInvestigationByTraceId("trace_confidential_alpha", userB);
    expect(unauthorizedAccess).toBeNull();
  });

  it("filters historical investigations strictly by ownerId, category, and agentName", async () => {
    const userA = "auth0|user_alpha_123";
    const userB = "auth0|user_beta_456";

    // User A investigations
    await saveInvestigation({
      ...mockInvestigation,
      ownerId: userA,
      traceId: "trace_a_loop",
      primaryFailureCategory: "infinite_loop",
    });
    await saveInvestigation({
      ...mockInvestigation,
      ownerId: userA,
      traceId: "trace_a_cascade",
      agentName: "DataPipelineAgent",
      primaryFailureCategory: "tool_cascade_failure",
    });

    // User B investigation
    await saveInvestigation({
      ...mockInvestigation,
      ownerId: userB,
      traceId: "trace_b_loop",
      primaryFailureCategory: "infinite_loop",
    });

    // Querying for User A should never return User B's traces
    const userATraces = await listInvestigations({ ownerId: userA });
    expect(userATraces.length).toBe(2);
    expect(userATraces.every((t) => t.ownerId === userA)).toBe(true);

    const userBTraces = await listInvestigations({ ownerId: userB });
    expect(userBTraces.length).toBe(1);
    expect(userBTraces[0].traceId).toBe("trace_b_loop");

    // Filter within User A's traces
    const loopTracesA = await listInvestigations({ ownerId: userA, category: "infinite_loop" });
    expect(loopTracesA.length).toBe(1);
    expect(loopTracesA[0].traceId).toBe("trace_a_loop");

    const pipelineTracesA = await listInvestigations({ ownerId: userA, agentName: "DataPipelineAgent" });
    expect(pipelineTracesA.length).toBe(1);
    expect(pipelineTracesA[0].traceId).toBe("trace_a_cascade");
  });

  it("computes accurate aggregate failure statistics scoped to ownerId", async () => {
    const userA = "auth0|user_alpha_123";
    const userB = "auth0|user_beta_456";

    await saveInvestigation({
      ...mockInvestigation,
      ownerId: userA,
      traceId: "trace_a_1",
      totalTokens: 10000,
      primaryFailureCategory: "infinite_loop",
    });
    await saveInvestigation({
      ...mockInvestigation,
      ownerId: userA,
      traceId: "trace_a_2",
      totalTokens: 2000,
      primaryFailureCategory: "none",
    });

    // User B with high tokens
    await saveInvestigation({
      ...mockInvestigation,
      ownerId: userB,
      traceId: "trace_b_1",
      totalTokens: 999999,
      primaryFailureCategory: "schema_mismatch",
    });

    // Stats for User A should not be contaminated by User B
    const statsA = await getTraceStatistics(userA);
    expect(statsA.totalTraces).toBe(2);
    expect(statsA.failureCategoryCounts["infinite_loop"]).toBe(1);
    expect(statsA.failureCategoryCounts["none"]).toBe(1);
    expect(statsA.failureCategoryCounts["schema_mismatch"]).toBeUndefined();
    // (10000 + 2000) / 2 = 6000
    expect(statsA.averageTokens).toBe(6000);
  });

  it("handles persistence via POST /api/traces/save with authenticated session sub", async () => {
    vi.spyOn(authModule, "getServerSession").mockResolvedValue({
      userId: "auth0|server_verified_user_99",
      isDemo: false,
    });

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
    expect(body.ownerId).toBe("auth0|server_verified_user_99");

    const saved = await getInvestigationByTraceId(mockInvestigation.traceId, "auth0|server_verified_user_99");
    expect(saved?.ownerId).toBe("auth0|server_verified_user_99");
  });

  it("falls back to default sandbox owner when POST /api/traces/save is unauthenticated", async () => {
    vi.spyOn(authModule, "getServerSession").mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/traces/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockInvestigation),
    });

    const res = await saveRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.ownerId).toBe(DEFAULT_ANONYMOUS_OWNER);
  });

  it("retrieves history and statistics via GET /api/traces/history scoped to session sub", async () => {
    const verifiedSub = "auth0|history_viewer_77";

    await saveInvestigation({
      ...mockInvestigation,
      ownerId: verifiedSub,
      traceId: "trace_viewer_01",
    });
    await saveInvestigation({
      ...mockInvestigation,
      ownerId: "auth0|other_user_99",
      traceId: "trace_other_02",
    });

    vi.spyOn(authModule, "getServerSession").mockResolvedValue({
      userId: verifiedSub,
      isDemo: false,
    });

    const req = new NextRequest("http://localhost:3000/api/traces/history?limit=10");
    const res = await historyRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.ownerId).toBe(verifiedSub);
    expect(body.count).toBe(1);
    expect(body.investigations[0].traceId).toBe("trace_viewer_01");
    expect(body.statistics.totalTraces).toBe(1);
  });
});
