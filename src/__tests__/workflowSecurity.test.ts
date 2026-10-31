import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { validateWorkflowSecurity } from "@/lib/auth/workflowSecurity";
import * as auth0Module from "@/lib/auth/auth0";

describe("Workflow Route Security & Auth Safeguards (TASK 04 / TASK 02 Follow-up)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
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
      // The body must have ownerId set to verified userId
      expect(result.body.ownerId).toBe("auth0|verified_user_123");
    }
  });

  it("enforces 1 MiB payload size limit via Content-Length header", async () => {
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
  });

  it("enforces 1 MiB payload size limit on oversized raw body streams", async () => {
    const hugePayload = "x".repeat(1.5 * 1024 * 1024);
    const req = new NextRequest("http://localhost:3000/api/traces/workflow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: hugePayload,
    });

    const result = await validateWorkflowSecurity(req);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(413);
    }
  });
});
