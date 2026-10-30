import { TraceRun } from "@/types/trace";

export const SAMPLE_TRACES: TraceRun[] = [
  {
    id: "run-inf-loop-8491",
    agentName: "SupportRefundAgent",
    failureCategory: "infinite_loop",
    failureDescription: "Agent trapped in repetitive tool query loop after receiving empty order record.",
    startedAt: "2026-10-30T10:45:12Z",
    totalDurationMs: 14250,
    totalTokens: 12480,
    estimatedCostUsd: 0.042,
    status: "failed",
    events: [
      {
        id: "evt_001",
        name: "agent_init_intent",
        type: "state",
        startTimeMs: 0,
        durationMs: 45,
        status: "success",
        input: { userPrompt: "Please refund my order #ORD-98211" },
        output: { state: "initialized", intent: "refund_request" },
      },
      {
        id: "evt_002",
        name: "llm_plan_steps",
        type: "llm",
        startTimeMs: 50,
        durationMs: 1120,
        status: "success",
        input: { prompt: "System: You are SupportRefundAgent. Step 1: Query order DB..." },
        output: { tool_call: "query_order_db", arguments: { order_id: "ORD-98211" } },
        tokens: { prompt: 412, completion: 86, total: 498 },
      },
      {
        id: "evt_003",
        name: "query_order_db",
        type: "tool",
        startTimeMs: 1200,
        durationMs: 480,
        status: "warning",
        input: { order_id: "ORD-98211" },
        output: { result: null, code: 404, message: "Order not found in active cache" },
        isCausalAnomaly: true,
      },
      {
        id: "evt_004",
        name: "llm_retry_decision_1",
        type: "llm",
        startTimeMs: 1720,
        durationMs: 1450,
        status: "success",
        input: { prompt: "Tool returned 404. What is your next action?" },
        output: { tool_call: "query_order_db", arguments: { order_id: "ORD-98211" } },
        tokens: { prompt: 620, completion: 74, total: 694 },
      },
      {
        id: "evt_005",
        name: "query_order_db_retry_1",
        type: "tool",
        startTimeMs: 3200,
        durationMs: 420,
        status: "warning",
        input: { order_id: "ORD-98211" },
        output: { result: null, code: 404, message: "Order not found in active cache" },
        isCausalAnomaly: true,
      },
      {
        id: "evt_006",
        name: "llm_retry_decision_2",
        type: "llm",
        startTimeMs: 3650,
        durationMs: 1380,
        status: "success",
        input: { prompt: "Tool returned 404 again. Next action?" },
        output: { tool_call: "query_order_db", arguments: { order_id: "ORD-98211" } },
        tokens: { prompt: 810, completion: 65, total: 875 },
      },
      {
        id: "evt_007",
        name: "query_order_db_retry_2",
        type: "tool",
        startTimeMs: 5050,
        durationMs: 390,
        status: "warning",
        input: { order_id: "ORD-98211" },
        output: { result: null, code: 404, message: "Order not found in active cache" },
        isCausalAnomaly: true,
      },
      {
        id: "evt_008",
        name: "loop_circuit_breaker_trip",
        type: "error",
        startTimeMs: 5460,
        durationMs: 15,
        status: "error",
        error: "CircuitBreakerError: Identical tool 'query_order_db' invoked 3 times with identical parameters without state mutation.",
        isCausalAnomaly: true,
      },
    ],
    hypothesis: {
      title: "Cyclic Tool Invalidation Loop via Unhandled 404",
      model: "Google Gemma 2 (9B)",
      explanation: "The agent received a 404 error from `query_order_db` in evt_003. Lacking an alternative fallback strategy (e.g. querying cold storage archive or asking user for confirmation), the prompt template continuously re-triggered the same query in evt_005 and evt_007 until loop cutoff evt_008.",
      groundedEventIds: ["evt_003", "evt_005", "evt_007", "evt_008"],
      confidence: 0.98,
      validationStatus: "grounded",
      suggestedFix: "Implement a deterministic loop detector or explicit error branch in system prompt: If query_order_db returns 404, query_archive_orders() or prompt user before repeating.",
    },
    generatedTestCode: `import { describe, it, expect, vi } from "vitest";
import { SupportRefundAgent } from "@/agents/refund";

describe("SupportRefundAgent - Circuit Breaker Regression", () => {
  it("should not enter repetitive loop when order is not found", async () => {
    const mockOrderDb = vi.fn().mockResolvedValue({ code: 404, message: "Not found" });
    const agent = new SupportRefundAgent({ queryOrderDb: mockOrderDb });

    const result = await agent.process("Please refund my order #ORD-98211");
    
    // Ensure agent fails gracefully or asks clarification rather than looping
    expect(mockOrderDb).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("needs_user_input");
  });
});`,
  },
  {
    id: "run-param-halluc-3104",
    agentName: "CodeRefactorAgent",
    failureCategory: "parameter_hallucination",
    failureDescription: "Agent fabricated hallucinated schema argument 'enforce_pydantic_v2' causing tool validation failure.",
    startedAt: "2026-10-30T10:14:02Z",
    totalDurationMs: 6850,
    totalTokens: 6420,
    estimatedCostUsd: 0.021,
    status: "failed",
    events: [
      {
        id: "evt_101",
        name: "parse_user_request",
        type: "state",
        startTimeMs: 0,
        durationMs: 30,
        status: "success",
        input: { request: "Refactor user models to pydantic v2 format" },
      },
      {
        id: "evt_102",
        name: "llm_generate_patch",
        type: "llm",
        startTimeMs: 35,
        durationMs: 2450,
        status: "success",
        tokens: { prompt: 1450, completion: 410, total: 1860 },
        output: {
          tool_call: "apply_ast_patch",
          arguments: {
            filePath: "src/models/user.py",
            enforce_pydantic_v2: true, // HALLUCINATED ARGUMENT
            patchStrategy: "declarative",
          },
        },
        isCausalAnomaly: true,
      },
      {
        id: "evt_103",
        name: "tool_apply_ast_patch",
        type: "error",
        startTimeMs: 2510,
        durationMs: 120,
        status: "error",
        error: "ValidationError: Extra inputs are not permitted for tool 'apply_ast_patch': 'enforce_pydantic_v2'",
        isCausalAnomaly: true,
      },
    ],
    hypothesis: {
      title: "Schema Argument Hallucination on Tool Invocation",
      model: "Google Gemma 2 (9B)",
      explanation: "In evt_102, the LLM inferred that the refactoring flag 'enforce_pydantic_v2' belonged inside the tool parameters. The tool definition schema strictly enforces no extra parameters, triggering a schema rejection in evt_103.",
      groundedEventIds: ["evt_102", "evt_103"],
      confidence: 0.95,
      validationStatus: "grounded",
      suggestedFix: "Use strict JSON schema validation in tool declarations or provide explicit examples in the system prompt.",
    },
    generatedTestCode: `import { describe, it, expect } from "vitest";
import { applyAstPatchTool } from "@/tools/ast";

describe("Tool Schema Strictness - apply_ast_patch", () => {
  it("rejects hallucinated parameters according to Zod schema", () => {
    const invalidPayload = {
      filePath: "src/models/user.py",
      enforce_pydantic_v2: true,
      patchStrategy: "declarative"
    };

    const parseResult = applyAstPatchTool.schema.safeParse(invalidPayload);
    expect(parseResult.success).toBe(false);
  });
});`,
  },
];
