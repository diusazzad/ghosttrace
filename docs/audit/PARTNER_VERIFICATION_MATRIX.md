# GhostTrace — Partner Verification Matrix & Capability Audit

> **Audit Date:** October 31, 2026  
> **Integrations Inspected:** 12 Technologies (Featured, Partner & Infrastructure)  
> **Standard:** Clear differentiation between Implemented, Mocked, Fallback, and Live Verified.

---

## 1. Classification Definitions

- **Live Verified:** Connected to real production cloud/external APIs with verified execution, network logs, or cloud event IDs.
- **Implemented with Grounded Fallback:** Full production client SDK / adapter implemented with real schemas, accompanied by a deterministic local fallback when external keys are not provided.
- **Configured & Ready:** Environment variable schemas, credential parsing, and runtime wiring configured.
- **Mocked:** Static mocked data used for testing isolation.

---

## 2. Detailed Verification Matrix

| Partner / Service | Category | Implementation Scope | Execution Mode | Verification Evidence |
| :--- | :---: | :--- | :--- | :--- |
| **MongoDB Atlas** | Database | Multi-tenant storage layer, compound indexes, unique constraints | **Live Verified** | Connected to `ghosttrace.ejhtxb3.mongodb.net`. Verified indexes `ownerId_1_traceId_1`, `ownerId_1_createdAt_-1`, `ownerId_1_primaryFailureCategory_1`. Error 11000 collision confirmed. |
| **Sentry** | Observability | OpenTelemetry GenAI spans, agent action breadcrumbs, error delivery | **Live Verified** | Live ingestion to `raw-axiom/ghosttrace`. Event ID `881b9d3b41e541328576d347070aceae` successfully flushed to cloud. |
| **Auth0 v4** | Identity | Server SDK session validation, proxy routes, multi-tenant guard | **Live Verified (Cloud + Tests)** | 18/18 passing tests in `src/__tests__/auth0.test.ts`. Live production Universal Login and authenticated session verified at `https://ghosttrace-s26u.onrender.com/`. |
| **Render** | Deployment | Next.js 16 Web Service IaC deployment | **Live Verified** | Live production deployment active at `https://ghosttrace-s26u.onrender.com/` with automated deployments from GitHub `main` branch and blueprint `render.yaml`. |
| **Mastra** | Workflow | 4-step forensic investigation workflow (`Mastra Core v1.80.0`) | **Implemented (Local Engine)** | 4 tests passing in `src/__tests__/mastraWorkflow.test.ts`. Full graph synthesis and state machine. |
| **Google Gemma** | AI Model | `google/gemma-2-9b-it` counterfactual reasoning & grounding defense | **Implemented + Local Fallback** | Remote Backboard API call with deterministic offline rule-based fallback (`src/__tests__/gemmaAdapter.test.ts`). |
| **Entire CLI** | Developer Tool | Session checkpoints, Antigravity hooks, commit trailers | **Implemented (Local Git-Refs)** | Entire CLI v0.12.2 registered. Local checkpoints captured in `refs/entire/checkpoints/`. `push_sessions: false`. |
| **Ultramarine** | AI Reasoning | `ultramarine-1-flash` via OpenAI SDK, pricing formula, Zod output | **Implemented + Grounded Fallback** | API provider in `src/lib/ai/ultramarineAdapter.ts`. Token cost formula verified ($0.15/1M in, $0.60/1M out). Grounded deterministic fallback when run without cloud key. |
| **Backboard** | AI Studio | Gemma 2 27B provider, memory grounding, retry handling | **Implemented + Offline Fallback** | Provider in `src/lib/ai/backboardAdapter.ts`. Grounding defense tested against network timeouts. |
| **Browserbase** | Automation | Headless Chromium session replay, DOM diff and console capture | **Implemented (UI Viewer)** | Trace viewer in `src/lib/browser/browserbaseAdapter.ts`. |
| **Temporal** | Orchestration | Durable workflow execution, retry policies, state recovery | **Implemented (Workflow Spec)** | Orchestrator in `src/lib/temporal/temporalAdapter.ts`. |
| **Tiger Data** | Vector / Graph | Knowledge graph and pattern similarity store with pgvector | **Implemented (Knowledge Graph)** | Knowledge graph in `src/lib/tiger/tigerDataAdapter.ts`. |
| **TabPFN** | Foundation Model | Tabular foundation model for anomaly prediction | **Configured** | `TABPFN_API_KEY` configured in `.env.local` and Render environment. |

---

## 3. Honesty & Boundary Declarations

1. **Ultramarine & Backboard Live Remote Inference:**  
   In the absence of live production API keys for Ultramarine and Backboard in the local test environment, both providers gracefully fall back to deterministic rule-based counterfactual reasoning. They are **not** falsely reported as live cloud inferences.
2. **Entire CLI Public vs Local Refs:**  
   Entire checkpoints are stored locally inside the `.git/refs/entire/checkpoints/` namespace and are never pushed to public Git remotes (`push_sessions: false`), ensuring that sensitive developer conversation transcripts remain private.
