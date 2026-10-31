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

export interface MastraStepExecutionRecord {
  stepId: string;
  name: string;
  status: "success" | "failed" | "running";
  durationMs: number;
  inputSummary: string;
  outputSummary: string;
  error?: string;
}

export interface ForensicWorkflowResult {
  timeline: ReconstructedTimeline;
  hypothesis: GemmaHypothesis;
  testCode: string;
  status: "failed" | "completed" | "degraded";
  completedAt: string;
  steps: MastraStepExecutionRecord[];
  workflowEngine: string;
}

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
    step1DurationMs: z.number(),
  }),
  execute: async ({ inputData }) => {
    const traceId =
      (inputData.rawTrace as { traceId?: string })?.traceId ||
      (inputData.rawTrace as { id?: string })?.id ||
      "unknown_trace";

    const t0 = Date.now();
    return startAgentStepSpan(
      {
        stepName: "step1_ingestAndNormalize",
        op: "gen_ai.data_processing",
        traceId,
      },
      async () => {
        const timeline = reconstructTimeline(inputData.rawTrace);
        const durationMs = Math.max(1, Date.now() - t0);

        recordAgentBreadcrumb(
          "ingestion",
          `Normalized ${timeline.events.length} events for trace ${traceId}`,
          {
            traceId,
            totalEvents: timeline.events.length,
            durationMs: timeline.totalDurationMs,
          }
        );
        return { timeline, step1DurationMs: durationMs };
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
    step1DurationMs: z.number().optional(),
  }),
  outputSchema: z.object({
    timeline: z.custom<ReconstructedTimeline>(),
    anomalies: z.array(z.any()),
    primaryFailureCategory: z.string(),
    step1DurationMs: z.number(),
    step2DurationMs: z.number(),
  }),
  execute: async ({ inputData, getStepResult }) => {
    const t0 = Date.now();
    const prev = ((await getStepResult("step1_ingestAndNormalize")) ||
      inputData) as { timeline: ReconstructedTimeline; step1DurationMs?: number };
    const timeline = prev.timeline;
    const step1DurationMs = prev.step1DurationMs ?? 2;

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
        const durationMs = Math.max(1, Date.now() - t0);

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
          step1DurationMs,
          step2DurationMs: durationMs,
        };
      }
    );
  },
});

/**
 * Step 3: Formulate Evidence-Grounded Hypothesis with Google Gemma 2 / Deterministic Rules
 */
