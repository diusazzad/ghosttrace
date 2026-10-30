import { reconstructTimeline } from "@/lib/detector";
import { generateRegressionTest } from "@/lib/testGenerator";
import { TraceRun } from "@/types/trace";
import { ReconstructedTimeline } from "@/types/schema";

import fixture01 from "@/fixtures/fixture_01_infinite_tool_loop.json";
import fixture02 from "@/fixtures/fixture_02_tool_param_hallucination.json";
import fixture03 from "@/fixtures/fixture_03_context_overflow.json";
import fixture04 from "@/fixtures/fixture_04_unhandled_tool_crash.json";
import fixture05 from "@/fixtures/fixture_05_missing_required_tool_arg.json";
import fixture06 from "@/fixtures/fixture_06_abnormal_latency_stall.json";
import fixture07 from "@/fixtures/fixture_07_healthy_agent_run.json";
import fixture08 from "@/fixtures/fixture_08_timestamp_ordering_edge_case.json";

export function timelineToTraceRun(timeline: ReconstructedTimeline): TraceRun {
  const primaryAnomaly = timeline.anomalies[0];
  const testCode = generateRegressionTest(timeline);

  const mappedCategory = (
    ["infinite_loop", "parameter_hallucination", "context_overflow", "unhandled_tool_error"].includes(
      timeline.primaryFailureCategory
    )
      ? timeline.primaryFailureCategory
      : "unhandled_tool_error"
  ) as TraceRun["failureCategory"];

  const statusMap =
    timeline.status === "completed"
      ? "completed"
      : timeline.status === "degraded"
      ? "recovered"
      : "failed";

  return {
    id: timeline.traceId,
    agentName: timeline.agentName,
    failureCategory: mappedCategory,
    failureDescription:
      primaryAnomaly?.description ||
      (timeline.status === "completed"
        ? "Agent execution finished successfully without anomalies."
        : "Operational delay or exception detected."),
    startedAt: new Date().toISOString(),
    totalDurationMs: timeline.totalDurationMs,
    totalTokens: timeline.totalTokens,
    estimatedCostUsd: timeline.estimatedCostUsd,
    status: statusMap,
    events: timeline.events.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      startTimeMs: e.startTimeMs,
      durationMs: e.durationMs,
      status: e.status,
      input: e.input,
      output: e.output,
      tokens: e.tokens,
      error: e.error,
      isCausalAnomaly: e.isCausalAnomaly,
    })),
    hypothesis: {
      title: primaryAnomaly?.title || "Deterministic Anomaly Diagnostic",
      model: "Google Gemma 2 (Grounded)",
      explanation:
        primaryAnomaly?.description ||
        "Deterministic forensic parser verified execution timeline. No causal anomalies detected.",
      groundedEventIds: primaryAnomaly?.groundedEventIds || [],
      confidence: primaryAnomaly ? 0.98 : 1.0,
      validationStatus: "grounded",
      suggestedFix:
        primaryAnomaly?.suggestedRemediation ||
        "Pipeline functioning within acceptable parameters. No remediation required.",
    },
    generatedTestCode: testCode,
  };
}

export const ALL_RAW_FIXTURES = [
  fixture01,
  fixture02,
  fixture03,
  fixture04,
  fixture05,
  fixture06,
  fixture07,
  fixture08,
];

export const SAMPLE_TRACES: TraceRun[] = ALL_RAW_FIXTURES.map((fixture) => {
  const timeline = reconstructTimeline(fixture);
  return timelineToTraceRun(timeline);
});
