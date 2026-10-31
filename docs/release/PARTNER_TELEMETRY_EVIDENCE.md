# Partner Telemetry Evidence & Integration Audit

**Project:** GhostTrace  
**Date:** October 31, 2026  
**Auditor:** AI Observability Architect  

---

## Shared Partner Telemetry Contract

GhostTrace standardizes all partner integrations under a truthful status contract:
```typescript
export type PartnerStatus =
  | "connected"
  | "executed"
  | "not_configured"
  | "unavailable"
  | "failed"
  | "simulated";

export type TelemetrySource = "live" | "fixture";
```

---

## Detailed Partner Verification Matrix

| Partner | Integration Type | Backend Adapter | Live Verified Capability | Fallback / Fixture Behavior | Status Contract |
|---|---|---|---|---|---|
| **Google Gemma 2** | Root-Cause Reasoning | `src/lib/ai/gemmaAdapter.ts` | Schema-enforced causal diagnosis, hallucination validation | `Rule-Based Deterministic Grounding Engine` with verified timeline citations | `executed` (when live) / `simulated` (in fixtures) |
| **Paper Instruments (Ultramarine)** | High-Reasoning LLM | `src/lib/ai/ultramarineAdapter.ts` | Live inference to `https://api.paperinstruments.com/v1`, PII redaction | Structured error trapping, transient 502/503 retry with exponential backoff | `connected` / `executed` |
| **Backboard Studio / Sanzio** | Session Tracing | `src/lib/ai/backboardAdapter.ts` | Trace redaction, `/v1/chat/completions` dispatch | Live probe on `/v1/models` in `/api/health`, fallback to deterministic engine | `connected` / `degraded_fallback` |
| **Sentry** | Distributed Tracing | `src/lib/telemetry/sentryTracer.ts` | OpenTelemetry gen_ai spans, agent breadcrumbs | Cloud flushed event verification (Event ID `881b9d3b41e541328576d347070aceae`) | `connected` |
| **MongoDB Atlas** | Archival & Multi-Tenant Storage | `src/lib/db/mongodb.ts`, `traceRepository.ts` | Multi-tenant compound index verification (`ownerId: 1, traceId: 1`) | In-memory session store when unconfigured | `connected` / `in_memory_fallback` |
| **Auth0 by Okta** | Identity & Access Control | `src/lib/auth/auth0.ts` | Canonical `sub` claims extraction, SSR token isolation | Guest Session fallback with visible indicator | `configured` / `not_configured` |
| **TabPFN** | Foundation Model Drift | `src/components/forensics/PartnerDiagnosticsBar.tsx` | Metric drift risk prediction | Explicitly labeled `Simulated Demo` in fixture traces | `simulated` / `not_configured` |
| **Tiger Data** | Incident Graph Clustering | `src/lib/tiger/tigerDataAdapter.ts` | Graph schema (`vertices`, `edges`, similarity matching) | Explicitly labeled `Simulated Demo` in fixture traces | `simulated` / `not_configured` |
| **Temporal** | State Replay Guard | `src/lib/temporal/temporalAdapter.ts` | Workflow schema, durable replay execution checks | Explicitly labeled `Simulated Demo` in fixture traces | `simulated` / `not_configured` |
| **Browserbase** | Headless Session Tracing | `src/lib/browser/browserbaseAdapter.ts` | Session schema, DevTools debugger URL generator | Explicitly labeled `Simulated Demo` in fixture traces | `simulated` / `not_configured` |

---

## Ethical Disclosure Guidelines

1. **No Synthetic Live Metrics:** GhostTrace never presents synthetic numbers as live server execution.
2. **Provenance Banners:** When inspecting pre-bundled sample traces, the UI explicitly flags `Data Source: Illustrative Fixture Trace`.
3. **Trace Citation Separation:** Model-generated citations and rule-detected anomalies are rendered under distinct visual blocks.
