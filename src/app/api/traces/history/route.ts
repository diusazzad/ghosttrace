import { NextRequest, NextResponse } from "next/server";
import { listInvestigations, getTraceStatistics, DEFAULT_ANONYMOUS_OWNER } from "@/lib/db/traceRepository";
import { isMongoConfigured } from "@/lib/db/mongodb";
import { getServerSession } from "@/lib/auth/auth0";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    // If authenticated, scope to session user. If unauthenticated, allow ownerId query param or sandbox default
    const { searchParams } = new URL(req.url);
    const ownerId = session?.userId || searchParams.get("ownerId") || DEFAULT_ANONYMOUS_OWNER;
    const agentName = searchParams.get("agent") || undefined;
    const category = searchParams.get("category") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;

    const investigations = await listInvestigations({ ownerId, agentName, category, limit });
    const stats = await getTraceStatistics(ownerId);

    return NextResponse.json({
      success: true,
      ownerId,
      storageEngine: isMongoConfigured() ? "mongodb_atlas" : "in_memory_fallback",
      count: investigations.length,
      statistics: stats,
      investigations,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to load trace history";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
