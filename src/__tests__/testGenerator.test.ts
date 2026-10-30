import { describe, it, expect } from "vitest";
import { reconstructTimeline } from "@/lib/detector";
import { generateRegressionTest } from "@/lib/testGenerator";

import fixture01 from "@/fixtures/fixture_01_infinite_tool_loop.json";
import fixture02 from "@/fixtures/fixture_02_tool_param_hallucination.json";
import fixture03 from "@/fixtures/fixture_03_context_overflow.json";
import fixture04 from "@/fixtures/fixture_04_unhandled_tool_crash.json";
import fixture06 from "@/fixtures/fixture_06_abnormal_latency_stall.json";
import fixture07 from "@/fixtures/fixture_07_healthy_agent_run.json";

describe("Deterministic Regression Test Generator", () => {
  it("generates circuit breaker regression test for infinite loops", () => {
    const timeline = reconstructTimeline(fixture01);
    const testCode = generateRegressionTest(timeline);

    expect(testCode).toContain("Infinite Loop Regression");
    expect(testCode).toContain("SupportRefundAgent");
    expect(testCode).toContain("toHaveBeenCalledTimes(2)");
  });

  it("generates parameter schema strictness test for parameter hallucinations", () => {
    const timeline = reconstructTimeline(fixture02);
    const testCode = generateRegressionTest(timeline);

    expect(testCode).toContain("Parameter Schema Strictness");
    expect(testCode).toContain("safeParse");
    expect(testCode).toContain("enforce_pydantic_v2");
  });

  it("generates context window pruning test for context overflow", () => {
    const timeline = reconstructTimeline(fixture03);
    const testCode = generateRegressionTest(timeline);

    expect(testCode).toContain("Context Overflow Guard");
    expect(testCode).toContain("8,192 token limit");
  });

  it("generates graceful recovery test for unhandled upstream crashes", () => {
    const timeline = reconstructTimeline(fixture04);
    const testCode = generateRegressionTest(timeline);

    expect(testCode).toContain("Unhandled Error Graceful Recovery");
    expect(testCode).toContain("HTTP 500");
  });

  it("generates timeout guard test for latency stalls", () => {
    const timeline = reconstructTimeline(fixture06);
    const testCode = generateRegressionTest(timeline);

    expect(testCode).toContain("Operation Timeout Guard");
    expect(testCode).toContain("5,000ms timeout threshold");
  });

  it("generates baseline happy path test for healthy traces", () => {
    const timeline = reconstructTimeline(fixture07);
    const testCode = generateRegressionTest(timeline);

    expect(testCode).toContain("Baseline Happy Path");
    expect(testCode).toContain("CustomerAssistantAgent");
  });
});
