import { NextRequest, NextResponse } from "next/server";
import { saveInvestigation, StoredInvestigation } from "@/lib/db/traceRepository";
import { getServerSession, isAuth0Configured } from "@/lib/auth/auth0";

export async function POST(req: NextRequest) {
  try {
    const isProd = process.env.NODE_ENV === "production";
    const auth0Ready = isAuth0Configured();

    // Requirement 2: If Auth0 is not configured in production, return HTTP 503 with AUTH_NOT_CONFIGURED
    if (isProd && !auth0Ready) {
      return NextResponse.json(
        {
          success: false,
          code: "AUTH_NOT_CONFIGURED",
          error: "AUTH_NOT_CONFIGURED",
          message: "Authentication service is not configured in production environment",
        },
        { status: 503 }
      );
    }

    const session = await getServerSession(req);

    // Requirement 1 & 3: Require a verified Auth0 session for saving investigations.
    // Anonymous visitors are strictly denied saving investigations to server-side storage.
    if (!session || !session.userId) {
      return NextResponse.json(
        {
          success: false,
          code: "UNAUTHORIZED",
          error: "Unauthorized: authenticated session required to save investigations",
        },
        { status: 401 }
      );
    }

    // Always bind strictly to verified session identity; never accept client-supplied ownerId
    const ownerId = session.userId;

    const body = await req.json();

    if (!body.traceId || !body.agentName) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: traceId and agentName" },
        { status: 400 }
      );
    }

    // Ignore any client-supplied body.ownerId
    const investigation: StoredInvestigation = {
      ownerId,
      traceId: body.traceId,
      agentName: body.agentName,
      status: body.status || "failed",
      primaryFailureCategory: body.primaryFailureCategory || "unknown",
      totalDurationMs: body.totalDurationMs || 0,
      totalTokens: body.totalTokens || 0,
      estimatedCostUsd: body.estimatedCostUsd || 0,
      eventsCount: body.eventsCount || 0,
      anomaliesCount: body.anomaliesCount || 0,
      hypothesis: body.hypothesis || {
        title: "Unspecified Failure",
        model: "Unknown",
        explanation: "No explanation provided",
        groundedEventIds: [],
        confidence: 0,
        validationStatus: "unverified",
        suggestedFix: "No fix provided",
      },
      generatedTestCode: body.generatedTestCode || "",
      createdAt: body.createdAt || new Date().toISOString(),
      metadata: body.metadata,
    };

    const result = await saveInvestigation(investigation);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to save investigation";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
