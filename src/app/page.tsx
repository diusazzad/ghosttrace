import { Ghost, ShieldAlert, Cpu, Activity, Play, Terminal, Database, CheckCircle2 } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0d13] text-gray-100 flex flex-col font-sans selection:bg-purple-600/30 selection:text-purple-200">
      {/* Top Navigation */}
      <header className="border-b border-gray-800/80 bg-[#0d1117]/80 backdrop-blur px-6 py-3.5 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Ghost className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-lg text-white">GhostTrace</span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Forensics v0.1.0
              </span>
            </div>
            <p className="text-xs text-gray-400">AI Agent Failure Investigator & Grounded Debugger</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Deterministic Engine Active</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Cpu className="h-3.5 w-3.5" />
            <span>Gemma 2 Ready</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Hero Section */}
        <section className="rounded-xl border border-gray-800 bg-[#0d1117] p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-purple-400 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 mb-4">
              <Terminal className="h-3.5 w-3.5" />
              <span>Hacktoberfest 2026 — Ghost in the Machine</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
              Unmask the Ghost Behind AI Agent Failures
            </h1>
            <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-6">
              When autonomous multi-step agents hallucinate tool arguments, loop infinitely, or crash unexpectedly,
              GhostTrace deterministically reconstructs execution timelines, hypothesizes root causes using Google Gemma 2,
              and rigorously validates every finding against verifiable event IDs.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition shadow-lg shadow-purple-600/25">
                <Play className="h-4 w-4" />
                <span>Load Sample Failure Trace</span>
              </button>
              <a
                href="/api/health"
                target="_blank"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-800/80 hover:bg-gray-800 text-gray-200 text-sm border border-gray-700 transition"
              >
                <Activity className="h-4 w-4 text-emerald-400" />
                <span>Health Endpoint</span>
              </a>
            </div>
          </div>
        </section>

        {/* Feature Cards Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl border border-gray-800 bg-[#0d1117] flex flex-col gap-3">
            <div className="h-9 w-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Activity className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-white">Waterfall Timeline Engine</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Deterministic parsing of tool calls, prompt tokens, state mutations, and error spans without token hallucinations.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-gray-800 bg-[#0d1117] flex flex-col gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-white">Grounded Root Cause Hypotheses</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Powered by Google Gemma 2. Strict validation ensures every hypothesis cites exact, non-hallucinated trace event IDs.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-gray-800 bg-[#0d1117] flex flex-col gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Database className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-white">Regression Test Exporter</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Instantly converts identified failure sequences into reproducible Vitest / Jest test suites to prevent regressions.
            </p>
          </div>
        </section>

        {/* Integration Status Table */}
        <section className="rounded-xl border border-gray-800 bg-[#0d1117] p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-purple-400" />
            <span>Hacktoberfest 2026 Partner Architecture</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-3 rounded-lg bg-black/40 border border-gray-800/80">
              <span className="text-gray-500 block mb-1">AI Reasoning</span>
              <span className="text-white font-medium">Google Gemma 2</span>
            </div>
            <div className="p-3 rounded-lg bg-black/40 border border-gray-800/80">
              <span className="text-gray-500 block mb-1">Workflow Engine</span>
              <span className="text-white font-medium">Mastra Core</span>
            </div>
            <div className="p-3 rounded-lg bg-black/40 border border-gray-800/80">
              <span className="text-gray-500 block mb-1">Observability</span>
              <span className="text-white font-medium">Sentry Agent Spans</span>
            </div>
            <div className="p-3 rounded-lg bg-black/40 border border-gray-800/80">
              <span className="text-gray-500 block mb-1">Deployment</span>
              <span className="text-white font-medium">Render Production</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/80 bg-[#0d1117] px-6 py-4 text-center text-xs text-gray-500">
        GhostTrace &bull; Open Source AI Forensic Debugger &bull; Hacktoberfest 2026
      </footer>
    </div>
  );
}
