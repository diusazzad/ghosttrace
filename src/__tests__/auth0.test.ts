import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";
import {
  isAuth0Configured,
  isValidAuth0Domain,
  getServerSession,
  getAuth0Client,
  Auth0ConfigurationError,
} from "@/lib/auth/auth0";
import { proxy } from "@/proxy";
import { GET as healthGet } from "@/app/api/health/route";

type ClientSession = NonNullable<Awaited<ReturnType<ReturnType<typeof getAuth0Client>["getSession"]>>>;

describe("Auth0 v4 Configuration & Identity Verification (TASK 01B.1)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.AUTH0_DOMAIN;
    delete process.env.AUTH0_CLIENT_ID;
    delete process.env.AUTH0_CLIENT_SECRET;
    delete process.env.AUTH0_SECRET;
    delete process.env.APP_BASE_URL;
    delete process.env.AUTH0_BASE_URL;
    delete process.env.AUTH0_ISSUER_BASE_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("1. Domain & Hostname Validation (SDK v4 Contract)", () => {
    it("accepts valid scheme-less hostname", () => {
      expect(isValidAuth0Domain("tenant.us.auth0.com")).toBe(true);
      expect(isValidAuth0Domain("auth.mycompany.org")).toBe(true);
    });

    it("rejects domains with https:// or http:// scheme", () => {
      expect(isValidAuth0Domain("https://tenant.us.auth0.com")).toBe(false);
      expect(isValidAuth0Domain("http://tenant.us.auth0.com")).toBe(false);
    });

    it("rejects domains with paths, query params, or fragments", () => {
      expect(isValidAuth0Domain("tenant.us.auth0.com/")).toBe(false);
      expect(isValidAuth0Domain("tenant.us.auth0.com/auth")).toBe(false);
      expect(isValidAuth0Domain("tenant.us.auth0.com?query=1")).toBe(false);
      expect(isValidAuth0Domain("tenant.us.auth0.com#hash")).toBe(false);
    });

    it("rejects documentation placeholders and dummy domains", () => {
      expect(isValidAuth0Domain("your-tenant.us.auth0.com")).toBe(false);
      expect(isValidAuth0Domain("demo.auth0.com")).toBe(false);
      expect(isValidAuth0Domain("")).toBe(false);
      expect(isValidAuth0Domain(undefined)).toBe(false);
    });
  });

  describe("2. SDK v4 Environment Configuration Detection", () => {
    it("reports false when environment variables are completely absent", () => {
      expect(isAuth0Configured()).toBe(false);
    });

    it("reports false when AUTH0_ISSUER_BASE_URL is set but AUTH0_DOMAIN is absent", () => {
      // Legacy v3 pattern must not be accepted as valid v4 config
      process.env.AUTH0_ISSUER_BASE_URL = "https://tenant.us.auth0.com";
      process.env.AUTH0_CLIENT_ID = "client_id_123456";
      process.env.AUTH0_CLIENT_SECRET = "client_secret_abcdef123456";
      process.env.AUTH0_SECRET = "session_secret_32_characters_minimum!";
      process.env.APP_BASE_URL = "http://localhost:3000";

      expect(isAuth0Configured()).toBe(false);
    });

    it("reports false when placeholder strings are present", () => {
      process.env.AUTH0_DOMAIN = "your-tenant.us.auth0.com";
      process.env.AUTH0_CLIENT_ID = "your_auth0_client_id";
      process.env.AUTH0_CLIENT_SECRET = "your_auth0_client_secret";
      process.env.AUTH0_SECRET = "your_auth0_session_secret_32_bytes_min";
      process.env.APP_BASE_URL = "http://localhost:3000";

      expect(isAuth0Configured()).toBe(false);
    });

    it("reports true when all v4 requirements are satisfied", () => {
      process.env.AUTH0_DOMAIN = "tenant.us.auth0.com";
      process.env.AUTH0_CLIENT_ID = "valid_client_id_xyz";
      process.env.AUTH0_CLIENT_SECRET = "valid_client_secret_abcdef123456";
      process.env.AUTH0_SECRET = "valid_session_secret_32_characters_min!";
      process.env.APP_BASE_URL = "http://localhost:3000";

      expect(isAuth0Configured()).toBe(true);
    });
  });

  describe("3. Client Factory Safety & No Hard-Coded Credentials", () => {
    it("throws Auth0ConfigurationError when called while unconfigured", () => {
      expect(() => getAuth0Client()).toThrow(Auth0ConfigurationError);
      expect(() => getAuth0Client()).toThrow(/Auth0 v4 is not configured/);
    });

    it("does not throw and instantiates Auth0Client when valid v4 config is present", () => {
      process.env.AUTH0_DOMAIN = "tenant.us.auth0.com";
      process.env.AUTH0_CLIENT_ID = "valid_client_id_xyz";
      process.env.AUTH0_CLIENT_SECRET = "valid_client_secret_abcdef123456";
      process.env.AUTH0_SECRET = "valid_session_secret_32_characters_min!";
      process.env.APP_BASE_URL = "http://localhost:3000";

      const client = getAuth0Client();
      expect(client).toBeDefined();
      expect(typeof client.getSession).toBe("function");
    });
  });

  describe("4. Server Session Verification & Canonical Identity", () => {
    it("returns null when Auth0 is not configured", async () => {
      const session = await getServerSession();
      expect(session).toBeNull();
    });

    it("resolves canonical userId from session.user.sub when configured", async () => {
      process.env.AUTH0_DOMAIN = "tenant.us.auth0.com";
      process.env.AUTH0_CLIENT_ID = "valid_client_id_xyz";
      process.env.AUTH0_CLIENT_SECRET = "valid_client_secret_abcdef123456";
      process.env.AUTH0_SECRET = "valid_session_secret_32_characters_min!";
      process.env.APP_BASE_URL = "http://localhost:3000";

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
      expect(session?.name).toBe("Lead Forensic Investigator");
      expect(session?.isDemo).toBe(false);
    });

    it("returns null when session has no sub claim", async () => {
      process.env.AUTH0_DOMAIN = "tenant.us.auth0.com";
      process.env.AUTH0_CLIENT_ID = "valid_client_id_xyz";
      process.env.AUTH0_CLIENT_SECRET = "valid_client_secret_abcdef123456";
      process.env.AUTH0_SECRET = "valid_session_secret_32_characters_min!";
      process.env.APP_BASE_URL = "http://localhost:3000";

      const mockInvalidSession = {
        user: { name: "No Sub Field" },
      } as unknown as ClientSession;

      const client = getAuth0Client();
      vi.spyOn(client, "getSession").mockResolvedValueOnce(mockInvalidSession);

      const session = await getServerSession();
      expect(session).toBeNull();
    });

    it("handles session resolution error gracefully without throwing", async () => {
      process.env.AUTH0_DOMAIN = "tenant.us.auth0.com";
      process.env.AUTH0_CLIENT_ID = "valid_client_id_xyz";
      process.env.AUTH0_CLIENT_SECRET = "valid_client_secret_abcdef123456";
      process.env.AUTH0_SECRET = "valid_session_secret_32_characters_min!";
      process.env.APP_BASE_URL = "http://localhost:3000";

      const client = getAuth0Client();
      vi.spyOn(client, "getSession").mockRejectedValueOnce(new Error("Decryption failed"));

      const session = await getServerSession();
      expect(session).toBeNull();
    });
  });

  describe("5. Next.js 16 Proxy Handling", () => {
    it("bypasses to next() when Auth0 is not configured", async () => {
      const dummyReq = new Request("http://localhost:3000/api/traces/analyze");
      const res = await proxy(dummyReq);
      expect(res.status).toBe(200);
      expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("delegates to auth0 middleware when Auth0 is configured", async () => {
      process.env.AUTH0_DOMAIN = "tenant.us.auth0.com";
      process.env.AUTH0_CLIENT_ID = "valid_client_id_xyz";
      process.env.AUTH0_CLIENT_SECRET = "valid_client_secret_abcdef123456";
      process.env.AUTH0_SECRET = "valid_session_secret_32_characters_min!";
      process.env.APP_BASE_URL = "http://localhost:3000";

      const client = getAuth0Client();
      const mockRedirect = NextResponse.redirect("http://localhost:3000/auth/login");
      const mockMiddleware = vi.spyOn(client, "middleware").mockResolvedValueOnce(mockRedirect);

      const dummyReq = new Request("http://localhost:3000/protected-route");
      const res = await proxy(dummyReq);
      expect(mockMiddleware).toHaveBeenCalledWith(dummyReq);
      expect(res.status).toBe(307);
    });
  });

  describe("6. Truthful Health Endpoint Reporting", () => {
    it("reports not_configured when Auth0 is absent", async () => {
      const res = await healthGet();
      const data = await res.json();

      expect(data.subsystems.identity).toBeDefined();
      expect(data.subsystems.identity.provider).toBe("auth0");
      expect(data.subsystems.identity.status).toBe("not_configured");
      expect(data.subsystems.identity.status).not.toBe("connected");
    });

    it("reports configured (not connected) when environment variables are set", async () => {
      process.env.AUTH0_DOMAIN = "tenant.us.auth0.com";
      process.env.AUTH0_CLIENT_ID = "valid_client_id_xyz";
      process.env.AUTH0_CLIENT_SECRET = "valid_client_secret_abcdef123456";
      process.env.AUTH0_SECRET = "valid_session_secret_32_characters_min!";
      process.env.APP_BASE_URL = "http://localhost:3000";

      const res = await healthGet();
      const data = await res.json();

      expect(data.subsystems.identity.status).toBe("configured");
      expect(data.subsystems.identity.status).not.toBe("connected");
    });
  });
});
