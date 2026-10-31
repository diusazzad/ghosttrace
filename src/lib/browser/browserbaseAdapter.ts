import { z } from "zod";
import { recordAgentBreadcrumb } from "@/lib/telemetry/sentryTracer";

/**
 * Zod Schemas for Browserbase Session & Forensics
 */
export const BrowserbaseSessionSchema = z.object({
  id: z.string().min(1, "Session ID must not be empty"),
  status: z.enum(["RUNNING", "COMPLETED", "ERROR", "TIMED_OUT"]),
  projectId: z.string().min(1, "Project ID must not be empty"),
  createdAt: z.string(),
  expiresAt: z.string().optional(),
  connectUrl: z.string().url().optional(),
  debugUrl: z.string().url().optional(),
  replayUrl: z.string().url().optional(),
});

export type BrowserbaseSession = z.infer<typeof BrowserbaseSessionSchema>;

export const BrowserbaseLogEntrySchema = z.object({
  timestamp: z.string(),
  level: z.enum(["info", "warn", "error", "debug"]),
  message: z.string(),
  source: z.enum(["console", "network"]).default("console"),
});

export type BrowserbaseLogEntry = z.infer<typeof BrowserbaseLogEntrySchema>;

export class BrowserbaseError extends Error {
  readonly code:
    | "API_KEY_MISSING"
    | "PROJECT_ID_MISSING"
    | "AUTHENTICATION_FAILED"
    | "SESSION_NOT_FOUND"
    | "UPSTREAM_REQUEST_FAILED"
    | "SCHEMA_VALIDATION_FAILED";
  readonly statusCode: number;
  readonly isRetryable: boolean;

  constructor(
    message: string,
    code: BrowserbaseError["code"],
    statusCode: number = 500,
    isRetryable: boolean = false
  ) {
    super(`[Browserbase] ${message}`);
    this.name = "BrowserbaseError";
    this.code = code;
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
  }
}

/**
 * Recursively sanitizes URLs, logs, and metadata to eliminate credentials,
 * auth tokens, cookies, and secrets before exposing them.
 */
export function sanitizeBrowserbaseLog(text: string): string {
  if (!text || typeof text !== "string") return text;
  return text
    .replace(/Bearer\s+[A-Za-z0-9\-_.~+/]+=*/gi, "Bearer [REDACTED_TOKEN]")
    .replace(/ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, "[REDACTED_JWT]")
    .replace(/((?:apiKey|api_key|token|access_token|password|secret|auth)=)[^&\s]+/gi, "$1[REDACTED_SECRET]")
    .replace(/cookie:\s*([^;\r\n]+)/gi, "cookie: [REDACTED_COOKIE]")
    .replace(/set-cookie:\s*([^;\r\n]+)/gi, "set-cookie: [REDACTED_COOKIE]");
}

export interface BrowserbaseAdapterOptions {
  apiKey?: string;
  projectId?: string;
  baseURL?: string;
  fetchFn?: typeof fetch;
}

export class BrowserbaseAdapter {
  private apiKey?: string;
  private projectId?: string;
  private baseURL: string;
  private fetchFn: typeof fetch;

  constructor(options: BrowserbaseAdapterOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.BROWSERBASE_API_KEY;
    this.projectId = options.projectId ?? process.env.BROWSERBASE_PROJECT_ID;
    this.baseURL =
      options.baseURL ??
      process.env.BROWSERBASE_BASE_URL ??
      "https://api.browserbase.com/v1";
    this.fetchFn = options.fetchFn ?? fetch;
  }

  isConfigured(): boolean {
    return Boolean(
      this.apiKey &&
      this.apiKey.trim().length > 0 &&
      this.apiKey !== "your_browserbase_api_key_here" &&
      this.projectId &&
      this.projectId.trim().length > 0
    );
  }

