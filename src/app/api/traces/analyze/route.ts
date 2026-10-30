import { NextRequest, NextResponse } from "next/server";
import { reconstructTimeline } from "@/lib/detector";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = reconstructTimeline(body);

    return NextResponse.json({
      success: true,
      timeline: result,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to analyze trace";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 400 }
    );
  }
}
