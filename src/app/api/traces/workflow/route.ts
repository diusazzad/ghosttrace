import { NextRequest, NextResponse } from "next/server";
import { executeForensicWorkflow } from "@/lib/workflows/forensicWorkflow";

const MAX_BODY_BYTES = 1024 * 1024; // 1 MiB

export async function POST(req: NextRequest) {
  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
      return NextResponse.json(
        {
          success: false,
          code: "PAYLOAD_TOO_LARGE",
          error: "Payload too large: request body exceeds 1 MiB limit",
        },
        { status: 413 }
      );
    }

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
