import { describe, it, expect } from "vitest";
import { reconstructTimeline, parseAndValidateTrace } from "@/lib/detector";

import fixture01 from "@/fixtures/fixture_01_infinite_tool_loop.json";
import fixture02 from "@/fixtures/fixture_02_tool_param_hallucination.json";
import fixture03 from "@/fixtures/fixture_03_context_overflow.json";
import fixture04 from "@/fixtures/fixture_04_unhandled_tool_crash.json";
import fixture05 from "@/fixtures/fixture_05_missing_required_tool_arg.json";
import fixture06 from "@/fixtures/fixture_06_abnormal_latency_stall.json";
import fixture07 from "@/fixtures/fixture_07_healthy_agent_run.json";
import fixture08 from "@/fixtures/fixture_08_timestamp_ordering_edge_case.json";

describe("Deterministic Trace Ingestion & Schema Validation", () => {
  it("rejects invalid or empty trace schemas", () => {
    expect(() => parseAndValidateTrace({})).toThrow(/Invalid trace format/);
    expect(() => parseAndValidateTrace({ id: "t1", events: [] })).toThrow(/Invalid trace format/);
    expect(() =>
      parseAndValidateTrace({
        id: "t2",
        events: [{ id: "e1", name: "bad_type", type: "unsupported_type" }],
      })
    ).toThrow(/Invalid trace format/);
  });

  it("successfully parses valid raw traces", () => {
    const parsed = parseAndValidateTrace(fixture01);
    expect(parsed.id).toBe("trace-loop-001");
    expect(parsed.events.length).toBe(6);
  });
});

describe("Deterministic Timeline Normalization & Reconstruction", () => {
  it("correctly sorts out-of-order timestamps and normalizes offsets (Fixture 08)", () => {
    const timeline = reconstructTimeline(fixture08);

    expect(timeline.events.length).toBe(3);
    // Chronologically sorted: evt_701 (00.100s) -> evt_702 (01.000s) -> evt_703 (04.500s)
    expect(timeline.events[0].id).toBe("evt_701");
    expect(timeline.events[1].id).toBe("evt_702");
    expect(timeline.events[2].id).toBe("evt_703");

    // Relative offsets
    expect(timeline.events[0].startTimeMs).toBe(100);
    expect(timeline.events[1].startTimeMs).toBe(1000);
    expect(timeline.events[2].startTimeMs).toBe(4500);

    expect(timeline.status).toBe("completed");
    expect(timeline.primaryFailureCategory).toBe("none");
  });

  it("calculates accurate token consumption and cost estimation", () => {
    const timeline = reconstructTimeline(fixture01);
    expect(timeline.totalTokens).toBe(420);
    expect(timeline.estimatedCostUsd).toBeGreaterThan(0);
  });
});

describe("Deterministic Forensic Anomaly Detectors", () => {
  it("detects infinite tool loops with grounded causal event IDs (Fixture 01)", () => {
    const timeline = reconstructTimeline(fixture01);

    expect(timeline.status).toBe("failed");
    expect(timeline.primaryFailureCategory).toBe("infinite_loop");

    const loopAnomaly = timeline.anomalies.find((a) => a.category === "infinite_loop");
    expect(loopAnomaly).toBeDefined();
    expect(loopAnomaly?.severity).toBe("critical");
    expect(loopAnomaly?.groundedEventIds).toEqual(
      expect.arrayContaining(["evt_003", "evt_004", "evt_005", "evt_006"])
    );

    // Verify causal flags on events
    const evt3 = timeline.events.find((e) => e.id === "evt_003");
    expect(evt3?.isCausalAnomaly).toBe(true);
  });

  it("detects parameter schema hallucinations (Fixture 02)", () => {
    const timeline = reconstructTimeline(fixture02);

    expect(timeline.status).toBe("failed");
    expect(timeline.primaryFailureCategory).toBe("parameter_hallucination");

    const hallucAnomaly = timeline.anomalies.find((a) => a.category === "parameter_hallucination");
    expect(hallucAnomaly).toBeDefined();
    expect(hallucAnomaly?.severity).toBe("high");
    expect(hallucAnomaly?.groundedEventIds).toContain("evt_102"); // Causative LLM call
    expect(hallucAnomaly?.groundedEventIds).toContain("evt_103"); // Faulty tool call
  });

  it("detects missing required parameters as schema violation (Fixture 05)", () => {
    const timeline = reconstructTimeline(fixture05);

    expect(timeline.status).toBe("failed");
    expect(timeline.primaryFailureCategory).toBe("parameter_hallucination");

    const anomaly = timeline.anomalies.find((a) => a.category === "parameter_hallucination");
    expect(anomaly?.description).toMatch(/recipient_email/);
  });

  it("detects context window overflow (Fixture 03)", () => {
    const timeline = reconstructTimeline(fixture03);

    expect(timeline.status).toBe("failed");
    expect(timeline.primaryFailureCategory).toBe("context_overflow");

    const anomaly = timeline.anomalies.find((a) => a.category === "context_overflow");
    expect(anomaly).toBeDefined();
    expect(anomaly?.groundedEventIds).toContain("evt_202");
  });

  it("detects unhandled upstream API crash (Fixture 04)", () => {
    const timeline = reconstructTimeline(fixture04);

    expect(timeline.status).toBe("failed");
    expect(timeline.primaryFailureCategory).toBe("unhandled_tool_error");

    const anomaly = timeline.anomalies.find((a) => a.category === "unhandled_tool_error");
    expect(anomaly).toBeDefined();
    expect(anomaly?.groundedEventIds).toContain("evt_302");
  });

  it("detects abnormal latency stalls (Fixture 06)", () => {
    const timeline = reconstructTimeline(fixture06);

    expect(timeline.status).toBe("degraded");
    expect(timeline.primaryFailureCategory).toBe("latency_stall");

    const anomaly = timeline.anomalies.find((a) => a.category === "latency_stall");
    expect(anomaly).toBeDefined();
    expect(anomaly?.groundedEventIds).toContain("evt_502");
    expect(anomaly?.description).toMatch(/28500ms/);
  });

  it("produces zero false positives on healthy agent runs (Fixture 07)", () => {
    const timeline = reconstructTimeline(fixture07);

    expect(timeline.status).toBe("completed");
    expect(timeline.primaryFailureCategory).toBe("none");
    expect(timeline.anomalies.length).toBe(0);
    expect(timeline.events.every((e) => !e.isCausalAnomaly)).toBe(true);
  });
});
