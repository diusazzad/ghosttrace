import { NextRequest, NextResponse } from "next/server";
import { listInvestigations, getTraceStatistics } from "@/lib/db/traceRepository";
import { isMongoConfigured } from "@/lib/db/mongodb";
import { getServerSession, isAuth0Configured } from "@/lib/auth/auth0";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(req);

    // Requirement 2: Return 401 for unauthenticated history access when Auth0 is configured
    if (isAuth0Configured() && (!session || !session.userId)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: authenticated session required to access investigation history" },
        { status: 401 }
      );
    }

    // Requirement 3: Never accept ownerId from query parameters.
    // Query is strictly scoped to server session identity (or local demo mode).
    const ownerId = session?.userId || "demo_local_isolated";

    const { searchParams } = new URL(req.url);
    const agentName = searchParams.get("agent") || undefined;
    const category = searchParams.get("category") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;

    const investigations = await listInvestigations({ ownerId, agentName, category, limit });
    const stats = await getTraceStatistics(ownerId);

    return NextResponse.json({
      success: true,
      ownerId,
      storageEngine: isMongoConfigured() && session?.userId ? "mongodb_atlas" : "in_memory_fallback",
      count: investigations.length,
      statistics: stats,
      investigations,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to load trace history";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
