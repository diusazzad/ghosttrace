import { NextRequest, NextResponse } from "next/server";
import { isAuth0Configured, getServerSession } from "./auth0";

/**
 * Workflow Security Configuration
 */
export const MAX_BODY_BYTES = 1024 * 1024; // 1,048,576 bytes = 1 MiB hard payload limit
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 30; // Max 30 requests per minute
const MAX_CONCURRENT_WORKFLOWS = 5; // Max 5 concurrent executions

// In-memory sliding window rate-limiter and concurrency counter
const requestHistory: number[] = [];
let activeWorkflowsCount = 0;

export interface WorkflowSecurityResult {
  ok: boolean;
  ownerId?: string;
  body?: Record<string, unknown>;
  response?: NextResponse;
  releaseConcurrency?: () => void;
}

/**
 * Validates request size, rate limiting, concurrency, and enforces verified session ownership.
 * 1. 1 MiB body limit early rejection via Content-Length header.
 * 2. True incremental streaming byte counting using req.body.getReader() to prevent buffering oversized payloads.
 * 3. Immediate stream cancellation and lock release upon exceeding 1 MiB.
 * 4. In production, 503 if Auth0 is unconfigured, 401 if unauthenticated.
 * 5. Canonical session ownerId binding (ignores client-provided ownerId).
 * 6. Rate-limit and concurrency throttling (token acquired ONLY after valid JSON is parsed).
 * 7. Clean handling of empty body, invalid UTF-8, and malformed JSON.
 */
export async function validateWorkflowSecurity(
  req: NextRequest
): Promise<
  | {
      ok: true;
      ownerId: string;
      body: Record<string, unknown>;
      releaseConcurrency: () => void;
    }
  | {
      ok: false;
      response: NextResponse;
    }
> {
  const isProd = process.env.NODE_ENV === "production";

  // 1. Auth0 Configuration Check
  if (isProd && !isAuth0Configured()) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: "AUTH_NOT_CONFIGURED",
          error: "Auth0 is not configured in production environment.",
        },
        { status: 503 }
      ),
    };
  }

  // 2. Session verification
  const session = await getServerSession(req);
  if (isProd && !session) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: "UNAUTHORIZED",
          error: "Authentication required to execute workflows.",
        },
        { status: 401 }
      ),
    };
  }

  const ownerId = session?.userId || "dev_local_user";

  // 3. Early rejection via Content-Length header if present
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: "PAYLOAD_TOO_LARGE",
          error: `Payload Too Large: request body (${contentLength} bytes) exceeds 1 MiB limit (${MAX_BODY_BYTES} bytes)`,
        },
        { status: 413 }
      ),
    };
  }

  // 4. Rate limiting check (Sliding window)
  const now = Date.now();
  while (requestHistory.length > 0 && requestHistory[0] < now - RATE_LIMIT_WINDOW_MS) {
    requestHistory.shift();
  }
  if (requestHistory.length >= MAX_REQUESTS_PER_WINDOW) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: "RATE_LIMIT_EXCEEDED",
          error: `Rate limit exceeded: maximum ${MAX_REQUESTS_PER_WINDOW} workflow runs per minute`,
        },
        { status: 429 }
      ),
    };
  }

  // 5. Check concurrency availability prior to streaming
  if (activeWorkflowsCount >= MAX_CONCURRENT_WORKFLOWS) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: "CONCURRENCY_LIMIT_REACHED",
          error: `Workflow execution concurrency limit (${MAX_CONCURRENT_WORKFLOWS}) reached. Please retry shortly.`,
        },
        { status: 429 }
      ),
    };
  }

  // 6. Incremental streaming byte count via req.body.getReader()
  let rawBodyText = "";
  if (req.body && typeof req.body.getReader === "function") {
    const reader = req.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let totalBytes = 0;
    let streamCancelled = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > MAX_BODY_BYTES) {
            streamCancelled = true;
            await reader.cancel("Payload Too Large: stream body exceeded 1 MiB limit");
            return {
              ok: false,
              response: NextResponse.json(
                {
                  success: false,
                  code: "PAYLOAD_TOO_LARGE",
                  error: `Payload Too Large: stream body size (${totalBytes} bytes) exceeds 1 MiB limit (${MAX_BODY_BYTES} bytes)`,
                },
                { status: 413 }
              ),
            };
          }
          try {
            rawBodyText += decoder.decode(value, { stream: true });
          } catch {
            return {
              ok: false,
              response: NextResponse.json(
                {
                  success: false,
                  code: "INVALID_REQUEST",
                  error: "Invalid UTF-8 encoding in request body",
                },
                { status: 400 }
              ),
            };
          }
        }
      }
      try {
        rawBodyText += decoder.decode();
      } catch {
        return {
          ok: false,
          response: NextResponse.json(
            {
              success: false,
              code: "INVALID_REQUEST",
              error: "Invalid UTF-8 encoding in request body",
            },
            { status: 400 }
          ),
        };
      }
    } catch (err: unknown) {
      if (!streamCancelled) {
        try {
          await reader.cancel("Stream reading failed");
        } catch {
          // ignore error on reader cancel
        }
      }
      return {
        ok: false,
        response: NextResponse.json(
          {
            success: false,
            code: "INVALID_REQUEST",
            error: `Failed to read request body stream: ${err instanceof Error ? err.message : "Stream error"}`,
          },
          { status: 400 }
        ),
      };
    } finally {
      reader.releaseLock();
    }
  } else {
    try {
      rawBodyText = await req.text();
    } catch {
      rawBodyText = "";
    }
  }

  // Handle empty body
  if (!rawBodyText || rawBodyText.trim().length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          error: "Request body is empty",
        },
        { status: 400 }
      ),
    };
  }

  // Validate JSON structure
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBodyText);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            success: false,
            code: "INVALID_JSON",
            error: "Request body must be a valid JSON object",
          },
          { status: 400 }
        ),
      };
    }
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: "INVALID_JSON",
          error: "Invalid JSON in request body",
        },
        { status: 400 }
      ),
    };
  }

  requestHistory.push(now);

  // 7. Acquire concurrency token ONLY after valid request has been fully validated and parsed
  activeWorkflowsCount++;
  let released = false;
  const releaseConcurrency = () => {
    if (!released) {
      released = true;
      activeWorkflowsCount = Math.max(0, activeWorkflowsCount - 1);
    }
  };

  return {
    ok: true,
    ownerId,
    body: {
      ...body,
      ownerId,
    },
    releaseConcurrency,
  };
}

export function _getActiveWorkflowsCount(): number {
  return activeWorkflowsCount;
}

export function _resetWorkflowSecurityForTesting() {
  activeWorkflowsCount = 0;
  requestHistory.length = 0;
}
