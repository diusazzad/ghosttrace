import { NextRequest, NextResponse } from "next/server";
import { defaultTemporalAdapter, TemporalError } from "@/lib/temporal/temporalAdapter";
import { validateWorkflowSecurity } from "@/lib/auth/workflowSecurity";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const securityCheck = await validateWorkflowSecurity(req);
  if (!securityCheck.ok) {
    return securityCheck.response;
  }

  const { body, releaseConcurrency } = securityCheck;

  try {
    const { id } = await context.params;
    if (!id || id.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Workflow ID is required", code: "INVALID_PARAM" },
        { status: 400 }
      );
    }

    const signalName = typeof body.signalName === "string" ? body.signalName : "HumanReviewSignal";
    const signalData = (body.signalData as Record<string, unknown>) ?? body;

    const result = await defaultTemporalAdapter.sendSignal(id, signalName, signalData);

    return NextResponse.json({
      success: true,
      result,
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
        error: error instanceof Error ? error.message : "Failed to send signal",
        code: "TEMPORAL_ERROR",
      },
      { status: 500 }
    );
  } finally {
    releaseConcurrency();
  }
}
