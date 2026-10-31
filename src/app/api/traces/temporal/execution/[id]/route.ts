import { NextRequest, NextResponse } from "next/server";
import { defaultTemporalAdapter, TemporalError } from "@/lib/temporal/temporalAdapter";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id || id.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Workflow ID is required", code: "INVALID_PARAM" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("runId") ?? undefined;

    const execution = await defaultTemporalAdapter.getWorkflowExecution(id, runId);

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
        error: error instanceof Error ? error.message : "Failed to fetch workflow execution",
        code: "TEMPORAL_ERROR",
      },
      { status: 500 }
    );
  }
}
