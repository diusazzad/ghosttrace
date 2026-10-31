import { NextRequest, NextResponse } from "next/server";
import { defaultBrowserbaseAdapter, BrowserbaseError } from "@/lib/browser/browserbaseAdapter";
import { validateWorkflowSecurity } from "@/lib/auth/workflowSecurity";

export async function POST(req: NextRequest) {
  const securityCheck = await validateWorkflowSecurity(req);
  if (!securityCheck.ok) {
    return securityCheck.response;
  }

  const { body, releaseConcurrency } = securityCheck;

  try {
    const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
    const session = await defaultBrowserbaseAdapter.createSession({
      projectId,
      keepAlive: Boolean(body.keepAlive),
    });

    return NextResponse.json({
      success: true,
      session,
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
        error: error instanceof Error ? error.message : "Browserbase operation failed",
        code: "BROWSERBASE_ERROR",
      },
      { status: 500 }
    );
  } finally {
    releaseConcurrency();
  }
}
