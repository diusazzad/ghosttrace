# PR 14 Audit & Review Findings: Forensic Evidence Integrity & Truthful Telemetry

**Document Version:** 1.0.0  
**Date:** October 31, 2026  
**Auditor:** Senior Staff Engineer, AI Observability Architect & Data Integrity Auditor  
**Status:** Remediated & Verified  

---

## Executive Summary

Following a deep forensic audit of PR #12 and PR #13, critical integrity gaps were identified where synthetic metrics, model attributions, and partner states were ambiguously presented in the UI. 

This remediation PR (`fix/evidence-integrity-and-telemetry-truthfulness`) enforces strict boundaries between:
1. **Live Executed Telemetry** (real network calls to verified provider APIs).
2. **Deterministic Timeline Analysis** (deterministic rules-based heuristics without remote LLM execution).
3. **Illustrative Sample Fixtures** (clearly labeled mock data used for regression tests and offline UI demos).

---

## Detailed Findings & Remediations

### Finding 1: Fake Live Partner Telemetry in `PartnerDiagnosticsBar.tsx` (P0)
- **Previous State:** TabPFN scores, Tiger Data cluster match percentages, Temporal workflow IDs (`wf_...`), and Browserbase session IDs (`ssn_bb_...`) were deterministically generated based on failure categories and presented as live executions.
- **Remediation:** 
  - Standardized on a shared status contract (`connected`, `executed`, `not_configured`, `unavailable`, `failed`, `simulated`).
  - Added explicit `Data Source: Illustrative Fixture Trace` vs `Data Source: Live Captured Ingestion` provenance badge.
  - Cards now display `Simulated Demo` / `Not Configured` rather than unverified live metrics.

### Finding 2: Inaccurate Gemma Model Attribution (P0)
- **Previous State:** Deterministic rule-based diagnostics displayed `Google Gemma 2` as the model name, even when local Ollama was offline and Backboard was unconfigured.
- **Remediation:**
  - Explicitly decoupled deterministic fallback from LLM inference.
  - UI banner and model name updated to:
    - **Header:** `Deterministic Forensic Engine Active`
    - **Body:** `Rule-based analysis completed successfully. LLM inference was not used for this investigation. Event references were validated against the original trace.`
    - **Engine Label:** `Engine: Rule-Based Deterministic Grounding Engine` (provider: `deterministic_rules`).

### Finding 3: Conflation of Model Citations & System Anomalies (P1)
- **Previous State:** `EvidenceHypothesisCard.tsx` fell back to rendering system-detected error events under the heading `Causal Event Citations`, creating the false impression that an LLM model had specifically cited those events.
- **Remediation:**
  - Created two strictly separate UI sections:
    1. `Model-Supplied Evidence Citations (Validated Event References)`: Shown only when model outputs citation IDs and each ID is verified against real trace event IDs in `trace.events`.
    2. `System-Detected Anomaly Events (Rule-Based Timeline Heuristics)`: Distinctly labeled timeline anomalies.
  - Eliminated `any` casts with typed evidence structures.

### Finding 4: Sample Trace Provenance & Token Footprints (P1)
- **Previous State:** Demo trace `trace-tool-crash-004` displayed 640 tokens and $0.0019 as if it were a billed live inference.
- **Remediation:**
  - Added `isSampleFixture: true` and `fixtureDisclaimer` to all bundled demo traces.
  - `TraceSummaryCards.tsx` now explicitly displays `Fixture Token Footprint`, `Illustrative fixture footprint`, and `Est. Fixture Cost: $0.0019 (Sample)` to prevent misrepresenting fixtures as live cloud billing.

### Finding 5: Health Endpoint Bounded Connectivity (P1)
- **Previous State:** `/api/health` unconditionally returned `status: "healthy"` and reported `backboard_remote` based on environment variable existence rather than actual connectivity.
- **Remediation:**
  - Added bounded 1.8-second live probe (`/v1/models`) to Backboard API.
  - Truthfully reports `provider: "deterministic_rules"` and `status: "degraded_fallback"` when Backboard is unreachable or unconfigured.
  - Added `liveness: "alive"` and `readiness: "ready" | "degraded_deterministic"`.

### Finding 6: Auth0 Environment in Render Blueprint (P1)
- **Previous State:** `render.yaml` was missing `AUTH0_DOMAIN` and `APP_BASE_URL`.
- **Remediation:**
  - Added both required Auth0 SDK v4 variables to `render.yaml` with `sync: false`.
  - Added trailing-slash normalization to `auth0.ts` to prevent URL mismatch issues.
