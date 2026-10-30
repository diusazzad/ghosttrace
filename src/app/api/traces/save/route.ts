import { NextRequest, NextResponse } from "next/server";
import { saveInvestigation, StoredInvestigation, DEFAULT_ANONYMOUS_OWNER } from "@/lib/db/traceRepository";
import { getServerSession } from "@/lib/auth/auth0";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    // Bind investigation to verified Auth0 session user (session.userId) or fallback to sandbox
    const ownerId = session?.userId || DEFAULT_ANONYMOUS_OWNER;

    const body = await req.json();

    if (!body.traceId || !body.agentName) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: traceId and agentName" },
        { status: 400 }
      );
    }

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
