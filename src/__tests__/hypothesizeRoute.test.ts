import { describe, it, expect, vi } from "vitest";
import { POST } from "../app/api/traces/hypothesize/route";
import { NextRequest } from "next/server";
import { defaultGemmaAdapter } from "@/lib/ai/gemmaAdapter";
import fixture01 from "@/fixtures/fixture_01_infinite_tool_loop.json";

describe("POST /api/traces/hypothesize Route", () => {
  vi.spyOn(defaultGemmaAdapter, "analyzeFailureTrace").mockResolvedValue({
    title: "Cyclic Tool Failure Loop",
    model: "Google Gemma 2 (Backboard)",
    explanation: "Identical queries invoked repeatedly at evt_003 and evt_004.",
    groundedEventIds: ["evt_003", "evt_004"],
    confidence: 0.98,
    validationStatus: "grounded",
    suggestedFix: "Implement max retry cutoff.",
  });

  it("returns 200 with hypothesis, timeline, and testCode for valid trace", async () => {
    const req = new NextRequest("http://localhost:3000/api/traces/hypothesize", {
      method: "POST",
      body: JSON.stringify({ trace: fixture01 }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.hypothesis).toBeDefined();
    expect(data.hypothesis.groundedEventIds).toEqual(["evt_003", "evt_004"]);
    expect(data.timeline.primaryFailureCategory).toBe("infinite_loop");
    expect(data.testCode).toContain("Infinite Loop Regression");
  });

  it("returns 400 for invalid body payload", async () => {
    const req = new NextRequest("http://localhost:3000/api/traces/hypothesize", {
      method: "POST",
      body: JSON.stringify({ bad: "data" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });
});
