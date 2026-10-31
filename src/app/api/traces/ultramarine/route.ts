import { NextRequest, NextResponse } from "next/server";
import { reconstructTimeline } from "@/lib/detector";
import { defaultUltramarineAdapter } from "@/lib/ai/ultramarineAdapter";
import { validateWorkflowSecurity } from "@/lib/auth/workflowSecurity";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const securityCheck = await validateWorkflowSecurity(req);
  if (!securityCheck.ok) {
    return securityCheck.response;
  }

  const { body, ownerId, releaseConcurrency } = securityCheck;

  try {
    const rawTrace = body.trace ?? body;
    const timeline = reconstructTimeline(rawTrace);
    const ultramarineResult =
      await defaultUltramarineAdapter.analyzeFailureTrace(timeline);

    return NextResponse.json({
      success: true,
      ownerId,
      timeline,
      result: ultramarineResult,
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Ultramarine analysis failed";
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
        code: errorRecord?.code || "ULTRAMARINE_ERROR",
        requestId: errorRecord?.requestId,
      },
      { status }
    );
  } finally {
    releaseConcurrency();
  }
}
