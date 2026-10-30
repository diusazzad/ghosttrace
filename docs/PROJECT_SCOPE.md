# GhostTrace — Architectural Scope & Engineering Constraints

## Overview
**GhostTrace** is an evidence-backed forensic debugger and root cause analyzer for AI agents, built for the Hacktoberfest 2026 Week 4 "Ghost in the Machine" challenge.

When multi-step AI agents fail (loop infinitely, hallucinate tool parameters, corrupt memory context, or trigger unhandled exceptions), developers struggle to pin down *why*. Traditional logging dumps massive unindexed tokens; APMs capture spans without agent-semantic context.

GhostTrace solves this by:
1. Ingesting structured execution traces (JSON/OpenTelemetry).
2. Deterministically parsing and building an interactive waterfall timeline of events (LLM calls, tool executions, memory read/writes).
3. Utilizing open-weight **Google Gemma 2** to formulate concrete hypotheses about the failure mode.
4. Grounding and validating every hypothesis against actual trace event IDs, preventing hallucinated explanations.
5. Exporting reproducible regression test cases to verify agent fixes.

---

## Architectural Principles & Non-Negotiables
1. **Evidence-Grounded**: An explanation is rejected unless it references verified event IDs and timestamps in the trace.
2. **Deterministic Baseline**: Core timeline reconstruction, span aggregation, and structural anomaly detection work 100% offline without requiring LLM calls.
3. **Zero Secrets in Git**: No API keys, credentials, or personal connection strings in source control. All secrets are loaded through environment variables.
4. **Partner Track Integrity**: Only claim eligibility for Hacktoberfest sponsor tracks (Gemma, Render, Sentry, Mastra, MongoDB) where full, working, and verifiable integration code exists.
5. **No Code Reuse from Week 3**: GhostTrace is an entirely clean, standalone TypeScript/Next.js repository built from scratch for Week 4.
