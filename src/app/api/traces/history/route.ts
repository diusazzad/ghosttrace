import { NextRequest, NextResponse } from "next/server";
import { listInvestigations, getTraceStatistics } from "@/lib/db/traceRepository";
import { isMongoConfigured } from "@/lib/db/mongodb";
import { getServerSession, isAuth0Configured } from "@/lib/auth/auth0";

export async function GET(req: NextRequest) {
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

    // Requirement 1 & 3: Require a verified Auth0 session to access history.
    // Anonymous visitors are never permitted to access shared server-side history.
    if (!session || !session.userId) {
      return NextResponse.json(
        {
          success: false,
          code: "UNAUTHORIZED",
          error: "Unauthorized: authenticated session required to access investigation history",
        },
        { status: 401 }
      );
    }

    // Always bind strictly to verified session identity
    const ownerId = session.userId;

    const { searchParams } = new URL(req.url);
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
