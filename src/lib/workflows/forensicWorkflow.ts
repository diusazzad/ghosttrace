import { Mastra } from "@mastra/core";
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { reconstructTimeline } from "@/lib/detector";
import { defaultGemmaAdapter, GemmaHypothesis } from "@/lib/ai/gemmaAdapter";
import { generateRegressionTest } from "@/lib/testGenerator";
import { ReconstructedTimeline } from "@/types/schema";
import {
  startAgentWorkflowSpan,
  startAgentStepSpan,
  recordAgentBreadcrumb,
} from "@/lib/telemetry/sentryTracer";

/**
 * Step 1: Ingest & Normalize Execution Timeline
 */
const step1_ingestAndNormalize = createStep({
  id: "step1_ingestAndNormalize",
  inputSchema: z.object({
    rawTrace: z.unknown(),
  }),
  outputSchema: z.object({
    timeline: z.custom<ReconstructedTimeline>(),
  }),
  execute: async ({ inputData }) => {
    const traceId =
      (inputData.rawTrace as { traceId?: string })?.traceId || "unknown_trace";

    return startAgentStepSpan(
      {
        stepName: "step1_ingestAndNormalize",
        op: "gen_ai.data_processing",
        traceId,
      },
      async () => {
        const timeline = reconstructTimeline(inputData.rawTrace);
        recordAgentBreadcrumb(
          "ingestion",
          `Normalized ${timeline.events.length} events for trace ${traceId}`,
          {
            traceId,
            totalEvents: timeline.events.length,
            durationMs: timeline.totalDurationMs,
          }
        );
        return { timeline };
      }
    );
  },
});

/**
 * Step 2: Detect Structural Anomalies & Failure Modes (Deterministic)
 */
const step2_detectAnomalies = createStep({
  id: "step2_detectAnomalies",
  inputSchema: z.object({
    timeline: z.custom<ReconstructedTimeline>(),
  }),
  outputSchema: z.object({
    timeline: z.custom<ReconstructedTimeline>(),
    anomalies: z.array(z.any()),
    primaryFailureCategory: z.string(),
  }),
  execute: async ({ inputData, getStepResult }) => {
    const prev = ((await getStepResult("step1_ingestAndNormalize")) ||
      inputData) as { timeline: ReconstructedTimeline };
    const timeline = prev.timeline;

    return startAgentStepSpan(
      {
        stepName: "step2_detectAnomalies",
        op: "gen_ai.analysis",
        traceId: timeline.traceId,
        attributes: {
          "ghosttrace.anomalies_count": timeline.anomalies.length,
          "ghosttrace.primary_category": timeline.primaryFailureCategory,
        },
      },
      async () => {
        recordAgentBreadcrumb(
          "anomaly",
          `Detected ${timeline.anomalies.length} anomalies, primary: ${timeline.primaryFailureCategory}`,
          {
            traceId: timeline.traceId,
            primaryFailureCategory: timeline.primaryFailureCategory,
            anomaliesCount: timeline.anomalies.length,
          }
        );

        return {
          timeline,
          anomalies: timeline.anomalies,
          primaryFailureCategory: timeline.primaryFailureCategory,
        };
      }
    );
  },
});

/**
 * Step 3: Formulate Evidence-Grounded Hypothesis with Google Gemma 2
 */
const step3_hypothesizeRootCause = createStep({
  id: "step3_hypothesizeRootCause",
  inputSchema: z.object({
    timeline: z.custom<ReconstructedTimeline>(),
    anomalies: z.array(z.any()).optional(),
    primaryFailureCategory: z.string().optional(),
  }),
  outputSchema: z.object({
    timeline: z.custom<ReconstructedTimeline>(),
    hypothesis: z.custom<GemmaHypothesis>(),
  }),
  execute: async ({ inputData, getStepResult }) => {
    const prev = ((await getStepResult("step2_detectAnomalies")) ||
      inputData) as { timeline: ReconstructedTimeline };
    const timeline = prev.timeline;

    return startAgentStepSpan(
      {
        stepName: "step3_hypothesizeRootCause",
        op: "gen_ai.chat",
        traceId: timeline.traceId,
      },
      async () => {
        const hypothesis: GemmaHypothesis =
          await defaultGemmaAdapter.analyzeFailureTrace(timeline);
        recordAgentBreadcrumb(
          "inference",
          `Gemma hypothesis formulated: ${hypothesis.title}`,
          {
            traceId: timeline.traceId,
            model: hypothesis.model,
            groundedEventsCount: hypothesis.groundedEventIds.length,
            status: hypothesis.validationStatus,
          }
        );
        return {
          timeline,
          hypothesis,
        };
      }
    );
  },
});

