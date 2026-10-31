import { NextRequest, NextResponse } from "next/server";
import { reconstructTimeline } from "@/lib/detector";

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
