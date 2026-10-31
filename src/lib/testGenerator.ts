import { ReconstructedTimeline } from "@/types/schema";

export function generateRegressionTest(timeline: ReconstructedTimeline): string {
  const { traceId, agentName, primaryFailureCategory, anomalies, events } = timeline;
  const primaryAnomaly = anomalies[0];

  // Sanitize untrusted identifiers to prevent syntax breaks or invalid imports
  const safeAgentName = agentName.replace(/[^a-zA-Z0-9_]/g, "") || "TargetAgent";
  const safeTraceId = traceId.replace(/[^a-zA-Z0-9_-]/g, "") || "trace_sample";

  const blueprintHeader = `/**
 * GhostTrace Regression Test Blueprint
 * Generated for Incident Trace: #${safeTraceId}
 * Target Agent: ${safeAgentName}
 * Failure Category: ${primaryFailureCategory}
 * Blueprint Status: Blueprint / Scaffold (Bind to your local agent test runner)
 */\n\n`;

  switch (primaryFailureCategory) {
    case "infinite_loop": {
      const toolEvent = events.find(
        (e) => e.type === "tool" && (primaryAnomaly?.groundedEventIds.includes(e.id) || e.isCausalAnomaly)
      );
      const rawToolName = toolEvent?.name || "fetch_order";
      const safeToolName = rawToolName.replace(/[^a-zA-Z0-9_]/g, "") || "fetch_order";

      return `${blueprintHeader}import { describe, it, expect, vi } from "vitest";
import { ${safeAgentName} } from "@/agents/${safeAgentName.toLowerCase()}";

describe("${safeAgentName} - Infinite Loop Regression (#${safeTraceId})", () => {
  it("should not enter repetitive tool loop when '${safeToolName}' returns persistent failure", async () => {
    // Arrange: Mock tool failure to reproduce trace condition
    const mockTool = vi.fn().mockResolvedValue({
      status: 404,
      error: "Entity not found in cache"
    });

    const agent = new ${safeAgentName}({
      tools: { ${safeToolName}: mockTool },
      circuitBreaker: { maxConsecutiveIdenticalCalls: 2 }
    });

    // Act: Process the trigger prompt
    const result = await agent.run({
      userPrompt: "Process request under recurring tool 404"
    });

    // Assert: Tool must not be called more than 2 times
    expect(mockTool).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("halted_circuit_breaker");
    expect(result.error).toBeDefined();
  });
});`;
    }

    case "parameter_hallucination": {
      const faultyTool = events.find(
        (e) => (e.status === "error" || e.type === "error") && primaryAnomaly?.groundedEventIds.includes(e.id)
      );
      const rawToolName = faultyTool?.name || "tool_executor";
      const safeToolName = rawToolName.replace(/[^a-zA-Z0-9_]/g, "") || "tool_executor";

      return `${blueprintHeader}import { describe, it, expect } from "vitest";
import { ${safeToolName}Tool } from "@/tools/${safeToolName.toLowerCase()}";

describe("${safeAgentName} - Parameter Schema Strictness (#${safeTraceId})", () => {
  it("strictly validates tool parameters and rejects hallucinated arguments", () => {
    // Arrange: Fabricated payload matching hallucinated LLM output
    const hallucinatedPayload = {
      filePath: "src/user.py",
      enforce_pydantic_v2: true, // Hallucinated parameter
      patchMode: "strict"
    };

    // Act & Assert: Schema parser should throw or return safe failure
    const validationResult = ${safeToolName}Tool.schema.safeParse(hallucinatedPayload);
    expect(validationResult.success).toBe(false);
    
    if (!validationResult.success) {
      const errorMsg = validationResult.error.message;
      expect(errorMsg).toMatch(/unrecognized_keys|extra_inputs/i);
    }
  });
});`;
    }

    case "context_overflow": {
      return `${blueprintHeader}import { describe, it, expect } from "vitest";
import { pruneContextWindow } from "@/lib/contextManager";

describe("${safeAgentName} - Context Overflow Guard (#${safeTraceId})", () => {
  it("prunes conversation messages to never exceed the 8,192 token limit", () => {
    // Arrange: Oversized synthetic message history (38,000+ tokens)
    const longDocumentChunk = "A".repeat(150000);
    const messages = [
      { role: "system", content: "You are a summarizing assistant." },
      { role: "user", content: longDocumentChunk }
    ];

    // Act: Prune context before dispatching to LLM
    const pruned = pruneContextWindow(messages, { maxTokens: 8192 });

    // Assert: Total estimated tokens must strictly remain within budget
    expect(pruned.length).toBeGreaterThan(0);
    expect(pruned[0].content.length).toBeLessThan(32000);
  });
});`;
    }

    case "unhandled_tool_error": {
      const errorEvent = events.find((e) => e.status === "error");
      const rawFaultyOp = errorEvent?.name || "upstream_api";
      const safeFaultyOp = rawFaultyOp.replace(/[^a-zA-Z0-9_]/g, "") || "upstream_api";

      return `${blueprintHeader}import { describe, it, expect, vi } from "vitest";
import { ${safeAgentName} } from "@/agents/${safeAgentName.toLowerCase()}";

describe("${safeAgentName} - Unhandled Error Graceful Recovery (#${safeTraceId})", () => {
  it("catches 500 error from '${safeFaultyOp}' without crashing the process", async () => {
    // Arrange: Simulate upstream HTTP 500
    const mockFaultyApi = vi.fn().mockRejectedValue(
      new Error("UpstreamAPIError: HTTP 500 Internal Server Error")
    );

    const agent = new ${safeAgentName}({
      apiClient: mockFaultyApi
    });

    // Act: Should handle failure gracefully
    const response = await agent.handleWebhook({
      id: "test_event_123"
    });

    // Assert: Process continues; returns failure acknowledgment without crash
    expect(mockFaultyApi).toHaveBeenCalled();
    expect(response.handled).toBe(true);
    expect(response.status).toBe("error_gracefully_handled");
  });
});`;
    }

    case "latency_stall": {
      const stallEvent = events.find((e) => e.durationMs >= 15000);
      const rawToolName = stallEvent?.name || "http_fetch";
      const safeToolName = rawToolName.replace(/[^a-zA-Z0-9_]/g, "") || "http_fetch";

      return `${blueprintHeader}import { describe, it, expect, vi } from "vitest";
import { ${safeToolName}WithTimeout } from "@/lib/network";

describe("${safeAgentName} - Operation Timeout Guard (#${safeTraceId})", () => {
  it("aborts '${safeToolName}' after 5,000ms timeout threshold", async () => {
    vi.useFakeTimers();

    // Arrange: Hanging promise simulating 30s socket hang
    const hangingRequest = new Promise((resolve) => setTimeout(resolve, 30000));
    
    // Act & Assert
    const executePromise = ${safeToolName}WithTimeout(() => hangingRequest, { timeoutMs: 5000 });
    
    vi.advanceTimersByTime(5001);
    
    await expect(executePromise).rejects.toThrow(/Operation timed out after 5000ms/);
    vi.useRealTimers();
  });
});`;
    }

    default: {
      return `${blueprintHeader}import { describe, it, expect } from "vitest";
import { ${safeAgentName} } from "@/agents/${safeAgentName.toLowerCase()}";

describe("${safeAgentName} - Baseline Happy Path (#${safeTraceId})", () => {
  it("completes full multi-step workflow without anomalies or loop faults", async () => {
    const agent = new ${safeAgentName}();
    const result = await agent.execute({
      query: "Standard operational request"
    });

    expect(result.status).toBe("completed");
    expect(result.output).toBeDefined();
  });
});`;
    }
  }
}
