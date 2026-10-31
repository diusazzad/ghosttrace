import { NextRequest, NextResponse } from "next/server";
import { executeForensicWorkflow } from "@/lib/workflows/forensicWorkflow";
import { reconstructTimeline } from "@/lib/detector";
import { defaultUltramarineAdapter } from "@/lib/ai/ultramarineAdapter";
import { validateWorkflowSecurity } from "@/lib/auth/workflowSecurity";

export async function POST(req: NextRequest) {
  const securityCheck = await validateWorkflowSecurity(req);
  if (!securityCheck.ok) {
    return securityCheck.response;
  }

  const { body, ownerId, releaseConcurrency } = securityCheck;

  try {
    const rawTrace = body.trace ?? body;
    const provider = body.provider ?? "gemma";

    // Support direct Ultramarine live investigation within workflow route
    if (provider === "ultramarine" || provider === "paperinstruments") {
      const timeline = reconstructTimeline(rawTrace);
      const ultramarineResult =
        await defaultUltramarineAdapter.analyzeFailureTrace(timeline);

      return NextResponse.json({
        success: true,
        provider: "paperinstruments",
        model: "ultramarine-1-flash",
        ownerId,
        timeline,
        ultramarine: ultramarineResult,
        hypothesis: {
          title: ultramarineResult.investigation.summary,
          model: `Paper Instruments (ultramarine-1-flash)`,
          provider: "paperinstruments",
          executionMode: "live_inference",
          latencyMs: ultramarineResult.latencyMs,
          explanation: ultramarineResult.investigation.rootCause,
          groundedEventIds: ultramarineResult.evidenceValidation.validEventIds,
          confidence: ultramarineResult.evidenceValidation.causalClaimUnverified
            ? 0.7
            : 0.95,
          validationStatus: ultramarineResult.evidenceValidation.eventReferenceValid
            ? "grounded"
            : "hallucination_flagged",
          suggestedFix: ultramarineResult.investigation.remediation,
          uncertaintyWarnings:
            ultramarineResult.investigation.uncertaintyWarnings,
          evidenceValidation: ultramarineResult.evidenceValidation,
          cost: ultramarineResult.cost,
          tokenUsage: ultramarineResult.tokenUsage,
        },
      });
    }

    // Default: Mastra multi-step workflow with Google Gemma 2
    const result = await executeForensicWorkflow(rawTrace);

    return NextResponse.json({
      success: true,
      ownerId,
      ...result,
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Workflow execution failed";
    const errorRecord = error as {
      statusCode?: number;
      status?: number;
      code?: string;
    };
    const status = errorRecord?.statusCode || errorRecord?.status || 400;

    return NextResponse.json(
      {
        success: false,
        error: msg,
        code: errorRecord?.code || "WORKFLOW_EXECUTION_FAILED",
      },
      { status }
    );
  } finally {
    releaseConcurrency();
  }
}
