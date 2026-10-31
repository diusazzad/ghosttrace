import { NextRequest, NextResponse } from "next/server";
import { reconstructTimeline } from "@/lib/detector";
import { defaultBackboardAdapter } from "@/lib/ai/backboardAdapter";
import { validateWorkflowSecurity } from "@/lib/auth/workflowSecurity";

export async function POST(req: NextRequest) {
  const securityCheck = await validateWorkflowSecurity(req);
  if (!securityCheck.ok) {
    return securityCheck.response;
  }

  const { body, ownerId, releaseConcurrency } = securityCheck;

  try {
    const rawTrace = body.trace ?? body;
    const timeline = reconstructTimeline(rawTrace);
    const backboardResult =
      await defaultBackboardAdapter.analyzeFailureTrace(timeline);

    return NextResponse.json({
      success: true,
      ownerId,
      timeline,
      result: backboardResult,
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Backboard analysis failed";
    const errorRecord = error as {
      statusCode?: number;
      status?: number;
      code?: string;
      requestId?: string;
    };
    const status = errorRecord?.statusCode || errorRecord?.status || 400;

    return NextResponse.json(
      {
        success: false,
        error: msg,
        code: errorRecord?.code || "BACKBOARD_ERROR",
        requestId: errorRecord?.requestId,
      },
      { status }
    );
  } finally {
    releaseConcurrency();
  }
}
