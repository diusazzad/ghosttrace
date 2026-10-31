import { NextRequest, NextResponse } from "next/server";
import { reconstructTimeline } from "@/lib/detector";
import { defaultGemmaAdapter } from "@/lib/ai/gemmaAdapter";
import { generateRegressionTest } from "@/lib/testGenerator";

export const dynamic = "force-dynamic";

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

    const timeline = reconstructTimeline(rawTrace);
    const hypothesis = await defaultGemmaAdapter.analyzeFailureTrace(timeline);
    const testCode = generateRegressionTest(timeline);

    return NextResponse.json({
      success: true,
      hypothesis,
      timeline,
      testCode,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to hypothesize root cause";
    return NextResponse.json(
      {
        success: false,
        error: msg,
      },
      { status: 400 }
    );
  }
}
