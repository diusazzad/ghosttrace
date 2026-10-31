import { NextRequest, NextResponse } from "next/server";
import { reconstructTimeline } from "@/lib/detector";
import { defaultTigerDataAdapter, TigerDataError } from "@/lib/tiger/tigerDataAdapter";
import { validateWorkflowSecurity } from "@/lib/auth/workflowSecurity";

export async function POST(req: NextRequest) {
  const securityCheck = await validateWorkflowSecurity(req);
  if (!securityCheck.ok) {
    return securityCheck.response;
  }

  const { body, releaseConcurrency } = securityCheck;

  try {
    const rawTrace = body.trace ?? body;
    const timeline = reconstructTimeline(rawTrace);

    const ingestResult = await defaultTigerDataAdapter.ingestTraceGraph(timeline);

    return NextResponse.json({
      success: true,
      ingestResult,
      traceId: timeline.traceId,
    });
  } catch (error: unknown) {
    if (error instanceof TigerDataError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Tiger Data operation failed",
        code: "TIGER_DATA_ERROR",
      },
      { status: 500 }
    );
  } finally {
    releaseConcurrency();
  }
}
