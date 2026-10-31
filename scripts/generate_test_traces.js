// scripts/generate_test_traces.js
const fs = require("fs");
const path = require("path");

const targetDirs = [
  "P:/Hackathon/Hactoborfest2026/week_4/test_traces",
  "P:/Hackathon/Hactoborfest2026/week_4/ghosttrace/test-traces"
];

targetDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const traces = [
  {
    filename: "test_trace_01_tool_crash_stripe_504.json",
    data: {
      id: "trace-custom-stripe-504",
      agentName: "BillingSettlementAgent",
      failureCategory: "unhandled_tool_error",
      failureDescription:
        "Agent crashed due to unhandled UpstreamAPIError HTTP 504 Gateway Timeout in stripe_process_refund without retry policy.",
      startedAt: "2026-10-31T18:30:00.000Z",
      totalDurationMs: 3850,
      totalTokens: 1420,
      estimatedCostUsd: 0.0042,
      status: "failed",
      isSampleFixture: false,
      events: [
        {
          id: "evt_101",
          name: "receive_refund_request",
          type: "state",
          startTimeMs: 0,
          durationMs: 25,
          status: "success",
          input: { refundId: "ref_98124", customerId: "cus_88192", amountCents: 12500 },
          output: { validated: true, queuePosition: 1 }
        },
        {
          id: "evt_102",
          name: "llm_evaluate_refund_eligibility",
          type: "llm",
          startTimeMs: 30,
          durationMs: 650,
          status: "success",
          tokens: { prompt: 850, completion: 150, total: 1000 },
          input: { customerTenureMonths: 24, disputesCount: 0, requestedAmount: 125.0 },
          output: { decision: "approve", reason: "Trusted account in good standing" }
        },
        {
          id: "evt_103",
          name: "query_account_ledger",
          type: "tool",
          startTimeMs: 690,
          durationMs: 140,
          status: "success",
          input: { customerId: "cus_88192" },
          output: { balanceUsd: 340.5, currency: "USD" }
        },
        {
          id: "evt_104",
          name: "stripe_process_refund",
          type: "tool",
          startTimeMs: 840,
          durationMs: 2980,
          status: "error",
          error:
            "UpstreamAPIError: HTTP 504 Gateway Timeout from api.stripe.com/v1/refunds (Host connection timed out after 3000ms)",
          isCausalAnomaly: true,
          input: { charge: "ch_3N824", amount: 12500, reason: "requested_by_customer" }
        },
        {
          id: "evt_105",
          name: "unhandled_rejection_exit",
          type: "error",
          startTimeMs: 3825,
          durationMs: 25,
          status: "error",
          error:
            "FatalRuntimeError: UnhandledPromiseRejection in agent step execution without fallback handler",
          isCausalAnomaly: true
        }
      ],
      hypothesis: {
        title: "Unhandled Tool Error: stripe_process_refund 504 Gateway Timeout",
        model: "Rule-Based Deterministic Grounding Engine",
        provider: "deterministic_rules",
        executionMode: "deterministic_fallback",
        latencyMs: 5,
        explanation:
          "Tool stripe_process_refund experienced a 504 Gateway Timeout at evt_104 after 2980ms. The missing try/catch and absence of backoff retry caused unhandled rejection propagation to evt_105, crashing the worker agent process.",
        groundedEventIds: ["evt_104", "evt_105"],
        confidence: 0.96,
        validationStatus: "grounded",
        suggestedFix:
          "Implement an exponential backoff jitter retry policy around stripe_process_refund and enqueue a dead-letter event upon 504 timeout rather than aborting process.",
        uncertaintyWarnings: ["Deterministic verification completed successfully."]
      },
      generatedTestCode:
        "// Vitest Forensic Safeguard\nimport { describe, it, expect, vi } from 'vitest';\n\ndescribe('BillingSettlementAgent - 504 Timeout Safeguard', () => {\n  it('gracefully handles 504 Gateway Timeout in stripe_process_refund without crashing process', async () => {\n    const mockStripe = vi.fn().mockRejectedValue(new Error('HTTP 504 Gateway Timeout'));\n    let errorCaught = false;\n    try {\n      await mockStripe();\n    } catch (err) {\n      errorCaught = true;\n    }\n    expect(errorCaught).toBe(true);\n  });\n});"
    }
  },
  {
    filename: "test_trace_02_infinite_loop_rag_query.json",
    data: {
      id: "trace-custom-rag-loop-002",
      agentName: "CustomerSupportRAGAgent",
      failureCategory: "infinite_loop",
      failureDescription:
        "Agent entered an infinite rewrite loop re-querying vector knowledge base 3 times with zero similarity gain.",
      startedAt: "2026-10-31T19:00:00.000Z",
      totalDurationMs: 4620,
      totalTokens: 3840,
      estimatedCostUsd: 0.0115,
      status: "failed",
      isSampleFixture: false,
      events: [
        {
          id: "evt_201",
          name: "user_inquiry_received",
          type: "state",
          startTimeMs: 0,
          durationMs: 10,
          status: "success",
          input: { query: "Where is my tracking number for order #8841?" }
        },
        {
          id: "evt_202",
          name: "query_vector_store_attempt_1",
          type: "tool",
          startTimeMs: 20,
          durationMs: 420,
          status: "warning",
          output: { matchCount: 0, topScore: 0.41 },
          isCausalAnomaly: false
        },
        {
          id: "evt_203",
          name: "llm_rewrite_query_attempt_1",
          type: "llm",
          startTimeMs: 450,
          durationMs: 700,
          status: "success",
          tokens: { prompt: 620, completion: 180, total: 800 },
          output: { reformulatedQuery: "order #8841 package tracking status" }
        },
        {
          id: "evt_204",
          name: "query_vector_store_attempt_2",
          type: "tool",
          startTimeMs: 1160,
          durationMs: 410,
          status: "warning",
          output: { matchCount: 0, topScore: 0.42 },
          isCausalAnomaly: true
        },
        {
          id: "evt_205",
          name: "llm_rewrite_query_attempt_2",
          type: "llm",
          startTimeMs: 1580,
          durationMs: 710,
          status: "success",
          tokens: { prompt: 780, completion: 200, total: 980 },
          output: { reformulatedQuery: "shipping carrier tracking number order 8841" }
        },
        {
          id: "evt_206",
          name: "query_vector_store_attempt_3",
          type: "tool",
          startTimeMs: 2300,
          durationMs: 430,
          status: "warning",
          output: { matchCount: 0, topScore: 0.4 },
          isCausalAnomaly: true
        },
        {
          id: "evt_207",
          name: "loop_threshold_exhausted",
          type: "error",
          startTimeMs: 4580,
          durationMs: 40,
          status: "error",
          error:
            "InfiniteLoopDetected: Max iteration budget (3 attempts) exceeded without finding matching document embeddings",
          isCausalAnomaly: true
        }
      ],
      hypothesis: {
        title: "Infinite Loop: Repetitive Vector Re-ranking Stall",
        model: "Rule-Based Deterministic Grounding Engine",
        provider: "deterministic_rules",
        executionMode: "deterministic_fallback",
        latencyMs: 4,
        explanation:
          "CustomerSupportRAGAgent called vector query tool repeatedly across evt_202, evt_204, and evt_206 without score convergence. Missing convergence circuit breaker caused execution abortion at evt_207.",
        groundedEventIds: ["evt_204", "evt_206", "evt_207"],
        confidence: 0.94,
        validationStatus: "grounded",
        suggestedFix:
          "Enforce max retry count of 2 with immediate escalation to fallback human agent when vector similarity stays below 0.60."
      },
      generatedTestCode:
        "// Vitest Loop Breaker Test\nimport { describe, it, expect } from 'vitest';\n\ndescribe('CustomerSupportRAGAgent - Loop Protection', () => {\n  it('aborts query rewriting after 2 unsuccessful attempts and triggers human escalation', () => {\n    const attempts = [0.41, 0.42, 0.40];\n    const maxRetries = 2;\n    const shouldEscalate = attempts.length > maxRetries;\n    expect(shouldEscalate).toBe(true);\n  });\n});"
    }
  },
  {
    filename: "test_trace_03_parameter_hallucination_sql.json",
    data: {
      id: "trace-custom-sql-hallucination-003",
      agentName: "DataAnalyticsCopilot",
      failureCategory: "parameter_hallucination",
      failureDescription:
        "Agent hallucinated non-existent database column `internal_user_credit_score` in execute_sql_query causing syntax error.",
      startedAt: "2026-10-31T19:45:00.000Z",
      totalDurationMs: 1890,
      totalTokens: 1980,
      estimatedCostUsd: 0.0059,
      status: "failed",
      isSampleFixture: false,
      events: [
        {
          id: "evt_301",
          name: "receive_natural_language_prompt",
          type: "state",
          startTimeMs: 0,
          durationMs: 15,
          status: "success",
          input: { userPrompt: "Show me top 10 users ranked by internal credit score for Q3" }
        },
        {
          id: "evt_302",
          name: "llm_synthesize_sql_query",
          type: "llm",
          startTimeMs: 20,
          durationMs: 820,
          status: "success",
          tokens: { prompt: 1400, completion: 220, total: 1620 },
          output: {
            generatedSql:
              "SELECT user_id, email, internal_user_credit_score FROM analytics.users WHERE quarter = 'Q3' ORDER BY internal_user_credit_score DESC LIMIT 10;"
          }
        },
        {
          id: "evt_303",
          name: "execute_sql_query",
          type: "tool",
          startTimeMs: 850,
          durationMs: 990,
          status: "error",
          error:
            'PostgresQueryError: column "internal_user_credit_score" does not exist at character 31. Available columns in analytics.users: [user_id, email, credit_limit_usd, risk_rating, created_at]',
          isCausalAnomaly: true,
          input: { query: "SELECT user_id, email, internal_user_credit_score FROM analytics.users..." }
        },
        {
          id: "evt_304",
          name: "execution_aborted_syntax_error",
          type: "error",
          startTimeMs: 1850,
          durationMs: 40,
          status: "error",
          error: "AgentTerminated: Query execution rejected by database catalog schema validator",
          isCausalAnomaly: true
        }
      ],
      hypothesis: {
        title: "Parameter Hallucination: Column internal_user_credit_score Missing",
        model: "Rule-Based Deterministic Grounding Engine",
        provider: "deterministic_rules",
        executionMode: "deterministic_fallback",
        latencyMs: 3,
        explanation:
          "At evt_302 the LLM generated SQL referencing `internal_user_credit_score` which was not present in the verified table schema. The query failed at evt_303 with column non-existence error.",
        groundedEventIds: ["evt_303", "evt_304"],
        confidence: 0.98,
        validationStatus: "grounded",
        suggestedFix:
          "Ground SQL generation with strict Information Schema DDL context and run client-side column validation against schema before sending query to database."
      },
      generatedTestCode:
        "// Vitest Schema Grounding Test\nimport { describe, it, expect } from 'vitest';\n\ndescribe('DataAnalyticsCopilot - Schema Validation Safeguard', () => {\n  it('rejects hallucinated column before running SQL execution', () => {\n    const validColumns = ['user_id', 'email', 'credit_limit_usd', 'risk_rating', 'created_at'];\n    const requestedColumn = 'internal_user_credit_score';\n    const isValid = validColumns.includes(requestedColumn);\n    expect(isValid).toBe(false);\n  });\n});"
    }
  },
  {
    filename: "test_trace_04_browserbase_dom_detachment.json",
    data: {
      id: "trace-custom-browserbase-detach-004",
      agentName: "CheckoutAutomationAgent",
      failureCategory: "unhandled_tool_error",
      failureDescription:
        "Browserbase session crashed due to DOM FrameDetachedError during iframe payment submission.",
      startedAt: "2026-10-31T20:10:00.000Z",
      totalDurationMs: 2450,
      totalTokens: 890,
      estimatedCostUsd: 0.0026,
      status: "failed",
      isSampleFixture: false,
      events: [
        {
          id: "evt_401",
          name: "browserbase_create_session",
          type: "tool",
          startTimeMs: 0,
          durationMs: 420,
          status: "success",
          output: { sessionId: "ssn_bb_custom_9941", status: "RUNNING" }
        },
        {
          id: "evt_402",
          name: "navigate_to_checkout_page",
          type: "tool",
          startTimeMs: 430,
          durationMs: 810,
          status: "success",
          output: { url: "https://store.example.com/checkout", httpStatus: 200 }
        },
        {
          id: "evt_403",
          name: "browserbase_click_payment_iframe",
          type: "tool",
          startTimeMs: 1250,
          durationMs: 1140,
          status: "error",
          error:
            "BrowserbaseProtocolError: Target.detachedFromTarget: Frame detached while waiting for selector #secure-pay-btn inside iframe.stripe-elements",
          isCausalAnomaly: true
        },
        {
          id: "evt_404",
          name: "session_execution_crash",
          type: "error",
          startTimeMs: 2400,
          durationMs: 50,
          status: "error",
          error: "UnhandledDOMException: FrameDetachedError terminating web automation run",
          isCausalAnomaly: true
        }
      ],
      hypothesis: {
        title: "Browserbase Tool Crash: FrameDetachedError in Payment Iframe",
        model: "Rule-Based Deterministic Grounding Engine",
        provider: "deterministic_rules",
        executionMode: "deterministic_fallback",
        latencyMs: 3,
        explanation:
          "At evt_403 Browserbase attempted to click #secure-pay-btn in an iframe that re-rendered and detached from the DOM tree before the click event was dispatched.",
        groundedEventIds: ["evt_403", "evt_404"],
        confidence: 0.95,
        validationStatus: "grounded",
        suggestedFix:
          "Implement waitForSelector with frame re-attachment recovery logic before clicking embedded checkout iframes."
      },
      generatedTestCode:
        "// Vitest Browserbase DOM Resilience Test\nimport { describe, it, expect } from 'vitest';\n\ndescribe('CheckoutAutomationAgent - Frame Detachment Recovery', () => {\n  it('detects detached frame and retries iframe resolution gracefully', async () => {\n    let frameAttached = false;\n    const retryFrame = () => {\n      frameAttached = true;\n      return frameAttached;\n    };\n    expect(retryFrame()).toBe(true);\n  });\n});"
    }
  },
  {
    filename: "test_trace_05_context_overflow_summarizer.json",
    data: {
      id: "trace-custom-context-overflow-005",
      agentName: "LegalContractSummarizer",
      failureCategory: "context_overflow",
      failureDescription:
        "Document summarization failed when ingested multi-file legal brief exceeded model context window (134,200 tokens).",
      startedAt: "2026-10-31T20:45:00.000Z",
      totalDurationMs: 1540,
      totalTokens: 134200,
      estimatedCostUsd: 0.1342,
      status: "failed",
      isSampleFixture: false,
      events: [
        {
          id: "evt_501",
          name: "load_legal_brief_pdf",
          type: "state",
          startTimeMs: 0,
          durationMs: 80,
          status: "success",
          output: { pagesCount: 185, rawBytes: 1420580 }
        },
        {
          id: "evt_502",
          name: "extract_document_text",
          type: "tool",
          startTimeMs: 90,
          durationMs: 350,
          status: "success",
          output: { characterCount: 536800, tokenEstimate: 134200 }
        },
        {
          id: "evt_503",
          name: "llm_generate_executive_summary",
          type: "llm",
          startTimeMs: 450,
          durationMs: 1050,
          status: "error",
          tokens: { prompt: 134200, completion: 0, total: 134200 },
          error:
            "ContextWindowExceededError: Maximum prompt context of 131,072 tokens exceeded. Ingested prompt tokens: 134,200. Request rejected with HTTP 400 Bad Request.",
          isCausalAnomaly: true
        },
        {
          id: "evt_504",
          name: "pipeline_aborted_oversized_payload",
          type: "error",
          startTimeMs: 1510,
          durationMs: 30,
          status: "error",
          error:
            "FatalPayloadError: Context window hard limit encountered without map-reduce chunking fallback",
          isCausalAnomaly: true
        }
      ],
      hypothesis: {
        title: "Context Window Overflow: 134,200 Tokens Ingested",
        model: "Rule-Based Deterministic Grounding Engine",
        provider: "deterministic_rules",
        executionMode: "deterministic_fallback",
        latencyMs: 3,
        explanation:
          "At evt_503, the agent sent an unchunked 185-page document (134,200 tokens) in a single LLM request, blowing through the 131,072 model limit and triggering HTTP 400.",
        groundedEventIds: ["evt_503", "evt_504"],
        confidence: 0.99,
        validationStatus: "grounded",
        suggestedFix:
          "Implement map-reduce hierarchical chunking (sliding window of 8,000 tokens) before calling LLM summarizer."
      },
      generatedTestCode:
        "// Vitest Context Window Chunking Safeguard\nimport { describe, it, expect } from 'vitest';\n\ndescribe('LegalContractSummarizer - Chunking Safeguard', () => {\n  it('splits 134k token payload into chunks smaller than 8000 tokens', () => {\n    const totalTokens = 134200;\n    const chunkSize = 8000;\n    const chunks = Math.ceil(totalTokens / chunkSize);\n    expect(chunks).toBe(17);\n    expect(chunkSize).toBeLessThan(131072);\n  });\n});"
    }
  },
  {
    filename: "test_trace_06_latency_stall_coordinator.json",
    data: {
      id: "trace-custom-latency-stall-006",
      agentName: "WorkflowCoordinatorAgent",
      failureCategory: "latency_stall",
      failureDescription:
        "Coordinator agent stalled for 12,000ms waiting for asynchronous worker heartbeat that silently dropped.",
      startedAt: "2026-10-31T21:15:00.000Z",
      totalDurationMs: 12450,
      totalTokens: 520,
      estimatedCostUsd: 0.0015,
      status: "failed",
      isSampleFixture: false,
      events: [
        {
          id: "evt_601",
          name: "dispatch_worker_subtask",
          type: "tool",
          startTimeMs: 0,
          durationMs: 45,
          status: "success",
          input: { subtaskId: "task_worker_771" },
          output: { dispatched: true }
        },
        {
          id: "evt_602",
          name: "poll_worker_heartbeat_loop",
          type: "tool",
          startTimeMs: 50,
          durationMs: 12200,
          status: "warning",
          error:
            "LatencyThresholdWarning: Worker did not reply within SLA (timeout: 10000ms, elapsed: 12200ms)",
          isCausalAnomaly: true
        },
        {
          id: "evt_603",
          name: "coordinator_timeout_abort",
          type: "error",
          startTimeMs: 12300,
          durationMs: 150,
          status: "error",
          error:
            "ExecutionStalledError: Global workflow SLA budget (10s) breached without failover routing",
          isCausalAnomaly: true
        }
      ],
      hypothesis: {
        title: "Latency Stall: Worker Subtask Unresponsive for 12.2s",
        model: "Rule-Based Deterministic Grounding Engine",
        provider: "deterministic_rules",
        executionMode: "deterministic_fallback",
        latencyMs: 4,
        explanation:
          "At evt_602, the coordinator polled an unresponsive worker for 12,200ms without a circuit breaker or fallback worker re-assignment.",
        groundedEventIds: ["evt_602", "evt_603"],
        confidence: 0.95,
        validationStatus: "grounded",
        suggestedFix:
          "Configure Temporal durable activity timeout with 5s max heartbeat and automatic re-routing to an active standby worker."
      },
      generatedTestCode:
        "// Vitest Latency Circuit Breaker Test\nimport { describe, it, expect } from 'vitest';\n\ndescribe('WorkflowCoordinatorAgent - Timeout Circuit Breaker', () => {\n  it('triggers standby failover after 5000ms without heartbeat', () => {\n    const timeoutMs = 5000;\n    const elapsedMs = 6200;\n    const shouldFailover = elapsedMs > timeoutMs;\n    expect(shouldFailover).toBe(true);\n  });\n});"
    }
  }
];

targetDirs.forEach((dir) => {
  traces.forEach((t) => {
    const filePath = path.join(dir, t.filename);
    fs.writeFileSync(filePath, JSON.stringify(t.data, null, 2), "utf-8");
    console.log("Saved:", filePath);
  });
});

console.log("SUCCESS: All 6 test traces generated successfully.");
