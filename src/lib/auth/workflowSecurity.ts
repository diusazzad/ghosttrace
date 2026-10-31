import { NextRequest, NextResponse } from "next/server";
import { isAuth0Configured, getServerSession } from "./auth0";

/**
 * Workflow Security Configuration
 */
const MAX_BODY_BYTES = 1024 * 1024; // 1 MiB hard payload limit
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
 * Implements security follow-up fixes for /api/traces/workflow and /api/traces/ultramarine:
 * 1. 1 MiB body limit enforcement.
 * 2. In production, 503 if Auth0 is unconfigured, 401 if unauthenticated.
 * 3. Canonical session ownerId binding (ignores client-provided ownerId).
 * 4. Rate-limit and concurrency throttling.
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

  // 3. Body size enforcement (Header check)
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: "PAYLOAD_TOO_LARGE",
          error: "Payload Too Large: request body exceeds 1 MiB limit",
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
  requestHistory.push(now);

  // 5. Concurrency throttle
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

  // 6. Streaming byte limit check on actual parsed body
  let rawBodyText: string;
  try {
    rawBodyText = await req.text();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          error: "Failed to read request body stream",
        },
        { status: 400 }
      ),
    };
  }

  const byteLength = Buffer.byteLength(rawBodyText, "utf8");
  if (byteLength > MAX_BODY_BYTES) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: "PAYLOAD_TOO_LARGE",
          error: `Payload Too Large: stream body size (${byteLength} bytes) exceeds 1 MiB limit`,
        },
        { status: 413 }
      ),
    };
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBodyText);
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

  // Acquire concurrency token
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
      ownerId, // override any client-provided ownerId with verified identity
    },
    releaseConcurrency,
  };
}

/**
 * Reset function used in unit testing
 */
export function _resetWorkflowSecurityForTesting() {
  activeWorkflowsCount = 0;
  requestHistory.length = 0;
}
