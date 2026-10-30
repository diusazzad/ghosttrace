import { NextRequest, NextResponse } from "next/server";
import { listInvestigations, getTraceStatistics } from "@/lib/db/traceRepository";
import { isMongoConfigured } from "@/lib/db/mongodb";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentName = searchParams.get("agent") || undefined;
    const category = searchParams.get("category") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;

    const investigations = await listInvestigations({ agentName, category, limit });
    const stats = await getTraceStatistics();

    return NextResponse.json({
      success: true,
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
