import { NextRequest, NextResponse } from "next/server";
import { defaultBrowserbaseAdapter, BrowserbaseError } from "@/lib/browser/browserbaseAdapter";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id || id.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Session ID is required", code: "INVALID_PARAM" },
        { status: 400 }
      );
    }

    const session = await defaultBrowserbaseAdapter.getSession(id);
    const logs = await defaultBrowserbaseAdapter.getSessionLogs(id);

    return NextResponse.json({
      success: true,
      session,
      logs,
    });
  } catch (error: unknown) {
    if (error instanceof BrowserbaseError) {
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
        error: error instanceof Error ? error.message : "Failed to fetch session",
        code: "BROWSERBASE_ERROR",
      },
      { status: 500 }
    );
  }
}
