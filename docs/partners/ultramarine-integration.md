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
│  - 1 MiB Hard Payload Limit Check (getReader Streaming)│
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
│  - Model: ultramarine-1-flash, reasoning_effort: high  │
│  - Bounded Retries: Max 1 retry for transient 502/503  │
│  - Non-retryable: 401 (Auth Failure) & 429 (Quota)     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│           Validation & Grounding Safeguards            │
│  - Zod Schema Validation (UltramarineInvestigation)    │
│  - Event Citation Grounding (validEventIds vs trace)   │
│  - Causal Claim Separation (causalClaimUnverified)     │
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
  reasoning_effort: "high",
});
```

---

## 3. Privacy & Sensitive Data Sanitization (GT-UM-01)

Telemetry failure traces captured from real environments frequently contain sensitive credentials. Before any trace payload is transmitted to Paper Instruments, `sanitizeTraceData()` performs recursive sanitization across all nested objects and arrays:
- **Keys Sanitized**:
  - `authorization`
  - `api_key`, `apiKey`, `x-api-key`, `x_api_key`, `xApiKey`
  - `client_secret`, `clientSecret`
  - `stripe_secret_key`, `stripeSecretKey`
  - `refreshToken`, `refresh_token`, `accessToken`, `access_token`
  - `password`, `passwd`, `pass`, `dbPassword`
  - `cookie`, `cookies`, `set-cookie`, `set_cookie`
  - `privateKey`, `private_key`, `credentials`, `credential`
- **Values Sanitized**:
  - Bearer authentication headers (`Bearer [REDACTED_TOKEN]`)
  - JWT tokens (`[REDACTED_JWT]`)
  - Provider API keys (`sk_...`, `pk_...`, `pi_...`, `[REDACTED_API_KEY]`)
  - GitHub personal access tokens (`ghp_...`, `[REDACTED_TOKEN]`)
- **Preserved Telemetry Keys**:
  - `tokens`, `totalTokens`, `promptTokens`, `completionTokens`, `tokenUsage` are strictly preserved to ensure accurate LLM observability.

---

## 4. Grounding vs Causal Verification Separation (GT-UM-03)

GhostTrace enforces an unambiguous distinction between **event citation validity** and **causal proof**:

1. **Event Reference Grounding (`eventReferenceValid`)**:
   - `true` only if all cited event IDs exist within the trace timeline.
   - If Ultramarine cites an event ID not present in the trace, `eventReferenceValid: false`, `unsupportedEventIds` lists the hallucinated IDs, and `humanReviewRequired: true`.

2. **Causal Claim Verification (`causalClaimUnverified`)**:
   - An LLM hypothesis does not constitute formal mathematical causal proof.
   - Therefore, `causalClaimUnverified: true` is maintained for all AI-generated hypotheses, and the UI displays an explicit badge and notice:
     `⚠ causal_claim_unverified: Causal attribution is an AI hypothesis requiring human/symbolic verification.`

---

## 5. Inference Cost Transparency & Calculation (GT-UM-04)

GhostTrace tracks and displays exact inference costs using Paper Instruments' documented rates:

| Token Type | Official Rate (per 1 Million Tokens) | Rate per Token |
| :--- | :--- | :--- |
| **Uncached Input Tokens** | $0.15 / 1M | $0.00000015 |
| **Cached Input Tokens** | $0.03 / 1M | $0.00000003 |
| **Completion (Output) Tokens** | $0.50 / 1M | $0.00000050 |

### Mathematical Formula:
$$\text{Cost (USD)} = \frac{\text{uncachedInput} \times 0.15 + \text{cachedInput} \times 0.03 + \text{completionTokens} \times 0.50}{1{,}000{,}000}$$

*Example*: An investigation with 20,000 uncached input tokens and 1,000 completion tokens costs exactly **$0.003500 USD**.

**Missing Usage Handling**:
- If the upstream provider omits usage metadata, GhostTrace reports `costUsd: null` and `isKnown: false`.
- The dashboard displays `Token Usage: Unknown` and `Inference Cost: Unknown`, never claiming $0.000000.

---

## 6. Route Hardening & True Streaming Payload Limits (GT-UM-02)

All workflow execution routes (`/api/traces/workflow` and `/api/traces/ultramarine`) are protected by `src/lib/auth/workflowSecurity.ts`:

1. **Incremental Streaming Byte Count (`req.body.getReader()`)**:
   - Reads the request body chunk-by-chunk using the Web Streams API.
   - If accumulated bytes exceed 1,048,576 bytes (1 MiB), the reader immediately calls `reader.cancel()` and returns `HTTP 413 Payload Too Large`.
   - Oversized bodies are never fully buffered into memory.
2. **Production Auth0 Check**: In production, returns `503 Service Unavailable` if Auth0 is unconfigured, and `401 Unauthorized` if session is missing.
3. **Canonical OwnerId Binding**: Ignores any client-provided `ownerId` parameter and forcibly binds the trace execution to the verified session `sub`.
4. **Concurrency Token Gating**: Concurrency slots are acquired **only after** body size validation and JSON parsing succeed, preventing slot exhaustion by malformed requests.

---

## 7. Bounded Retry Policy (GT-UM-05)

- **Transient Errors**: Retries at most once for transient HTTP 502/503 errors or when the upstream response includes `x-should-retry: true`.
- **Backoff & Rate Limit Headers**: Respects `retry-after` header delay up to 3 seconds.
- **Non-Retryable**: Strictly no retries on HTTP 401 (Authentication Failure) or HTTP 429 (Rate Limit / Quota Exceeded).

---

## 8. Verification Status & Blocker Transparency

- **Automated Tests**: 104 unit and integration tests passing across 13 test files (`pnpm test`), including 19 dedicated Ultramarine adapter tests and 8 workflow security tests.
- **Live Verification Status**: **BLOCKED (P1)** pending provision of a valid `PAPERINSTRUMENTS_API_KEY` in `.env.local`.
- **Integrity Guarantee**: When `PAPERINSTRUMENTS_API_KEY` is absent or invalid, GhostTrace throws a clean, typed `UltramarineError` (`API_KEY_MISSING`). It **never** disguises a deterministic fallback as a live Ultramarine API response.
