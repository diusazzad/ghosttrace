import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
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
import * as authModule from "@/lib/auth/auth0";

describe("MongoDB Atlas Trace Repository & Multi-Tenant Owner Isolation (TASK 01C.1 & TASK 01C.2)", () => {
  beforeEach(() => {
    inMemoryTraceStore.clear();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
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

  it("saves and retrieves an investigation record with mandatory ownerId", async () => {
    const saveResult = await saveInvestigation(mockInvestigation);
    expect(saveResult.id).toBeDefined();
    expect(saveResult.ownerId).toBe("auth0|user_alpha_123");

    const retrieved = await getInvestigationByTraceId("trace_loop_mongo_01", "auth0|user_alpha_123");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.traceId).toBe("trace_loop_mongo_01");
    expect(retrieved?.ownerId).toBe("auth0|user_alpha_123");
    expect(retrieved?.agentName).toBe("CodeRefactorAgent");
    expect(retrieved?.primaryFailureCategory).toBe("infinite_loop");
  });

  it("reports persisted: false for volatile in-memory storage", async () => {
    // When saved to in-memory store (e.g. offline/demo), persisted must be false
    const demoInvestigation: StoredInvestigation = {
      ...mockInvestigation,
      ownerId: "demo_local_isolated",
      traceId: "trace_demo_volatile",
    };
    const result = await saveInvestigation(demoInvestigation);
    expect(result.persisted).toBe(false);
    expect(result.storageEngine).toBe("in_memory");
  });

  it("rejects repository operations when ownerId is missing or empty", async () => {
    const invalidInvestigation = {
      ...mockInvestigation,
      ownerId: "",
    };

    await expect(saveInvestigation(invalidInvestigation)).rejects.toThrow(
      "saveInvestigation requires a non-empty ownerId"
    );

    await expect(getInvestigationByTraceId("trace_123", "")).rejects.toThrow(
      "getInvestigationByTraceId requires a non-empty ownerId"
    );

    await expect(listInvestigations({ ownerId: "" })).rejects.toThrow(
      "listInvestigations requires a non-empty ownerId"
    );

    await expect(getTraceStatistics("")).rejects.toThrow(
      "getTraceStatistics requires a non-empty ownerId"
    );
  });

  it("guarantees collision-safe in-memory keys for colon-containing owner IDs and trace IDs (TASK 01C.2)", async () => {
    // Delimiter collision case:
    // ownerId="tenant:a" + traceId="trace-b" vs ownerId="tenant" + traceId="a:trace-b"
    const record1: StoredInvestigation = {
      ...mockInvestigation,
      ownerId: "tenant:a",
      traceId: "trace-b",
      agentName: "AgentOne",
    };
    const record2: StoredInvestigation = {
      ...mockInvestigation,
      ownerId: "tenant",
      traceId: "a:trace-b",
      agentName: "AgentTwo",
    };

    inMemoryTraceStore.save(record1);
    inMemoryTraceStore.save(record2);

    // Both must be preserved independently without overwriting each other
    const retrieved1 = inMemoryTraceStore.getByTraceId("trace-b", "tenant:a");
    const retrieved2 = inMemoryTraceStore.getByTraceId("a:trace-b", "tenant");

    expect(retrieved1).not.toBeNull();
    expect(retrieved1?.agentName).toBe("AgentOne");
    expect(retrieved1?.ownerId).toBe("tenant:a");
    expect(retrieved1?.traceId).toBe("trace-b");

    expect(retrieved2).not.toBeNull();
    expect(retrieved2?.agentName).toBe("AgentTwo");
    expect(retrieved2?.ownerId).toBe("tenant");
    expect(retrieved2?.traceId).toBe("a:trace-b");

    // Cross-tenant lookup returns null
    expect(inMemoryTraceStore.getByTraceId("trace-b", "tenant")).toBeNull();
    expect(inMemoryTraceStore.getByTraceId("a:trace-b", "tenant:a")).toBeNull();

    // Listing is strictly scoped
    const listTenantA = inMemoryTraceStore.list({ ownerId: "tenant:a" });
    const listTenant = inMemoryTraceStore.list({ ownerId: "tenant" });
    expect(listTenantA.length).toBe(1);
    expect(listTenantA[0].agentName).toBe("AgentOne");
    expect(listTenant.length).toBe(1);
    expect(listTenant[0].agentName).toBe("AgentTwo");

    expect(inMemoryTraceStore.count()).toBe(2);
  });

  it("enforces multi-tenant trace isolation between different owners sharing the same traceId", async () => {
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
    await saveInvestigation({
      ...mockInvestigation,
      ownerId: userB,
      traceId: "trace_b_loop",
      primaryFailureCategory: "infinite_loop",
    });

    const userATraces = await listInvestigations({ ownerId: userA });
    expect(userATraces.length).toBe(2);
    expect(userATraces.every((t) => t.ownerId === userA)).toBe(true);

    const userBTraces = await listInvestigations({ ownerId: userB });
    expect(userBTraces.length).toBe(1);
    expect(userBTraces[0].traceId).toBe("trace_b_loop");

    const loopTracesA = await listInvestigations({ ownerId: userA, category: "infinite_loop" });
    expect(loopTracesA.length).toBe(1);
    expect(loopTracesA[0].traceId).toBe("trace_a_loop");

    const pipelineTracesA = await listInvestigations({ ownerId: userA, agentName: "DataPipelineAgent" });
    expect(pipelineTracesA.length).toBe(1);
    expect(pipelineTracesA[0].traceId).toBe("trace_a_cascade");
  });

  it("computes accurate aggregate failure statistics scoped strictly to ownerId", async () => {
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

    await saveInvestigation({
      ...mockInvestigation,
      ownerId: userB,
      traceId: "trace_b_1",
      totalTokens: 999999,
      primaryFailureCategory: "schema_mismatch",
    });

    const statsA = await getTraceStatistics(userA);
    expect(statsA.totalTraces).toBe(2);
    expect(statsA.failureCategoryCounts["infinite_loop"]).toBe(1);
    expect(statsA.failureCategoryCounts["none"]).toBe(1);
    expect(statsA.failureCategoryCounts["schema_mismatch"]).toBeUndefined();
    expect(statsA.averageTokens).toBe(6000);
  });

  describe("API Route Security Gates", () => {
    it("returns HTTP 503 with AUTH_NOT_CONFIGURED on POST /api/traces/save when in production and Auth0 is unconfigured", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.spyOn(authModule, "isAuth0Configured").mockReturnValue(false);

      const req = new NextRequest("http://localhost:3000/api/traces/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockInvestigation),
      });

      const res = await saveRoute(req);
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe("AUTH_NOT_CONFIGURED");
      expect(body.error).toBe("AUTH_NOT_CONFIGURED");
    });

    it("returns HTTP 503 with AUTH_NOT_CONFIGURED on GET /api/traces/history when in production and Auth0 is unconfigured", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.spyOn(authModule, "isAuth0Configured").mockReturnValue(false);

      const req = new NextRequest("http://localhost:3000/api/traces/history");
      const res = await historyRoute(req);
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe("AUTH_NOT_CONFIGURED");
      expect(body.error).toBe("AUTH_NOT_CONFIGURED");
    });

    it("returns 401 on POST /api/traces/save when unauthenticated in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.spyOn(authModule, "isAuth0Configured").mockReturnValue(true);
      vi.spyOn(authModule, "getServerSession").mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/traces/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockInvestigation),
      });

      const res = await saveRoute(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 on GET /api/traces/history when unauthenticated in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.spyOn(authModule, "isAuth0Configured").mockReturnValue(true);
      vi.spyOn(authModule, "getServerSession").mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/traces/history");
      const res = await historyRoute(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe("UNAUTHORIZED");
    });

    it("prevents cross-visitor data disclosure between two unauthenticated visitors", async () => {
      vi.spyOn(authModule, "isAuth0Configured").mockReturnValue(true);
      vi.spyOn(authModule, "getServerSession").mockResolvedValue(null);

      // Visitor 1 attempts to save a confidential trace anonymously
      const reqSave = new NextRequest("http://localhost:3000/api/traces/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...mockInvestigation,
          traceId: "visitor_a_private_trace",
        }),
      });
      const resSave = await saveRoute(reqSave);
      expect(resSave.status).toBe(401);

      // Visitor 2 attempts to query history anonymously
      const reqHistory = new NextRequest("http://localhost:3000/api/traces/history");
      const resHistory = await historyRoute(reqHistory);
      expect(resHistory.status).toBe(401);

      // Verify that in-memory store has zero traces saved under shared demo or anonymous owner
      expect(inMemoryTraceStore.count("demo_local_isolated")).toBe(0);
      expect(inMemoryTraceStore.count("sandbox_anonymous")).toBe(0);
    });

    it("ignores client-supplied body.ownerId and binds strictly to verified session identity", async () => {
      vi.spyOn(authModule, "isAuth0Configured").mockReturnValue(true);
      vi.spyOn(authModule, "getServerSession").mockResolvedValue({
        userId: "auth0|legitimate_server_user",
        isDemo: false,
      });

      const spoofPayload = {
        ...mockInvestigation,
        ownerId: "auth0|spoofed_victim_id", // Malicious attempt to forge ownerId in body
      };

      const req = new NextRequest("http://localhost:3000/api/traces/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(spoofPayload),
      });

      const res = await saveRoute(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.ownerId).toBe("auth0|legitimate_server_user"); // Must be the server session, NOT the spoofed payload

      const saved = await getInvestigationByTraceId(mockInvestigation.traceId, "auth0|legitimate_server_user");
      expect(saved?.ownerId).toBe("auth0|legitimate_server_user");

      // Verify the victim's partition has zero records
      const victimTrace = await getInvestigationByTraceId(mockInvestigation.traceId, "auth0|spoofed_victim_id");
      expect(victimTrace).toBeNull();
    });

    it("ignores ?ownerId= query parameter and scopes GET /api/traces/history strictly to session", async () => {
      const verifiedSub = "auth0|history_viewer_77";
      const victimSub = "auth0|victim_user_88";

      await saveInvestigation({
        ...mockInvestigation,
        ownerId: verifiedSub,
        traceId: "trace_viewer_01",
      });
      await saveInvestigation({
        ...mockInvestigation,
        ownerId: victimSub,
        traceId: "trace_victim_02",
      });

      vi.spyOn(authModule, "isAuth0Configured").mockReturnValue(true);
      vi.spyOn(authModule, "getServerSession").mockResolvedValue({
        userId: verifiedSub,
        isDemo: false,
      });

      // Malicious attempt to snoop on victim's history via query param
      const req = new NextRequest(`http://localhost:3000/api/traces/history?ownerId=${victimSub}&limit=10`);
      const res = await historyRoute(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.ownerId).toBe(verifiedSub); // Must be the session user
      expect(body.count).toBe(1);
      expect(body.investigations[0].traceId).toBe("trace_viewer_01"); // Victim trace must NOT be leaked
    });
  });
});
