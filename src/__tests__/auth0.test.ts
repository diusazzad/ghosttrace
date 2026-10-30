import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";
import { isAuth0Configured, getServerSession, getAuth0Client } from "@/lib/auth/auth0";
import { proxy } from "@/proxy";

type ClientSession = NonNullable<Awaited<ReturnType<ReturnType<typeof getAuth0Client>["getSession"]>>>;

describe("Auth0 Server-Side Identity Integration (TASK 01B)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.AUTH0_SECRET;
    delete process.env.AUTH0_DOMAIN;
    delete process.env.AUTH0_ISSUER_BASE_URL;
    delete process.env.AUTH0_CLIENT_ID;
    delete process.env.AUTH0_CLIENT_SECRET;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("Configuration Detection", () => {
    it("reports false when Auth0 environment variables are absent", () => {
      expect(isAuth0Configured()).toBe(false);
    });

    it("reports false when Auth0 values are placeholders", () => {
      process.env.AUTH0_SECRET = "your_auth0_secret_here";
      process.env.AUTH0_DOMAIN = "your_auth0_domain_here";
      process.env.AUTH0_CLIENT_ID = "your_auth0_client_id_here";
      process.env.AUTH0_CLIENT_SECRET = "your_auth0_client_secret_here";

      expect(isAuth0Configured()).toBe(false);
    });

    it("reports true when all required variables are set to valid values", () => {
      process.env.AUTH0_SECRET = "super_secret_session_key_32_chars_long!";
      process.env.AUTH0_DOMAIN = "tenant.us.auth0.com";
      process.env.AUTH0_CLIENT_ID = "client_xyz123";
      process.env.AUTH0_CLIENT_SECRET = "client_secret_abc456";

      expect(isAuth0Configured()).toBe(true);
    });
  });

  describe("Server Session Verification", () => {
    it("returns null when Auth0 is not configured (fail-closed anonymous)", async () => {
      const session = await getServerSession();
      expect(session).toBeNull();
    });

    it("resolves canonical userId from session.user.sub when configured", async () => {
      process.env.AUTH0_SECRET = "super_secret_session_key_32_chars_long!";
      process.env.AUTH0_DOMAIN = "tenant.us.auth0.com";
      process.env.AUTH0_CLIENT_ID = "client_xyz123";
      process.env.AUTH0_CLIENT_SECRET = "client_secret_abc456";

      const mockSession = {
        user: {
          sub: "auth0|64f123456789abcdef",
          email: "agent.forensic@ghosttrace.internal",
          name: "Lead Forensic Investigator",
        },
      } as unknown as ClientSession;

      const client = getAuth0Client();
      vi.spyOn(client, "getSession").mockResolvedValueOnce(mockSession);

      const session = await getServerSession();
      expect(session).not.toBeNull();
      expect(session?.userId).toBe("auth0|64f123456789abcdef");
      expect(session?.email).toBe("agent.forensic@ghosttrace.internal");
      expect(session?.isDemo).toBe(false);
    });

    it("returns null when getSession returns empty or null session", async () => {
      process.env.AUTH0_SECRET = "super_secret_session_key_32_chars_long!";
      process.env.AUTH0_DOMAIN = "tenant.us.auth0.com";
      process.env.AUTH0_CLIENT_ID = "client_xyz123";
      process.env.AUTH0_CLIENT_SECRET = "client_secret_abc456";

      const client = getAuth0Client();
      vi.spyOn(client, "getSession").mockResolvedValueOnce(null);

      const session = await getServerSession();
      expect(session).toBeNull();
    });

    it("returns null when user object has no sub claim", async () => {
      process.env.AUTH0_SECRET = "super_secret_session_key_32_chars_long!";
      process.env.AUTH0_DOMAIN = "tenant.us.auth0.com";
      process.env.AUTH0_CLIENT_ID = "client_xyz123";
      process.env.AUTH0_CLIENT_SECRET = "client_secret_abc456";

      const mockInvalidSession = {
        user: { name: "Missing Sub" },
      } as unknown as ClientSession;

      const client = getAuth0Client();
      vi.spyOn(client, "getSession").mockResolvedValueOnce(mockInvalidSession);

      const session = await getServerSession();
      expect(session).toBeNull();
    });
  });

  describe("Next.js 16 Proxy Handling", () => {
    it("bypasses to next() when Auth0 is not configured", async () => {
      const dummyReq = new Request("http://localhost:3000/api/traces/analyze");
      const res = await proxy(dummyReq);
      expect(res.status).toBe(200);
      expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("delegates to auth0 middleware when Auth0 is configured", async () => {
      process.env.AUTH0_SECRET = "super_secret_session_key_32_chars_long!";
      process.env.AUTH0_DOMAIN = "tenant.us.auth0.com";
      process.env.AUTH0_CLIENT_ID = "client_xyz123";
      process.env.AUTH0_CLIENT_SECRET = "client_secret_abc456";

      const client = getAuth0Client();
      const mockRedirect = NextResponse.redirect("http://localhost:3000/auth/login");
      const mockMiddleware = vi.spyOn(client, "middleware").mockResolvedValueOnce(mockRedirect);

      const dummyReq = new Request("http://localhost:3000/protected-route");
      const res = await proxy(dummyReq);
      expect(mockMiddleware).toHaveBeenCalledWith(dummyReq);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/auth/login");
    });
  });
});
