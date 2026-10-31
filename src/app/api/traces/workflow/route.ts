import { NextRequest, NextResponse } from "next/server";
import { executeForensicWorkflow } from "@/lib/workflows/forensicWorkflow";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawTrace = body.trace ?? body;

    const result = await executeForensicWorkflow(rawTrace);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Mastra workflow execution failed";
    return NextResponse.json(
      {
        success: false,
        error: msg,
      },
      { status: 400 }
    );
  }
}
