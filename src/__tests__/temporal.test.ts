import { describe, it, expect, vi } from "vitest";
import {
  TemporalAdapter,
  TemporalError,
  TemporalWorkflowExecutionSchema,
} from "@/lib/temporal/temporalAdapter";

describe("Temporal Durable Forensic Workflow Integration (TASK 09)", () => {
  describe("1. Configuration & Address Detection", () => {
    it("1.1 isConfigured returns false when address is missing or invalid", () => {
      const adapter1 = new TemporalAdapter({ address: "" });
      expect(adapter1.isConfigured()).toBe(false);

      const adapter2 = new TemporalAdapter({ address: "localhost:7233_unconfigured" });
      expect(adapter2.isConfigured()).toBe(false);
    });

    it("1.2 isConfigured returns true when address is configured", () => {
      const adapter = new TemporalAdapter({
        address: "temporal.internal:7233",
        namespace: "ghosttrace-prod",
      });
      expect(adapter.isConfigured()).toBe(true);
    });

    it("1.3 startForensicWorkflow throws CONFIG_MISSING when unconfigured", async () => {
      const adapter = new TemporalAdapter({ address: "" });
      await expect(
        adapter.startForensicWorkflow({
          workflowId: "wf_1",
          tracePayload: {},
        })
      ).rejects.toThrow(TemporalError);

      try {
        await adapter.startForensicWorkflow({
          workflowId: "wf_1",
          tracePayload: {},
        });
      } catch (err: unknown) {
        const tempErr = err as TemporalError;
        expect(tempErr.code).toBe("CONFIG_MISSING");
        expect(tempErr.statusCode).toBe(401);
      }
    });

    it("1.4 getWorkflowExecution throws CONFIG_MISSING when unconfigured", async () => {
      const adapter = new TemporalAdapter({ address: "" });
      await expect(adapter.getWorkflowExecution("wf_1")).rejects.toThrow(
        TemporalError
      );
    });

    it("1.5 sendSignal throws CONFIG_MISSING when unconfigured", async () => {
      const adapter = new TemporalAdapter({ address: "" });
      await expect(
        adapter.sendSignal("wf_1", "ApproveHypothesis", { approved: true })
      ).rejects.toThrow(TemporalError);
    });
  });

  describe("2. Workflow Execution & Lifecycle", () => {
    it("2.1 starts a durable workflow and parses execution schema", async () => {
      const mockExecution = {
        workflowId: "wf_forensic_001",
        runId: "run_temporal_999",
        status: "RUNNING",
        taskQueue: "ghosttrace-forensics-queue",
        startTime: "2026-10-31T12:00:00.000Z",
      };

      const mockFetch: typeof fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockExecution),
      } as unknown as Response);

      const adapter = new TemporalAdapter({
        address: "temporal.internal:7233",
        namespace: "ghosttrace",
        fetchFn: mockFetch,
      });

      const result = await adapter.startForensicWorkflow({
        workflowId: "wf_forensic_001",
        tracePayload: { traceId: "tr_456" },
      });

      expect(result.workflowId).toBe("wf_forensic_001");
      expect(result.status).toBe("RUNNING");
      expect(TemporalWorkflowExecutionSchema.safeParse(result).success).toBe(true);
    });

    it("2.2 retrieves existing workflow status", async () => {
      const mockExecution = {
        workflowId: "wf_forensic_002",
        runId: "run_temporal_888",
        status: "COMPLETED",
        taskQueue: "ghosttrace-forensics-queue",
        startTime: "2026-10-31T12:00:00.000Z",
        closeTime: "2026-10-31T12:00:15.000Z",
        result: { rootCause: "Infinite tool loop detected" },
      };

      const mockFetch: typeof fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockExecution),
      } as unknown as Response);

      const adapter = new TemporalAdapter({
        address: "temporal.internal:7233",
        namespace: "ghosttrace",
        fetchFn: mockFetch,
      });

      const result = await adapter.getWorkflowExecution("wf_forensic_002");
      expect(result.workflowId).toBe("wf_forensic_002");
      expect(result.status).toBe("COMPLETED");
      expect(result.result?.rootCause).toBe("Infinite tool loop detected");
    });

    it("2.3 throws WORKFLOW_NOT_FOUND with 404 when workflow does not exist", async () => {
      const mockFetch: typeof fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "workflow not found" }),
      } as unknown as Response);

      const adapter = new TemporalAdapter({
        address: "temporal.internal:7233",
        namespace: "ghosttrace",
        fetchFn: mockFetch,
      });

      await expect(
        adapter.getWorkflowExecution("non_existent_wf")
      ).rejects.toThrow(TemporalError);

      try {
        await adapter.getWorkflowExecution("non_existent_wf");
      } catch (err: unknown) {
        const tempErr = err as TemporalError;
        expect(tempErr.code).toBe("WORKFLOW_NOT_FOUND");
        expect(tempErr.statusCode).toBe(404);
      }
    });

    it("2.4 successfully sends human review signal to running workflow", async () => {
      const mockFetch: typeof fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      } as unknown as Response);

      const adapter = new TemporalAdapter({
        address: "temporal.internal:7233",
        namespace: "ghosttrace",
        fetchFn: mockFetch,
      });

      const res = await adapter.sendSignal("wf_forensic_001", "HumanReviewSignal", {
        action: "approve",
        reviewer: "analyst@example.com",
      });

      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("3. Upstream Error Handling", () => {
    it("3.1 handles 401 upstream with AUTHENTICATION_FAILED", async () => {
      const mockFetch: typeof fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: "Invalid API token" }),
      } as unknown as Response);

      const adapter = new TemporalAdapter({
        address: "temporal.internal:7233",
        apiKey: "bad_key",
        fetchFn: mockFetch,
      });

      await expect(
        adapter.startForensicWorkflow({
          workflowId: "wf_auth_fail",
          tracePayload: {},
        })
      ).rejects.toThrow(TemporalError);

      try {
        await adapter.startForensicWorkflow({
          workflowId: "wf_auth_fail",
          tracePayload: {},
        });
      } catch (err: unknown) {
        const tempErr = err as TemporalError;
        expect(tempErr.code).toBe("AUTHENTICATION_FAILED");
        expect(tempErr.statusCode).toBe(401);
      }
    });

    it("3.2 handles 503 upstream with UPSTREAM_REQUEST_FAILED and isRetryable: true", async () => {
      const mockFetch: typeof fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ message: "Service Unavailable" }),
      } as unknown as Response);

      const adapter = new TemporalAdapter({
        address: "temporal.internal:7233",
        fetchFn: mockFetch,
      });

      try {
        await adapter.getWorkflowExecution("wf_503");
      } catch (err: unknown) {
        const tempErr = err as TemporalError;
        expect(tempErr.code).toBe("UPSTREAM_REQUEST_FAILED");
        expect(tempErr.statusCode).toBe(503);
        expect(tempErr.isRetryable).toBe(true);
      }
    });
  });
});