const step3_hypothesizeRootCause = createStep({
  id: "step3_hypothesizeRootCause",
  inputSchema: z.object({
    timeline: z.custom<ReconstructedTimeline>(),
    anomalies: z.array(z.any()).optional(),
    primaryFailureCategory: z.string().optional(),
    step1DurationMs: z.number().optional(),
    step2DurationMs: z.number().optional(),
  }),
  outputSchema: z.object({
    timeline: z.custom<ReconstructedTimeline>(),
    hypothesis: z.custom<GemmaHypothesis>(),
    step1DurationMs: z.number(),
    step2DurationMs: z.number(),
    step3DurationMs: z.number(),
  }),
  execute: async ({ inputData, getStepResult }) => {
    const t0 = Date.now();
    const prev = ((await getStepResult("step2_detectAnomalies")) ||
      inputData) as {
      timeline: ReconstructedTimeline;
      step1DurationMs?: number;
      step2DurationMs?: number;
    };
    const timeline = prev.timeline;
    const step1DurationMs = prev.step1DurationMs ?? 2;
    const step2DurationMs = prev.step2DurationMs ?? 2;

    return startAgentStepSpan(
      {
        stepName: "step3_hypothesizeRootCause",
        op: "gen_ai.chat",
        traceId: timeline.traceId,
      },
      async () => {
        const hypothesis: GemmaHypothesis =
          await defaultGemmaAdapter.analyzeFailureTrace(timeline);
        const durationMs = Math.max(1, Date.now() - t0);

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
          step1DurationMs,
          step2DurationMs,
          step3DurationMs: durationMs,
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
    step1DurationMs: z.number().optional(),
    step2DurationMs: z.number().optional(),
    step3DurationMs: z.number().optional(),
  }),
  outputSchema: z.object({
    timeline: z.custom<ReconstructedTimeline>(),
    hypothesis: z.custom<GemmaHypothesis>(),
    testCode: z.string(),
    status: z.enum(["failed", "completed", "degraded"]),
    completedAt: z.string(),
    steps: z.array(z.any()),
    workflowEngine: z.string(),
  }),
  execute: async ({ inputData, getStepResult }) => {
    const t0 = Date.now();
    const prev = ((await getStepResult("step3_hypothesizeRootCause")) ||
      inputData) as {
      timeline: ReconstructedTimeline;
      hypothesis: GemmaHypothesis;
      step1DurationMs?: number;
      step2DurationMs?: number;
      step3DurationMs?: number;
    };

    const timeline = prev.timeline;
    const hypothesis = prev.hypothesis;
    const step1DurationMs = prev.step1DurationMs ?? 2;
    const step2DurationMs = prev.step2DurationMs ?? 2;
    const step3DurationMs = prev.step3DurationMs ?? 15;

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
        const durationMs = Math.max(1, Date.now() - t0);

        recordAgentBreadcrumb(
          "synthesis",
          `Synthesized regression test for ${timeline.traceId}`,
          {
            traceId: timeline.traceId,
            lines: testCode.split("\n").length,
          }
        );

        const steps: MastraStepExecutionRecord[] = [
          {
            stepId: "step1_ingestAndNormalize",
            name: "1. Ingest & Normalize Timeline",
            status: "success",
            durationMs: step1DurationMs,
            inputSummary: `Raw input trace: #${timeline.traceId} (${timeline.events.length} events)`,
            outputSummary: `Normalized chronological timeline spanning ${timeline.totalDurationMs}ms`,
          },
          {
            stepId: "step2_detectAnomalies",
            name: "2. Deterministic Anomaly Detection",
            status: "success",
            durationMs: step2DurationMs,
            inputSummary: `Scanned ${timeline.events.length} events against 5 heuristic failure patterns`,
            outputSummary: `Found ${timeline.anomalies.length} anomaly finding(s). Category: '${timeline.primaryFailureCategory}'`,
          },
          {
            stepId: "step3_hypothesizeRootCause",
            name: "3. Root Cause Investigation & Grounding",
            status: "success",
            durationMs: step3DurationMs,
            inputSummary: `Evaluated causal events via ${hypothesis.provider} (${hypothesis.model})`,
            outputSummary: `Formulated diagnosis: '${hypothesis.title}' (${hypothesis.groundedEventIds.length} citations)`,
          },
          {
            stepId: "step4_verifyAndSynthesize",
            name: "4. Grounding Verification & Test Synthesis",
            status: "success",
            durationMs,
            inputSummary: `Cross-checked event references and synthesized Vitest regression blueprint`,
            outputSummary: `Generated regression test blueprint (${testCode.split("\n").length} lines of code)`,
          },
        ];

        return {
          timeline,
          hypothesis,
          testCode,
          status: timeline.status,
          completedAt: new Date().toISOString(),
          steps,
          workflowEngine: "Mastra v1.80.0",
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
    steps: z.array(z.any()),
    workflowEngine: z.string(),
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

/**
 * High-level runner that executes the Mastra pipeline for a trace.
 * Instrumented with Sentry distributed transaction & OpenTelemetry GenAI spans.
 */
export async function executeForensicWorkflow(
  rawTrace: unknown
): Promise<ForensicWorkflowResult> {
  const traceId =
    (rawTrace as { traceId?: string })?.traceId ||
    (rawTrace as { id?: string })?.id ||
    "unknown_trace";

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
