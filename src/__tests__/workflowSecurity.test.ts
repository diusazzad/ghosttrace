import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  validateWorkflowSecurity,
  MAX_BODY_BYTES,
  _resetWorkflowSecurityForTesting,
  _getActiveWorkflowsCount,
} from "@/lib/auth/workflowSecurity";
import * as auth0Module from "@/lib/auth/auth0";

describe("Workflow Security (Rate Limiting, Concurrency, Payload & Session Validation)", () => {
  const originalEnv = process.env.NODE_ENV;

  const setNodeEnv = (val: string | undefined) => {
    (process.env as Record<string, string | undefined>).NODE_ENV = val;
  };

  beforeEach(() => {
    _resetWorkflowSecurityForTesting();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    setNodeEnv(originalEnv);
    _resetWorkflowSecurityForTesting();
  });

  it("allows valid requests in development with dev_local_user fallback", async () => {
    setNodeEnv("development");
    const req = new NextRequest("http://localhost:3000/api/traces/backboard", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trace: { id: "tr_1", agentName: "AgentA" } }),
    });

    const result = await validateWorkflowSecurity(req);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ownerId).toBe("dev_local_user");
      expect(result.body.ownerId).toBe("dev_local_user");
      result.releaseConcurrency();
    }
  });

  it("returns 503 when Auth0 is not configured in production", async () => {
    setNodeEnv("production");
    vi.spyOn(auth0Module, "isAuth0Configured").mockReturnValue(false);

    const req = new NextRequest("http://localhost:3000/api/traces/backboard", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trace: { id: "tr_1" } }),
    });

    const result = await validateWorkflowSecurity(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(503);
      const data = await result.response.json();
      expect(data.code).toBe("AUTH_NOT_CONFIGURED");
    }
  });

  it("returns 401 when unauthenticated in production", async () => {
    setNodeEnv("production");
    vi.spyOn(auth0Module, "isAuth0Configured").mockReturnValue(true);
    vi.spyOn(auth0Module, "getServerSession").mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/traces/backboard", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trace: { id: "tr_1" } }),
    });

    const result = await validateWorkflowSecurity(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      const data = await result.response.json();
      expect(data.code).toBe("UNAUTHORIZED");
    }
  });

  it("binds authenticated session ownerId and ignores client-provided ownerId", async () => {
    setNodeEnv("production");
    vi.spyOn(auth0Module, "isAuth0Configured").mockReturnValue(true);
    vi.spyOn(auth0Module, "getServerSession").mockResolvedValue({
      userId: "auth0|verified_user_999",
      email: "user@example.com",
      isDemo: false,
    });

    const req = new NextRequest("http://localhost:3000/api/traces/backboard", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ownerId: "attacker_spoofed_id",
        trace: { id: "tr_1" },
      }),
    });

    const result = await validateWorkflowSecurity(req);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ownerId).toBe("auth0|verified_user_999");
      expect(result.body.ownerId).toBe("auth0|verified_user_999");
      result.releaseConcurrency();
    }
  });

  it("rejects payloads exceeding MAX_BODY_BYTES via Content-Length header", async () => {
    setNodeEnv("development");
    const req = new NextRequest("http://localhost:3000/api/traces/backboard", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(MAX_BODY_BYTES + 500),
      },
      body: JSON.stringify({ trace: "small_test" }),
    });

    const result = await validateWorkflowSecurity(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(413);
      const data = await result.response.json();
      expect(data.code).toBe("PAYLOAD_TOO_LARGE");
    }
  });

  it("rejects oversized streaming chunks exceeding MAX_BODY_BYTES", async () => {
    setNodeEnv("development");
    const chunk = new Uint8Array(600 * 1024); // 600 KB
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(chunk);
        controller.enqueue(chunk); // 1.2 MB total
        controller.close();
      },
    });

    const req = new NextRequest("http://localhost:3000/api/traces/backboard", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as unknown as ConstructorParameters<typeof NextRequest>[1]);

    const result = await validateWorkflowSecurity(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(413);
      const data = await result.response.json();
      expect(data.code).toBe("PAYLOAD_TOO_LARGE");
    }
  });

  it("handles malformed JSON body gracefully with 400", async () => {
    setNodeEnv("development");
    const req = new NextRequest("http://localhost:3000/api/traces/backboard", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not valid json ...",
    });

    const result = await validateWorkflowSecurity(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const data = await result.response.json();
      expect(data.code).toBe("INVALID_JSON");
    }
  });

  it("enforces sliding window rate limit (max 30 requests/min)", async () => {
    setNodeEnv("development");
    const makeReq = () =>
      new NextRequest("http://localhost:3000/api/traces/backboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trace: { id: "test" } }),
      });

    // 30 requests should succeed
    for (let i = 0; i < 30; i++) {
      const res = await validateWorkflowSecurity(makeReq());
      expect(res.ok).toBe(true);
      if (res.ok) {
        res.releaseConcurrency();
      }
    }

    // 31st request should be rejected with 429
    const blockedRes = await validateWorkflowSecurity(makeReq());
    expect(blockedRes.ok).toBe(false);
    if (!blockedRes.ok) {
      expect(blockedRes.response.status).toBe(429);
      const data = await blockedRes.response.json();
      expect(data.code).toBe("RATE_LIMIT_EXCEEDED");
    }
  });

  it("enforces concurrency throttle (max 5 simultaneous executions)", async () => {
    setNodeEnv("development");
    const makeReq = () =>
      new NextRequest("http://localhost:3000/api/traces/backboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trace: { id: "concurrency_test" } }),
      });

    const releaseCallbacks: Array<() => void> = [];

    // Hold 5 concurrent tokens
    for (let i = 0; i < 5; i++) {
      const res = await validateWorkflowSecurity(makeReq());
      expect(res.ok).toBe(true);
      if (res.ok) {
        releaseCallbacks.push(res.releaseConcurrency);
      }
    }

    expect(_getActiveWorkflowsCount()).toBe(5);

    // 6th request fails with 429 CONCURRENCY_LIMIT_REACHED
    const overflowRes = await validateWorkflowSecurity(makeReq());
    expect(overflowRes.ok).toBe(false);
    if (!overflowRes.ok) {
      expect(overflowRes.response.status).toBe(429);
      const data = await overflowRes.response.json();
      expect(data.code).toBe("CONCURRENCY_LIMIT_REACHED");
    }

    // Release one token
    releaseCallbacks[0]();
    expect(_getActiveWorkflowsCount()).toBe(4);

    // Now a new request should succeed
    const permittedRes = await validateWorkflowSecurity(makeReq());
    expect(permittedRes.ok).toBe(true);
    if (permittedRes.ok) {
      permittedRes.releaseConcurrency();
    }

    // Clean up remaining
    for (let i = 1; i < releaseCallbacks.length; i++) {
      releaseCallbacks[i]();
    }
    expect(_getActiveWorkflowsCount()).toBe(0);
  });
});
