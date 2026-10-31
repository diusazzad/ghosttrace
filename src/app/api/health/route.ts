import { NextResponse } from "next/server";
import { isMongoConfigured } from "@/lib/db/mongodb";
import { isAuth0Configured } from "@/lib/auth/auth0";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasBackboard = Boolean(
    process.env.BACKBOARD_API_KEY &&
    process.env.BACKBOARD_API_KEY !== "your_backboard_api_key_here" &&
    process.env.BACKBOARD_API_KEY.trim().length > 0
  );

  let aiReasonerStatus: "ready" | "degraded_fallback" = "degraded_fallback";
  let aiReasonerProvider = "deterministic_rules";

  // Perform a live network probe to Backboard API when credentials are present
  if (hasBackboard) {
    try {
      const apiKey = process.env.BACKBOARD_API_KEY!.trim();
      const baseURL = process.env.BACKBOARD_BASE_URL || "https://api.backboard.io/v1";
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);

      const probeRes = await fetch(`${baseURL}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeoutId);

      if (probeRes && (probeRes.ok || probeRes.status === 200)) {
        aiReasonerProvider = "backboard_remote";
        aiReasonerStatus = "ready";
      } else {
        // Backboard remote endpoint unreachable or rejected key: fall back gracefully
        aiReasonerProvider = "deterministic_rules";
        aiReasonerStatus = "degraded_fallback";
      }
    } catch {
      aiReasonerProvider = "deterministic_rules";
      aiReasonerStatus = "degraded_fallback";
    }
  }

  const hasSentry = Boolean(
    process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  );

  const hasMongo = isMongoConfigured();
  const auth0Connected = isAuth0Configured();

  return NextResponse.json({
    status: "healthy",
    service: "ghosttrace",
    version: "0.1.0",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    subsystems: {
      forensicsEngine: "active_deterministic",
      aiReasoner: {
        model: process.env.GEMMA_MODEL_NAME || "google/gemma-2-9b-it",
        provider: aiReasonerProvider,
        status: aiReasonerStatus,
        groundingEnforcement: "active",
      },
      workflowOrchestration: {
        engine: "Mastra Core v1.80.0",
        steps: 4,
        status: "ready",
      },
      observability: {
        sentryAgentTracing: hasSentry ? "connected" : "offline_instrumented",
        genAiSpans: "enabled",
      },
      storage: {
        engine: hasMongo ? "mongodb_atlas" : "in_memory_fallback",
        database: process.env.MONGODB_DB_NAME || "ghosttrace_forensics",
      },
      identity: {
        provider: "auth0",
        status: auth0Connected ? "configured" : "not_configured",
        connectionState: auth0Connected ? "connected" : "disconnected",
      },
    },
  });
}
