import { describe, it, expect } from "vitest";
import { POST } from "../app/api/traces/analyze/route";
import { NextRequest } from "next/server";
import fixture01 from "@/fixtures/fixture_01_infinite_tool_loop.json";

describe("POST /api/traces/analyze Route", () => {
  it("returns 200 and reconstructed timeline for valid trace", async () => {
    const req = new NextRequest("http://localhost:3000/api/traces/analyze", {
      method: "POST",
      body: JSON.stringify(fixture01),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.timeline.primaryFailureCategory).toBe("infinite_loop");
    expect(data.timeline.events.length).toBe(6);
  });

  it("returns 400 for malformed payload", async () => {
    const req = new NextRequest("http://localhost:3000/api/traces/analyze", {
      method: "POST",
      body: JSON.stringify({ invalid: true }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/Invalid trace format/);
  });
});
