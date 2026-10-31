---
title: "GhostTrace: Forensic Autopsy & Counterfactual Debugger for Autonomous AI Agents"
published: false
tags: devchallenge, hf26challenge, ai, opensource
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 4: Ghost in the Machine](https://dev.to/challenges/hacktoberfest-week4-2026-10-26)*

## What I Built

**GhostTrace** is an autonomous forensic autopsy platform and counterfactual debugger for AI agent workflows. 

### Theme Interpretation: "Ghost in the Machine"
In modern multi-agent systems, agents don't simply crash with stack traces; they fail silently—hallucinating tools, entering recursive loops, suffering state drift, or taking catastrophic wrong actions. These elusive failures are the true **"Ghosts in the Machine"**. 

GhostTrace ingests complex multi-step execution traces, constructs deterministic causal dependency graphs, diagnoses root causes across an 8-category failure taxonomy, and executes counterfactual reasoning with open-weight models to pinpoint exactly why and where the ghost emerged. It then automatically synthesizes reproducible Vitest regression tests so the phantom bug can never return.

---

## Demo

- **Interactive Forensics Dashboard:** Complete local Next.js 16 UI with real-time causal graph visualizer, step-by-step trace waterfall, counterfactual hypotheses generator, and test code exporter.
- **Demo Video / Live URL:** *(Insert deployed URL or video walkthrough here)*

---

## Code

{% github diusazzad/ghosttrace %}

- **Repository:** [https://github.com/diusazzad/ghosttrace](https://github.com/diusazzad/ghosttrace)
- **Open Pull Requests for Partner Categories:**
  - PR #1: `feat/mongodb-owner-isolation` (Auth0 & MongoDB Atlas)
  - PR #2: `feat/task-02-core-product-workflow` (Mastra Core, Gemma-2-9B, Sentry Agent Tracing)
  - PR #3 & #4: `feat/entire-cli-integration` (Entire CLI session tracking & git checkpoints)
  - PR #5 & #6: `feat/ultramarine-integration` (Ultramarine LLM provider & token cost tracking)
  - PR #7: `feat/backboard-integration` (Backboard Studio provider & memory grounding)
  - PR #8: `feat/browserbase-integration` (Browserbase headless session replay)
  - PR #9: `feat/temporal-integration` (Temporal durable workflow orchestration)
  - PR #10: `feat/tiger-data-integration` (Tiger Data forensic knowledge graph & pattern similarity)

---

## How I Built It

GhostTrace is engineered strictly around open-source AI and transparent agent architecture:

1. **Workflow Orchestration (Mastra Core v1.80.0):**
   A resilient 4-stage pipeline orchestrating trace parsing, structural failure detection, graph topology construction, and automated test synthesis.
2. **Open-Weight Counterfactual AI (Google Gemma 2 9B):**
   Runs inference locally via Ollama / Backboard to perform grounded counterfactual deduction without proprietary vendor lock-in.
3. **Observability & Agent Tracing (Sentry Agent Tracing):**
   Live OpenTelemetry GenAI spans capturing latency, tokens, error breadcrumbs, and step-level agent actions.
4. **Data Isolation & Persistence (MongoDB Atlas):**
   Enterprise multi-tenant database tier enforcing compound unique constraints (`ownerId_1_traceId_1`) and owner isolation.
5. **Zero-Trust Agent Auth (Auth0 v4):**
   Server-side identity verification ensuring anonymous users can never access or leak sensitive agent execution history.

---

## Why Does Open Innovation Matter?

1. **Privacy & Proprietary Trace Protection:** Agent traces frequently contain API keys, confidential customer data, internal system prompts, and proprietary database schemas. Closed commercial APIs require sending raw traces to third-party cloud servers. GhostTrace allows entire organizations to run forensic investigations completely on-premises with open-weight models.
2. **Deterministic Reproducibility:** Closed APIs change weights and prompt behaviors behind the scenes. Open-weight models like Gemma and open frameworks like Mastra and Temporal ensure that a forensic finding diagnosed today will yield the exact same deterministic autopsy results tomorrow.
3. **No Per-Investigation Toll:** Large agent teams execute thousands of trace autopsies daily; open innovation eliminates crippling token billing for debugging infrastructure.

---

## My Agent Session

We captured and preserved our entire AI development lifecycle with **Entire CLI** and **DevRelay**:

- **Checkpoints:** Immutable Git-backed session checkpoints captured locally under `refs/entire/checkpoints/` and tagged on commits with `Entire-Checkpoint` trailers.
- *(Optional DevRelay Liquid tag)*:
  ```liquid
  {% agent_session https://devrelay.com/sessions/diusazzad/ghosttrace %}
  ```

---

## Prize Categories

We are entering the following categories:

### Featured Categories ($200)
- **Best Use of Gemma:** Running `google/gemma-2-9b-it` for counterfactual hypothesis deduction and rule-based grounding defense.
- **Best Use of TabPFN:** Provisioned tabular foundation model for anomaly prediction and trace metric classification.

### Partner Categories ($100)
- **Best Use of Auth0 for AI Agents:** Enforcing multi-tenant session verification and owner-isolated data access.
- **Best Use of MongoDB Atlas:** Verified live Atlas cluster with compound indexing, unique collision detection, and owner scoping.
- **Best Use of Sentry Agent Tracing:** Live OpenTelemetry GenAI spans, agent action breadcrumbs, and real-time cloud event delivery.
- **Best Use of Mastra:** 4-step Mastra Core resilient agent workflow orchestration.
- **Best Use of Entire:** Entire CLI v0.12.2 session capture, Git checkpoint refs, and immutable commit audit trails.
- **Best Use of Ultramarine:** Ultramarine-1-flash provider integration with token cost calculation and structured Zod output.
- **Best Use of Backboard:** Backboard Studio provider integration with offline deterministic grounding defense.
- **Best Use of Browserbase:** Headless browser session replay and DOM state capture for web agent failures.
- **Best Use of Temporal:** Temporal durable execution engine with automatic activity retries and fault recovery.
- **Best Use of Tiger Data:** Forensic knowledge graph and vector similarity search for historical failure patterns.
