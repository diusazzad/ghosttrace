# GhostTrace 🔍👻

> Evidence-backed forensic debugger and root cause analyzer for AI agents.
> Built for DEV Challenge: **Hacktoberfest 2026 Week 4 — "Ghost in the Machine"**.

---

## ⚡ What is GhostTrace?

When multi-step AI agents fail—looping endlessly, hallucinating tool parameters, corrupting context, or crashing on edge cases—developers face massive token dumps without clear causal links.

GhostTrace ingests execution traces, deterministically reconstructs an interactive waterfall timeline, leverages open-weight **Google Gemma 2** to hypothesize root causes, and strictly validates hypotheses against verified event IDs to eliminate hallucinated explanations.

### Key Capabilities
- **Deterministic Timeline Engine**: Reconstructs LLM calls, tool executions, and state mutations offline with zero hallucinations.
- **Evidence-Grounded Root Cause Analysis**: Links failure hypotheses to exact event IDs and timestamp offsets.
- **Reproducible Test Exporter**: Generates executable regression test cases directly from failure traces.
- **Hacktoberfest 2026 Integrations**:
  - Google Gemma 2 (Local Ollama / Backboard API)
  - Mastra Agent Framework
  - Sentry Agent Tracing & Spans
  - MongoDB Atlas Trace History Store
  - Render Production Hosting

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 20.x
- pnpm >= 9.x
- (Optional) Local Ollama running `gemma2:9b` or Backboard API Key

### Installation

```bash
# Clone the repository
git clone https://github.com/diusazzad/ghosttrace.git
cd ghosttrace

# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env.local

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

---

## 🧪 Testing & Verification

```bash
# Run unit & integration tests
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Production build
pnpm build
```

---

## 📄 License

MIT © 2026 [Sazzad Hossain](https://github.com/diusazzad)
