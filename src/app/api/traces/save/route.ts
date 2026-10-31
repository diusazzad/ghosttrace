import { NextRequest, NextResponse } from "next/server";
import { saveInvestigation, StoredInvestigation } from "@/lib/db/traceRepository";
import { getServerSession, isAuth0Configured } from "@/lib/auth/auth0";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(req);

    // Requirement 1 & 2: Return 401 when Auth0 is configured and request lacks a verified session
    if (isAuth0Configured() && (!session || !session.userId)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: authenticated session required to save investigations" },
        { status: 401 }
      );
    }

    // Requirement 3: Never accept client-supplied ownerId. Always bind strictly to session identity
    const ownerId = session?.userId || "demo_local_isolated";

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
