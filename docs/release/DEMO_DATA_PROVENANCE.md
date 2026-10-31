# Demo Data Provenance & Fixture Catalog

**Project:** GhostTrace  
**Version:** 0.1.0  
**Date:** October 31, 2026  

---

## Purpose of Sample Fixtures

GhostTrace bundles 5 illustrative sample traces in `src/lib/sampleTraces.ts`. These fixtures serve two technical purposes:
1. **Automated Regression Testing:** Ensuring that Vitest test suites can deterministically execute against known multi-turn failure trajectories without relying on remote API availability or incurring billing costs during CI runs.
2. **Offline UI Demonstration:** Permitting hackathon judges and evaluators to immediately interact with the waterfall timeline, workflow stepper, and regression test generator without configuring cloud API keys.

---

## Catalog of Bundled Sample Traces

Every trace in `SAMPLE_TRACES` is explicitly marked with `isSampleFixture: true` and a `fixtureDisclaimer`.

### 1. `trace-tool-crash-004` (Default Trace)
- **Agent:** `PaymentWebhookAgent`
- **Failure Mode:** `unhandled_tool_error` (Stripe Gateway HTTP 500)
- **Token Footprint:** 640 Tokens (520 Prompt, 120 Completion)
- **Estimated Cost:** $0.0019 (Illustrative Fixture Footprint)
- **Provenance:** Synthetic simulation of a settlement tool crashing due to an unhandled upstream rejection (`evt_302`).

### 2. `trace-loop-001`
- **Agent:** `OrderFulfillmentAgent`
- **Failure Mode:** `infinite_loop` (Cyclic Tool Invalidation Loop)
- **Token Footprint:** 12,450 Tokens
- **Estimated Cost:** $0.0374 (Illustrative Fixture Footprint)
- **Provenance:** Synthetic simulation of an agent repeatedly issuing identical queries against an unhandled 404 endpoint.

### 3. `trace-arg-hallucination-002`
- **Agent:** `CodeRefactorAgent`
- **Failure Mode:** `parameter_hallucination` (AST Patch Schema Invalidation)
- **Token Footprint:** 3,820 Tokens
- **Estimated Cost:** $0.0115 (Illustrative Fixture Footprint)
- **Provenance:** Synthetic simulation of an agent inventing non-existent parameters on tool invocation.

### 4. `trace-browserbase-003`
- **Agent:** `WebScraperNavAgent`
- **Failure Mode:** `unhandled_tool_error` (Browserbase Headless Frame Detachment)
- **Token Footprint:** 1,840 Tokens
- **Estimated Cost:** $0.0055 (Illustrative Fixture Footprint)
- **Provenance:** Synthetic simulation of an agent attempting to click an iframe element that underwent frame detachment.

### 5. `trace-tiger-005`
- **Agent:** `ClusterIncidentAgent`
- **Failure Mode:** `unhandled_tool_error` (Tiger Data Historical Incident Recurrence)
- **Token Footprint:** 4,200 Tokens
- **Estimated Cost:** $0.0126 (Illustrative Fixture Footprint)
- **Provenance:** Synthetic simulation of proactive circuit breaking triggered by high graph similarity to historical incident clusters.

---

## UI Differentiation Contract

| Metric / Field | Sample Fixture Presentation | Live Captured Ingestion Presentation |
|---|---|---|
| **Header Badge** | `Data Source: Illustrative Fixture Trace` | `Data Source: Live Captured Ingestion` |
| **Token Footprint** | `Fixture Token Footprint (Illustrative)` | `Token Footprint (Actual Context Consumed)` |
| **Estimated Cost** | `Est. Fixture Cost: $X.XXXX (Sample)` | `Est. Cost: $X.XXXX (Calculated from Usage)` |
| **Partner Badges** | `Simulated Demo` / `Fixture Pattern` | `Live Executed` / `Connected` |
| **Hypothesis Mode** | `Engine: Rule-Based Forensic Analyzer` | `Engine: Google Gemma 2` or `Paper Instruments Ultramarine` |
