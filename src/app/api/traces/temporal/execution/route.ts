import { NextRequest, NextResponse } from "next/server";
import { defaultTemporalAdapter, TemporalError } from "@/lib/temporal/temporalAdapter";
import { validateWorkflowSecurity } from "@/lib/auth/workflowSecurity";

export async function POST(req: NextRequest) {
  const securityCheck = await validateWorkflowSecurity(req);
  if (!securityCheck.ok) {
    return securityCheck.response;
  }

  const { body, releaseConcurrency } = securityCheck;

  try {
    const workflowId =
      typeof body.workflowId === "string"
        ? body.workflowId
        : `gt_temporal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const taskQueue = typeof body.taskQueue === "string" ? body.taskQueue : undefined;
    const tracePayload = (body.trace as Record<string, unknown>) ?? body;

    const execution = await defaultTemporalAdapter.startForensicWorkflow({
      workflowId,
      taskQueue,
      tracePayload,
    });

    return NextResponse.json({
      success: true,
      execution,
    });
  } catch (error: unknown) {
    if (error instanceof TemporalError) {
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
        error: error instanceof Error ? error.message : "Temporal operation failed",
        code: "TEMPORAL_ERROR",
      },
      { status: 500 }
    );
  } finally {
    releaseConcurrency();
  }
}
