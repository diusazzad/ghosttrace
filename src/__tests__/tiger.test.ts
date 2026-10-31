import { describe, it, expect, vi } from "vitest";
import {
  TigerDataAdapter,
  TigerDataError,
  TigerSimilarPatternResultSchema,
} from "@/lib/tiger/tigerDataAdapter";
import { reconstructTimeline } from "@/lib/detector";
import fixture04 from "@/fixtures/fixture_04_unhandled_tool_crash.json";
import { ReconstructedTimeline } from "@/types/schema";

describe("Tiger Data Graph & Knowledge Store Integration (TASK 10)", () => {
  const sampleTimeline: ReconstructedTimeline = reconstructTimeline(fixture04);

  describe("1. Configuration & URL Detection", () => {
    it("1.1 isConfigured returns false when URL is missing or placeholder", () => {
      const adapter1 = new TigerDataAdapter({ url: "" });
      expect(adapter1.isConfigured()).toBe(false);

      const adapter2 = new TigerDataAdapter({
        url: "https://tigergraph.example.com",
      });
      expect(adapter2.isConfigured()).toBe(false);
    });

    it("1.2 isConfigured returns true when valid URL is configured", () => {
      const adapter = new TigerDataAdapter({
        url: "https://tigergraph.internal:14240",
      });
      expect(adapter.isConfigured()).toBe(true);
    });

    it("1.3 ingestTraceGraph throws CONFIG_MISSING when unconfigured", async () => {
      const adapter = new TigerDataAdapter({ url: "" });
      await expect(adapter.ingestTraceGraph(sampleTimeline)).rejects.toThrow(
        TigerDataError
      );

      try {
        await adapter.ingestTraceGraph(sampleTimeline);
      } catch (err: unknown) {
        const tigerErr = err as TigerDataError;
        expect(tigerErr.code).toBe("CONFIG_MISSING");
        expect(tigerErr.statusCode).toBe(401);
      }
    });

    it("1.4 querySimilarFailurePatterns throws CONFIG_MISSING when unconfigured", async () => {
      const adapter = new TigerDataAdapter({ url: "" });
      await expect(
        adapter.querySimilarFailurePatterns("unhandled_tool_error")
      ).rejects.toThrow(TigerDataError);
    });
  });

  describe("2. Forensic Graph Ingestion & Topology", () => {
    it("2.1 converts timeline into vertices and edges and ingests successfully", async () => {
      let sentPayload: Record<string, unknown> | null = null;
      const mockFetch: typeof fetch = vi.fn().mockImplementation((_url, init) => {
        sentPayload = JSON.parse(init.body as string);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        } as unknown as Response);
      });

      const adapter = new TigerDataAdapter({
        url: "https://tigergraph.internal:14240",
        fetchFn: mockFetch,
      });

      const result = await adapter.ingestTraceGraph(sampleTimeline);
      expect(result.success).toBe(true);
      expect(result.vertexCount).toBeGreaterThanOrEqual(3);
      expect(result.edgeCount).toBeGreaterThanOrEqual(2);

      expect(sentPayload).not.toBeNull();
      const vertices = sentPayload!.vertices as Array<{ type: string; id: string }>;
      const types = vertices.map((v) => v.type);
      expect(types).toContain("Agent");
      expect(types).toContain("Trace");
      expect(types).toContain("FailureCategory");
    });
  });

  describe("3. Pattern Query & Knowledge Retrieval", () => {
    it("3.1 queries similar failure patterns and validates against schema", async () => {
      const mockPattern = {
        category: "unhandled_tool_error",
        matchingTraceIds: ["tr_101", "tr_102"],
        commonToolFailures: ["call_stripe_settlement"],
        recommendedRemediations: ["Wrap HTTP tool calls in try/catch with fallback"],
        frequency: 14,
      };

      const mockFetch: typeof fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockPattern),
      } as unknown as Response);

      const adapter = new TigerDataAdapter({
        url: "https://tigergraph.internal:14240",
        fetchFn: mockFetch,
      });

      const patterns = await adapter.querySimilarFailurePatterns(
        "unhandled_tool_error"
      );

      expect(patterns.category).toBe("unhandled_tool_error");
      expect(patterns.matchingTraceIds).toContain("tr_101");
      expect(patterns.frequency).toBe(14);
      expect(
        TigerSimilarPatternResultSchema.safeParse(patterns).success
      ).toBe(true);
    });
  });

  describe("4. Error Handling & Upstream Failures", () => {
    it("4.1 handles 401 upstream with AUTHENTICATION_FAILED", async () => {
      const mockFetch: typeof fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      } as unknown as Response);

      const adapter = new TigerDataAdapter({
        url: "https://tigergraph.internal:14240",
        apiKey: "bad_token",
        fetchFn: mockFetch,
      });

      await expect(adapter.ingestTraceGraph(sampleTimeline)).rejects.toThrow(
        TigerDataError
      );

      try {
        await adapter.ingestTraceGraph(sampleTimeline);
      } catch (err: unknown) {
        const tigerErr = err as TigerDataError;
        expect(tigerErr.code).toBe("AUTHENTICATION_FAILED");
        expect(tigerErr.statusCode).toBe(401);
      }
    });

    it("4.2 handles 503 upstream with UPSTREAM_REQUEST_FAILED and isRetryable: true", async () => {
      const mockFetch: typeof fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ error: "Graph Engine Busy" }),
      } as unknown as Response);

      const adapter = new TigerDataAdapter({
        url: "https://tigergraph.internal:14240",
        fetchFn: mockFetch,
      });

      try {
        await adapter.ingestTraceGraph(sampleTimeline);
      } catch (err: unknown) {
        const tigerErr = err as TigerDataError;
        expect(tigerErr.code).toBe("UPSTREAM_REQUEST_FAILED");
        expect(tigerErr.statusCode).toBe(503);
        expect(tigerErr.isRetryable).toBe(true);
      }
    });
  });
});
