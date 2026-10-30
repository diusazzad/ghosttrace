import { Mastra } from "@mastra/core";
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { reconstructTimeline } from "@/lib/detector";
import { defaultGemmaAdapter, GemmaHypothesis } from "@/lib/ai/gemmaAdapter";
import { generateRegressionTest } from "@/lib/testGenerator";
import { ReconstructedTimeline } from "@/types/schema";

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
    const timeline = reconstructTimeline(inputData.rawTrace);
    return { timeline };
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

    return {
      timeline,
      anomalies: timeline.anomalies,
      primaryFailureCategory: timeline.primaryFailureCategory,
    };
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

    const hypothesis: GemmaHypothesis =
      await defaultGemmaAdapter.analyzeFailureTrace(timeline);

    return {
      timeline,
      hypothesis,
    };
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
    const testCode = generateRegressionTest(timeline);

    return {
      timeline,
      hypothesis,
      testCode,
      status: timeline.status,
      completedAt: new Date().toISOString(),
    };
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
 */
export async function executeForensicWorkflow(
  rawTrace: unknown
): Promise<ForensicWorkflowResult> {
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
}