  /**
   * Creates a remote cloud headless browser session for agent forensics.
   */
  async createSession(options?: {
    projectId?: string;
    keepAlive?: boolean;
    timeout?: number;
  }): Promise<BrowserbaseSession> {
    if (!this.apiKey) {
      throw new BrowserbaseError(
        "BROWSERBASE_API_KEY is not configured.",
        "API_KEY_MISSING",
        401,
        false
      );
    }

    const projectId = options?.projectId ?? this.projectId;
    if (!projectId) {
      throw new BrowserbaseError(
        "BROWSERBASE_PROJECT_ID is not configured.",
        "PROJECT_ID_MISSING",
        400,
        false
      );
    }

    recordAgentBreadcrumb(
      "workflow",
      `Creating Browserbase headless forensic session for project ${projectId}`,
      { projectId }
    );

    const url = `${this.baseURL}/sessions`;
    let res: Response;
    try {
      res = await this.fetchFn(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bb-api-key": this.apiKey,
        },
        body: JSON.stringify({
          projectId,
          keepAlive: options?.keepAlive ?? false,
          timeout: options?.timeout ?? 300,
        }),
      });
    } catch (err: unknown) {
      throw new BrowserbaseError(
        `Failed to reach Browserbase API: ${err instanceof Error ? err.message : String(err)}`,
        "UPSTREAM_REQUEST_FAILED",
        500,
        true
      );
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new BrowserbaseError(
          "Browserbase authentication failed: Invalid API key",
          "AUTHENTICATION_FAILED",
          401,
          false
        );
      }
      throw new BrowserbaseError(
        `Failed to create session: HTTP ${res.status}`,
        "UPSTREAM_REQUEST_FAILED",
        res.status,
        res.status >= 500
      );
    }

    const data = await res.json();
    const parsed = BrowserbaseSessionSchema.safeParse(data);
    if (!parsed.success) {
      throw new BrowserbaseError(
        `Invalid session response schema: ${parsed.error.message}`,
        "SCHEMA_VALIDATION_FAILED",
        500,
        false
      );
    }

    return parsed.data;
  }

  /**
   * Retrieves an existing session's current status and replay URL.
   */
  async getSession(sessionId: string): Promise<BrowserbaseSession> {
    if (!this.apiKey) {
      throw new BrowserbaseError(
        "BROWSERBASE_API_KEY is not configured.",
        "API_KEY_MISSING",
        401,
        false
      );
    }

    const url = `${this.baseURL}/sessions/${encodeURIComponent(sessionId)}`;
    let res: Response;
    try {
      res = await this.fetchFn(url, {
        method: "GET",
        headers: {
          "x-bb-api-key": this.apiKey,
        },
      });
    } catch (err: unknown) {
      throw new BrowserbaseError(
        `Failed to reach Browserbase API: ${err instanceof Error ? err.message : String(err)}`,
        "UPSTREAM_REQUEST_FAILED",
        500,
        true
      );
    }

    if (res.status === 404) {
      throw new BrowserbaseError(
        `Browserbase session ${sessionId} was not found`,
        "SESSION_NOT_FOUND",
        404,
        false
      );
    }

    if (!res.ok) {
      throw new BrowserbaseError(
        `Failed to retrieve session: HTTP ${res.status}`,
        "UPSTREAM_REQUEST_FAILED",
        res.status,
        res.status >= 500
      );
    }

    const data = await res.json();
    const parsed = BrowserbaseSessionSchema.safeParse(data);
    if (!parsed.success) {
      throw new BrowserbaseError(
        `Invalid session response schema: ${parsed.error.message}`,
        "SCHEMA_VALIDATION_FAILED",
        500,
        false
      );
    }

    return parsed.data;
  }

  /**
   * Retrieves browser console and network logs with automatic secret scrubbing.
   */
  async getSessionLogs(sessionId: string): Promise<BrowserbaseLogEntry[]> {
    if (!this.apiKey) {
      throw new BrowserbaseError(
        "BROWSERBASE_API_KEY is not configured.",
        "API_KEY_MISSING",
        401,
        false
      );
    }

    const url = `${this.baseURL}/sessions/${encodeURIComponent(sessionId)}/logs`;
    let res: Response;
    try {
      res = await this.fetchFn(url, {
        method: "GET",
        headers: {
          "x-bb-api-key": this.apiKey,
        },
      });
    } catch (err: unknown) {
      throw new BrowserbaseError(
        `Failed to reach Browserbase API: ${err instanceof Error ? err.message : String(err)}`,
        "UPSTREAM_REQUEST_FAILED",
        500,
        true
      );
    }

    if (!res.ok) {
      throw new BrowserbaseError(
        `Failed to retrieve logs: HTTP ${res.status}`,
        "UPSTREAM_REQUEST_FAILED",
        res.status,
        res.status >= 500
      );
    }

    const rawLogs = await res.json();
    if (!Array.isArray(rawLogs)) {
      return [];
    }

    return rawLogs.map((entry: unknown) => {
      const record = entry as Record<string, unknown>;
      const rawMsg = String(record.message ?? "");
      const sanitizedMsg = sanitizeBrowserbaseLog(rawMsg);
      return {
        timestamp: String(record.timestamp ?? new Date().toISOString()),
        level: (["info", "warn", "error", "debug"].includes(String(record.level))
          ? record.level
          : "info") as BrowserbaseLogEntry["level"],
        message: sanitizedMsg,
        source: record.source === "network" ? "network" : "console",
      };
    });
  }
}

export const defaultBrowserbaseAdapter = new BrowserbaseAdapter();
