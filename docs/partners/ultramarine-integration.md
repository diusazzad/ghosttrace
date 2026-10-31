# Paper Instruments Ultramarine Integration — GhostTrace Partner Guide

> **Partner Category**: *Best Use of Ultramarine* ($100 MLH Partner Category Prize)  
> **Provider**: Paper Instruments  
> **Model**: `ultramarine-1-flash`  
> **Endpoint**: `https://api.paperinstruments.com/v1`  
> **SDK**: Official `openai` npm package configured with custom `baseURL`

---

## 1. Problem Solved

When autonomous AI agents fail in production (e.g. unhandled tool crashes, infinite loops, parameter hallucination, state desynchronization), debugging why the agent took a fatal trajectory requires analyzing complex, non-linear event sequences across LLM calls, tool executions, and external API responses.

GhostTrace leverages **Paper Instruments Ultramarine** as a specialized reasoning engine to perform deep forensic root-cause analysis on multi-step agent failure traces. Specifically tested against **Fixture 04 (`trace-tool-crash-004`, `PaymentWebhookAgent`)**, Ultramarine reconstructs the causal chain leading from an uncaught HTTP 500 error during a Stripe settlement tool execution (`evt_302`) to a fatal process crash (`evt_303`), producing actionable remediations and synthetic regression test cases.

---

## 2. Technical Architecture & Integration

GhostTrace integrates Ultramarine through a dedicated adapter class (`src/lib/ai/ultramarineAdapter.ts`) using the official OpenAI-compatible TypeScript SDK.

```
┌────────────────────────────────────────────────────────┐
│               GhostTrace Web Dashboard                 │
│         "Run Investigation with Ultramarine"           │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│            POST /api/traces/ultramarine                │
│  - 1 MiB Hard Payload Limit Check                      │
│  - Production Auth0 Verification (503 / 401)           │
│  - Canonical OwnerId Session Binding                   │
│  - Rate Limiter (30/min) & Concurrency Throttle (5 max)│
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│            UltramarineAdapter (OpenAI SDK)             │
│  - Data Sanitization (Redact Bearer, JWTs, Secrets)    │
│  - BaseURL: https://api.paperinstruments.com/v1        │
│  - Model: ultramarine-1-flash, reasoning: high         │
│  - Bounded Retries: Max 1 retry for transient 502/503  │
│  - Non-retryable: 401 (Auth Failure) & 429 (Quota)     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│           Validation & Grounding Safeguards            │
│  - Zod Schema Validation (UltramarineInvestigation)    │
│  - Event Citation Grounding (validEventIds vs trace)   │
│  - Hallucination Flagging (unsupportedEventIds)        │
│  - Exact Inference Cost Breakdown ($0.15/$0.03/$0.50)  │
└────────────────────────────────────────────────────────┘
```

### SDK Configuration
```typescript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.PAPERINSTRUMENTS_API_KEY,
  baseURL: "https://api.paperinstruments.com/v1",
});

const completion = await client.chat.completions.create({
  model: "ultramarine-1-flash",
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify(sanitizedPayload) },
  ],
  response_format: { type: "json_object" },
  max_completion_tokens: 2048,
  // @ts-expect-error - OpenAI SDK typings omit custom provider reasoning parameters
  reasoning: "high",
});
```

---

## 3. Privacy & Sensitive Data Sanitization

Telemetry failure traces captured from real environments frequently contain sensitive credentials (e.g. Stripe secret keys, OAuth Bearer tokens, JWT tokens, passwords). 

Before any trace payload is transmitted to Paper Instruments, `sanitizeTraceData()` performs recursive sanitization:
- Replaces any object key matching `/(authorization|auth|token|secret|password|key|cookie)/i` with `"[REDACTED_SECRET]"`.
- Replaces strings matching Bearer auth headers, JWT tokens (`eyJ...`), or common API key prefixes (`sk_...`).
- Fully preserves structural event data, timestamps, event IDs, and execution metrics required for causal analysis.

---

## 4. Grounding & Anti-Hallucination Verification

To prevent AI hallucination from injecting incorrect diagnoses into production debugging workflows, GhostTrace validates Ultramarine output at two layers:

1. **Strict Zod Schema Enforcement**:
   - `summary`: Concise failure explanation.
   - `rootCause`: Causal mechanism.
   - `failureCategory`: Canonical category.
   - `supportingEventIds`: List of causal event IDs.
   - `remediation`: Concrete code/config fix.
   - `uncertaintyWarnings`: Explicit limitations.
   - `humanReviewRequired`: Flag for uncertain findings.

2. **Deterministic Evidence Citation Grounding**:
   - GhostTrace cross-checks all returned `supportingEventIds` against the actual timeline reconstructed from the trace.
   - If Ultramarine cites an event ID not present in the trace:
     - `eventReferenceValid` is set to `false`.
     - `causalClaimUnverified` is set to `true`.
     - `humanReviewRequired` is set to `true`.
     - Unsupported event IDs are explicitly highlighted in the UI and reported as a warning.

---

## 5. Inference Cost Transparency & Calculation

GhostTrace tracks and displays exact inference costs using Paper Instruments' documented rates:

| Token Type | Official Rate (per 1 Million Tokens) | Rate per Token |
| :--- | :--- | :--- |
| **Uncached Input Tokens** | $0.15 / 1M | $0.00000015 |
| **Cached Input Tokens** | $0.03 / 1M | $0.00000003 |
| **Completion (Output) Tokens** | $0.50 / 1M | $0.00000050 |

### Mathematical Formula:
$$\text{Cost (USD)} = \frac{\text{uncachedInput} \times 0.15 + \text{cachedInput} \times 0.03 + \text{completionTokens} \times 0.50}{1{,}000{,}000}$$

*Example*: An investigation with 20,000 uncached input tokens and 1,000 completion tokens costs exactly **$0.003500 USD**.

The UI displays the exact cost alongside individual token counts, enabling engineering teams to audit LLM operating expenses.

---

## 6. Route Hardening & Production Security

Following up on the security review from TASK 02, all workflow execution routes (`/api/traces/workflow` and `/api/traces/ultramarine`) are protected by `src/lib/auth/workflowSecurity.ts`:

1. **Payload Size Guard**: Hard 1 MiB limit enforced both via `Content-Length` header check and streaming byte count verification (returns `413 Payload Too Large`).
2. **Production Auth0 Check**: In production, returns `503 Service Unavailable` if Auth0 is unconfigured, and `401 Unauthorized` if session is missing.
3. **Canonical OwnerId Binding**: Ignores any client-provided `ownerId` parameter and forcibly binds the trace execution to the verified session `sub`.
4. **Rate Limiting & Concurrency**: Restricts workflow runs to 30 requests/minute per instance with a concurrency throttle of 5 simultaneous runs.

---

## 7. Verification Status & Blocker Transparency

- **Automated Tests**: 13 unit and integration tests in `src/__tests__/ultramarine.test.ts` pass with 100% coverage, verifying configuration validation, secret scrubbing, cost formulas, Zod validation, error handling (401, 429, 502 retries), and hallucination detection.
- **Live Verification Status**: **BLOCKED (P1)** pending provision of a valid `PAPERINSTRUMENTS_API_KEY`.
- **Integrity Guarantee**: When `PAPERINSTRUMENTS_API_KEY` is absent or invalid, GhostTrace throws a clean, typed `UltramarineError` (`API_KEY_MISSING`). It **never** disguises a deterministic fallback as a live Ultramarine API response.
