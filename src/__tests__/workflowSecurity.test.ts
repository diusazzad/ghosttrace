import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  validateWorkflowSecurity,
  _resetWorkflowSecurityForTesting,
  _getActiveWorkflowsCount,
} from "@/lib/auth/workflowSecurity";
import * as auth0Module from "@/lib/auth/auth0";

describe("Workflow Route Security & Auth Safeguards (TASK 04.1 / GT-UM-02)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    _resetWorkflowSecurityForTesting();
  });

  it("returns 503 SERVICE UNAVAILABLE in production when Auth0 is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(auth0Module, "isAuth0Configured").mockReturnValue(false);

    const req = new NextRequest("http://localhost:3000/api/traces/workflow", {
      method: "POST",
      body: JSON.stringify({ trace: { id: "t1" } }),
      headers: { "Content-Type": "application/json" },
    });

    const result = await validateWorkflowSecurity(req);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(503);
      const json = await result.response.json();
      expect(json.code).toBe("AUTH_NOT_CONFIGURED");
    }
  });

  it("returns 401 UNAUTHORIZED in production when session is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(auth0Module, "isAuth0Configured").mockReturnValue(true);
    vi.spyOn(auth0Module, "getServerSession").mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/traces/workflow", {
      method: "POST",
      body: JSON.stringify({ trace: { id: "t1" } }),
      headers: { "Content-Type": "application/json" },
    });

    const result = await validateWorkflowSecurity(req);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      const json = await result.response.json();
      expect(json.code).toBe("UNAUTHORIZED");
    }
  });

  it("ignores client-provided ownerId and binds to verified session identity", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(auth0Module, "isAuth0Configured").mockReturnValue(true);
    vi.spyOn(auth0Module, "getServerSession").mockResolvedValue({
      userId: "auth0|verified_user_123",
      email: "user@example.com",
      isDemo: false,
    });

    const req = new NextRequest("http://localhost:3000/api/traces/workflow", {
      method: "POST",
      body: JSON.stringify({
        trace: { id: "t1" },
        ownerId: "attacker_spoofed_owner_id",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const result = await validateWorkflowSecurity(req);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ownerId).toBe("auth0|verified_user_123");
      expect(result.body.ownerId).toBe("auth0|verified_user_123");
      result.releaseConcurrency();
    }
  });

  it("enforces 1 MiB payload size limit via Content-Length header early rejection", async () => {
    const req = new NextRequest("http://localhost:3000/api/traces/workflow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "2000000", // > 1 MiB
      },
      body: JSON.stringify({ trace: { id: "t1" } }),
    });

    const result = await validateWorkflowSecurity(req);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(413);
      const json = await result.response.json();
      expect(json.code).toBe("PAYLOAD_TOO_LARGE");
    }
    // Concurrency token must NOT be consumed
    expect(_getActiveWorkflowsCount()).toBe(0);
  });

  it("incrementally counts streamed chunks and cancels stream without buffering oversized payload", async () => {
    let cancelCalled = false;
    let cancelReason = "";

    // Create a custom ReadableStream that emits 512 KiB chunks
    const chunk512k = new Uint8Array(512 * 1024);
    const customStream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(chunk512k);
      },
      cancel(reason) {
        cancelCalled = true;
        cancelReason = String(reason);
      },
    });

    const req = new NextRequest("http://localhost:3000/api/traces/workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: customStream,
      duplex: "half",
    });

    const result = await validateWorkflowSecurity(req);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(413);
      const json = await result.response.json();
      expect(json.code).toBe("PAYLOAD_TOO_LARGE");
    }
    // Stream must be aborted with Payload Too Large reason
    expect(cancelCalled).toBe(true);
    expect(cancelReason).toContain("Payload Too Large");
    // Concurrency token was NOT acquired
    expect(_getActiveWorkflowsCount()).toBe(0);
  });

  it("handles empty request body cleanly with HTTP 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/traces/workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "",
    });

    const result = await validateWorkflowSecurity(req);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const json = await result.response.json();
      expect(json.code).toBe("INVALID_REQUEST");
      expect(json.error).toContain("empty");
    }
    expect(_getActiveWorkflowsCount()).toBe(0);
  });

  it("handles malformed JSON body cleanly with HTTP 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/traces/workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not_valid_json: true, ",
    });

    const result = await validateWorkflowSecurity(req);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const json = await result.response.json();
      expect(json.code).toBe("INVALID_JSON");
    }
    expect(_getActiveWorkflowsCount()).toBe(0);
  });

  it("acquires concurrency token only after valid parse and releases properly", async () => {
    const req = new NextRequest("http://localhost:3000/api/traces/workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trace: { id: "t_valid" } }),
    });

    expect(_getActiveWorkflowsCount()).toBe(0);
    const result = await validateWorkflowSecurity(req);

    expect(result.ok).toBe(true);
    expect(_getActiveWorkflowsCount()).toBe(1);

    if (result.ok) {
      result.releaseConcurrency();
      expect(_getActiveWorkflowsCount()).toBe(0);
      // Double release should be idempotent
      result.releaseConcurrency();
      expect(_getActiveWorkflowsCount()).toBe(0);
    }
  });
});
