import { describe, it, expect, vi } from "vitest";
import { GemmaAdapter } from "@/lib/ai/gemmaAdapter";
import { reconstructTimeline } from "@/lib/detector";
import fixture01 from "@/fixtures/fixture_01_infinite_tool_loop.json";

describe("GemmaAdapter - Grounding & Hallucination Defense", () => {
  const timeline = reconstructTimeline(fixture01);
  const validEventIds = new Set(timeline.events.map((e) => e.id));

  it("accepts valid event IDs and marks validationStatus as grounded", () => {
    const adapter = new GemmaAdapter();
    const candidate = {
      title: "Repetitive Tool Loop",
      explanation: "Looping at evt_003 and evt_004",
      groundedEventIds: ["evt_003", "evt_004"],
      confidence: 0.95,
      suggestedFix: "Add loop cutoff",
    };

    const grounded = adapter.validateAndGroundHypothesis(
      candidate,
      validEventIds,
      "Google Gemma 2",
      timeline
    );

    expect(grounded.validationStatus).toBe("grounded");
    expect(grounded.groundedEventIds).toEqual(["evt_003", "evt_004"]);
  });

  it("filters out hallucinated event IDs and marks as unverified if partial", () => {
    const adapter = new GemmaAdapter();
    const candidate = {
      title: "Hallucinated Diagnosis",
      explanation: "Something went wrong at evt_999 and evt_003",
      groundedEventIds: ["evt_999", "evt_003"], // evt_999 DOES NOT EXIST!
      confidence: 0.8,
    };

    const grounded = adapter.validateAndGroundHypothesis(
      candidate,
      validEventIds,
      "Google Gemma 2",
      timeline
    );

    expect(grounded.validationStatus).toBe("unverified");
    expect(grounded.groundedEventIds).toContain("evt_003");
    expect(grounded.groundedEventIds).not.toContain("evt_999");
  });

  it("flags hallucination when all cited event IDs are fabricated", () => {
    const adapter = new GemmaAdapter();
    const candidate = {
      title: "Completely Fabricated",
      explanation: "Error at fake_span_1 and fake_span_2",
      groundedEventIds: ["fake_span_1", "fake_span_2"],
      confidence: 0.8,
    };

    const grounded = adapter.validateAndGroundHypothesis(
      candidate,
      validEventIds,
      "Google Gemma 2",
      timeline
    );

    expect(grounded.validationStatus).toBe("hallucination_flagged");
    // Falls back to deterministic causal IDs
    expect(grounded.groundedEventIds.length).toBeGreaterThan(0);
    expect(grounded.groundedEventIds).toContain("evt_003");
  });

  it("falls back to deterministic diagnosis when remote Backboard API fails", async () => {
    const mockFailingFetch = vi.fn().mockRejectedValue(new Error("Network connection refused"));

    const adapter = new GemmaAdapter({
      backboardApiKey: "test_key",
      ollamaHost: "http://invalid-host:9999",
      fetchFn: mockFailingFetch as unknown as typeof fetch,
    });

    const result = await adapter.analyzeFailureTrace(timeline);
    expect(result.model).toContain("Deterministic Grounding");
    expect(result.groundedEventIds.length).toBeGreaterThan(0);
    expect(result.validationStatus).toBe("grounded");
  });

  it("parses valid JSON response from Backboard when successful", async () => {
    const mockBackboardResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Cyclic Tool Failure Loop",
              explanation: "Identical queries invoked at evt_003, evt_004, and evt_005.",
              groundedEventIds: ["evt_003", "evt_004", "evt_005"],
              confidence: 0.97,
              suggestedFix: "Implement max retry limit of 2 before halting.",
            }),
          },
        },
      ],
    };

    const mockSuccessFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockBackboardResponse,
    });

    const adapter = new GemmaAdapter({
      backboardApiKey: "valid_key",
      fetchFn: mockSuccessFetch as unknown as typeof fetch,
    });

    const result = await adapter.analyzeFailureTrace(timeline);
    expect(result.title).toBe("Cyclic Tool Failure Loop");
    expect(result.groundedEventIds).toEqual(["evt_003", "evt_004", "evt_005"]);
    expect(result.validationStatus).toBe("grounded");
    expect(result.confidence).toBe(0.97);
  });
});
