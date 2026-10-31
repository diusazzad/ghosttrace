import { describe, it, expect, vi } from "vitest";
import {
  BrowserbaseAdapter,
  BrowserbaseError,
  sanitizeBrowserbaseLog,
  BrowserbaseSessionSchema,
} from "@/lib/browser/browserbaseAdapter";

describe("Browserbase Headless Forensics Integration (TASK 08)", () => {
  describe("1. Configuration & Key Detection", () => {
    it("1.1 isConfigured returns false when API key or Project ID is missing", () => {
      const adapter1 = new BrowserbaseAdapter({ apiKey: "", projectId: "proj_123" });
      expect(adapter1.isConfigured()).toBe(false);

      const adapter2 = new BrowserbaseAdapter({ apiKey: "bb_key", projectId: "" });
      expect(adapter2.isConfigured()).toBe(false);

      const adapter3 = new BrowserbaseAdapter({
        apiKey: "your_browserbase_api_key_here",
        projectId: "proj_123",
      });
      expect(adapter3.isConfigured()).toBe(false);
    });

    it("1.2 isConfigured returns true when both valid API key and Project ID are set", () => {
      const adapter = new BrowserbaseAdapter({
        apiKey: "bb_live_key_999",
        projectId: "proj_ghosttrace_prod",
      });
      expect(adapter.isConfigured()).toBe(true);
    });

    it("1.3 createSession throws API_KEY_MISSING when unconfigured", async () => {
      const adapter = new BrowserbaseAdapter({ apiKey: "" });
      await expect(adapter.createSession()).rejects.toThrow(BrowserbaseError);

      try {
        await adapter.createSession();
      } catch (err: unknown) {
        const bbErr = err as BrowserbaseError;
        expect(bbErr.code).toBe("API_KEY_MISSING");
        expect(bbErr.statusCode).toBe(401);
      }
    });

    it("1.4 createSession throws PROJECT_ID_MISSING when apiKey is present but projectId is missing", async () => {
      const adapter = new BrowserbaseAdapter({
        apiKey: "bb_live_key",
        projectId: "",
      });
      await expect(adapter.createSession()).rejects.toThrow(BrowserbaseError);

      try {
        await adapter.createSession();
      } catch (err: unknown) {
        const bbErr = err as BrowserbaseError;
        expect(bbErr.code).toBe("PROJECT_ID_MISSING");
        expect(bbErr.statusCode).toBe(400);
      }
    });
  });

  describe("2. Log & Credential Sanitization", () => {
    it("2.1 sanitizes Bearer tokens in browser logs", () => {
      const log = "Request failed: Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.dummy.sig";
      const sanitized = sanitizeBrowserbaseLog(log);
      expect(sanitized).toContain("Bearer [REDACTED_TOKEN]");
      expect(sanitized).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    });

    it("2.2 sanitizes sensitive query parameters (apiKey, password, token)", () => {
      const log = "Navigating to https://api.example.com/v1?apiKey=super_secret_123&user=admin";
      const sanitized = sanitizeBrowserbaseLog(log);
      expect(sanitized).toContain("[REDACTED_SECRET]");
      expect(sanitized).not.toContain("super_secret_123");
    });

    it("2.3 sanitizes cookie and set-cookie headers in network logs", () => {
      const log = "Header: Cookie: session_id=xyz987; tracker=abc";
      const sanitized = sanitizeBrowserbaseLog(log);
      expect(sanitized).toContain("cookie: [REDACTED_COOKIE]");
      expect(sanitized).not.toContain("xyz987");
    });
  });

  describe("3. Session Creation & Retrieval", () => {
    it("3.1 creates a session and parses valid schema response", async () => {
      const mockSession = {
        id: "sess_bb_001",
        status: "RUNNING",
        projectId: "proj_gt_123",
        createdAt: "2026-10-31T10:00:00.000Z",
        debugUrl: "https://www.browserbase.com/devtools/inspector.html?sess=sess_bb_001",
        replayUrl: "https://www.browserbase.com/sessions/sess_bb_001",
      };

      const mockFetch: typeof fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockSession),
      } as unknown as Response);

      const adapter = new BrowserbaseAdapter({
        apiKey: "bb_test_key",
        projectId: "proj_gt_123",
        fetchFn: mockFetch,
      });

      const session = await adapter.createSession();
      expect(session.id).toBe("sess_bb_001");
      expect(session.status).toBe("RUNNING");
      expect(session.replayUrl).toBe(mockSession.replayUrl);
      expect(BrowserbaseSessionSchema.safeParse(session).success).toBe(true);
    });

    it("3.2 retrieves session details by id", async () => {
      const mockSession = {
        id: "sess_bb_002",
        status: "COMPLETED",
        projectId: "proj_gt_123",
        createdAt: "2026-10-31T10:05:00.000Z",
        replayUrl: "https://www.browserbase.com/sessions/sess_bb_002",
      };

      const mockFetch: typeof fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockSession),
      } as unknown as Response);

      const adapter = new BrowserbaseAdapter({
        apiKey: "bb_test_key",
        projectId: "proj_gt_123",
        fetchFn: mockFetch,
      });

      const session = await adapter.getSession("sess_bb_002");
      expect(session.id).toBe("sess_bb_002");
      expect(session.status).toBe("COMPLETED");
    });

    it("3.3 throws SESSION_NOT_FOUND with 404 when session does not exist", async () => {
      const mockFetch: typeof fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "Session not found" }),
      } as unknown as Response);

      const adapter = new BrowserbaseAdapter({
        apiKey: "bb_test_key",
        projectId: "proj_gt_123",
        fetchFn: mockFetch,
      });

      await expect(adapter.getSession("non_existent_id")).rejects.toThrow(
        BrowserbaseError
      );

      try {
        await adapter.getSession("non_existent_id");
      } catch (err: unknown) {
        const bbErr = err as BrowserbaseError;
        expect(bbErr.code).toBe("SESSION_NOT_FOUND");
        expect(bbErr.statusCode).toBe(404);
      }
    });

    it("3.4 retrieves logs and applies automatic secret sanitization", async () => {
      const mockLogs = [
        {
          timestamp: "2026-10-31T10:01:00.000Z",
          level: "info",
          message: "Loaded page https://checkout.example.com",
          source: "console",
        },
        {
          timestamp: "2026-10-31T10:01:05.000Z",
          level: "error",
          message: "Failed request with Authorization: Bearer sec_tok_secret999",
          source: "network",
        },
      ];

      const mockFetch: typeof fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockLogs),
      } as unknown as Response);

      const adapter = new BrowserbaseAdapter({
        apiKey: "bb_test_key",
        projectId: "proj_gt_123",
        fetchFn: mockFetch,
      });

      const logs = await adapter.getSessionLogs("sess_bb_001");
      expect(logs.length).toBe(2);
      expect(logs[1].message).toContain("Bearer [REDACTED_TOKEN]");
      expect(logs[1].message).not.toContain("sec_tok_secret999");
    });
  });

  describe("4. Error Handling & Upstream Failures", () => {
    it("4.1 handles 401 upstream with AUTHENTICATION_FAILED", async () => {
      const mockFetch: typeof fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: "Invalid API Key" }),
      } as unknown as Response);

      const adapter = new BrowserbaseAdapter({
        apiKey: "bb_invalid_key",
        projectId: "proj_123",
        fetchFn: mockFetch,
      });

      await expect(adapter.createSession()).rejects.toThrow(BrowserbaseError);
      try {
        await adapter.createSession();
      } catch (err: unknown) {
        const bbErr = err as BrowserbaseError;
        expect(bbErr.code).toBe("AUTHENTICATION_FAILED");
        expect(bbErr.statusCode).toBe(401);
      }
    });

    it("4.2 handles 500 upstream with UPSTREAM_REQUEST_FAILED and isRetryable: true", async () => {
      const mockFetch: typeof fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ message: "Bad Gateway" }),
      } as unknown as Response);

      const adapter = new BrowserbaseAdapter({
        apiKey: "bb_test_key",
        projectId: "proj_123",
        fetchFn: mockFetch,
      });

      try {
        await adapter.createSession();
      } catch (err: unknown) {
        const bbErr = err as BrowserbaseError;
        expect(bbErr.code).toBe("UPSTREAM_REQUEST_FAILED");
        expect(bbErr.statusCode).toBe(502);
        expect(bbErr.isRetryable).toBe(true);
      }
    });
  });
});
