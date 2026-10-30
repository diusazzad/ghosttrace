import { NextResponse } from "next/server";
import { isMongoConfigured } from "@/lib/db/mongodb";
import { isAuth0Configured } from "@/lib/auth/auth0";

export async function GET() {
  const hasBackboard = Boolean(
    process.env.BACKBOARD_API_KEY &&
    process.env.BACKBOARD_API_KEY !== "your_backboard_api_key_here" &&
    process.env.BACKBOARD_API_KEY.trim().length > 0
  );

  const hasSentry = Boolean(
    process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  );

  const hasMongo = isMongoConfigured();

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
        provider: hasBackboard ? "backboard_remote" : "ollama_or_offline_fallback",
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
        status: isAuth0Configured() ? "connected" : "offline_demo_mode",
      },
    },
  });
}
