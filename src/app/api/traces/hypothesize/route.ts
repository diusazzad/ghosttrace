import { NextRequest, NextResponse } from "next/server";
import { reconstructTimeline } from "@/lib/detector";
import { defaultGemmaAdapter } from "@/lib/ai/gemmaAdapter";
import { generateRegressionTest } from "@/lib/testGenerator";

export async function POST(req: NextRequest) {
  try {
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