/**
 * Step 4: Verify Grounding & Synthesize Reproducible Vitest Test Suite
 */
const step4_verifyAndSynthesize = createStep({
  id: "step4_verifyAndSynthesize",
  inputSchema: z.object({
    timeline: z.custom<ReconstructedTimeline>(),
    hypothesis: z.custom<GemmaHypothesis>(),
  }),
  outputSchema: z.object({
    timeline: z.custom<ReconstructedTimeline>(),
    hypothesis: z.custom<GemmaHypothesis>(),
    testCode: z.string(),
    status: z.enum(["failed", "completed", "degraded"]),
    completedAt: z.string(),
  }),
  execute: async ({ inputData, getStepResult }) => {
    const prev = ((await getStepResult("step3_hypothesizeRootCause")) ||
      inputData) as {
      timeline: ReconstructedTimeline;
      hypothesis: GemmaHypothesis;
    };

    const timeline = prev.timeline;
    const hypothesis = prev.hypothesis;

    return startAgentStepSpan(
      {
        stepName: "step4_verifyAndSynthesize",
        op: "gen_ai.code_generation",
        traceId: timeline.traceId,
        attributes: {
          "ghosttrace.grounded_events_count": hypothesis.groundedEventIds.length,
          "ghosttrace.validation_status": hypothesis.validationStatus,
        },
      },
      async () => {
        const testCode = generateRegressionTest(timeline);
        recordAgentBreadcrumb(
          "synthesis",
          `Synthesized regression test for ${timeline.traceId}`,
          {
            traceId: timeline.traceId,
            lines: testCode.split("\n").length,
          }
        );

        return {
          timeline,
          hypothesis,
          testCode,
          status: timeline.status,
          completedAt: new Date().toISOString(),
        };
      }
    );
  },
});

/**
 * Mastra Multi-Step Forensic Investigation Workflow
 */
export const forensicInvestigationWorkflow = createWorkflow({
  id: "forensic-investigator",
  inputSchema: z.object({
    rawTrace: z.unknown(),
  }),
  outputSchema: z.object({
    timeline: z.custom<ReconstructedTimeline>(),
    hypothesis: z.custom<GemmaHypothesis>(),
    testCode: z.string(),
    status: z.enum(["failed", "completed", "degraded"]),
    completedAt: z.string(),
  }),
})
  .then(step1_ingestAndNormalize)
  .then(step2_detectAnomalies)
  .then(step3_hypothesizeRootCause)
  .then(step4_verifyAndSynthesize)
  .commit();

export const mastraForensicEngine = new Mastra({
  workflows: {
    "forensic-investigator": forensicInvestigationWorkflow,
  },
});

export interface ForensicWorkflowResult {
  timeline: ReconstructedTimeline;
  hypothesis: GemmaHypothesis;
  testCode: string;
  status: "failed" | "completed" | "degraded";
  completedAt: string;
}

/**
 * High-level runner that executes the Mastra pipeline for a trace.
 * Instrumented with Sentry distributed transaction & OpenTelemetry GenAI spans.
 */
export async function executeForensicWorkflow(
  rawTrace: unknown
): Promise<ForensicWorkflowResult> {
  const traceId =
    (rawTrace as { traceId?: string })?.traceId || "unknown_trace";

  return startAgentWorkflowSpan(traceId, async () => {
    const workflow = mastraForensicEngine.getWorkflow("forensic-investigator");
    if (!workflow) {
      throw new Error("Mastra workflow 'forensic-investigator' not registered");
    }

    const run = await workflow.createRun();
    const res = await run.start({ inputData: { rawTrace } });

    if (res.status === "success") {
      const step4 = res.steps?.step4_verifyAndSynthesize;
      if (step4 && step4.status === "success") {
        return step4.output as ForensicWorkflowResult;
      }
    }

    const errorMsg =
      res.status === "failed" && res.error
        ? (res.error as Error).message
        : `Workflow terminated with status: ${res.status}`;
    throw new Error(`Mastra Forensic Workflow error: ${errorMsg}`);
  });
}
