import { NextRequest, NextResponse } from "next/server";
import { defaultTigerDataAdapter, TigerDataError } from "@/lib/tiger/tigerDataAdapter";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    if (!category || category.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Category query parameter is required", code: "INVALID_PARAM" },
        { status: 400 }
      );
    }

    const patterns = await defaultTigerDataAdapter.querySimilarFailurePatterns(category);

    return NextResponse.json({
      success: true,
      patterns,
    });
  } catch (error: unknown) {
    if (error instanceof TigerDataError) {
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
        error: error instanceof Error ? error.message : "Failed to query patterns",
        code: "TIGER_DATA_ERROR",
      },
      { status: 500 }
    );
  }
}
