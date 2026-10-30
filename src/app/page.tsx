"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { TraceSummaryCards } from "@/components/forensics/TraceSummaryCards";
import { WaterfallTimeline } from "@/components/forensics/WaterfallTimeline";
import { EvidenceHypothesisCard } from "@/components/forensics/EvidenceHypothesisCard";
import { RegressionTestExporter } from "@/components/forensics/RegressionTestExporter";
import { TraceUploadModal } from "@/components/forensics/TraceUploadModal";
import { SAMPLE_TRACES } from "@/lib/sampleTraces";
import { TraceRun } from "@/types/trace";
import { Radio, Database, ShieldCheck, Terminal, Cpu } from "lucide-react";

export default function Home() {
  const [traces, setTraces] = useState<TraceRun[]>(SAMPLE_TRACES);
  const [activeTrace, setActiveTrace] = useState<TraceRun>(SAMPLE_TRACES[0]);
  const [currentTab, setCurrentTab] = useState<string>("trace");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const handleSelectTrace = (trace: TraceRun) => {
    setActiveTrace(trace);
    setSelectedEventId(null);
  };

  const handleTraceLoaded = (newTrace: TraceRun) => {
    setTraces((prev) => [newTrace, ...prev]);
    setActiveTrace(newTrace);
    setSelectedEventId(null);
  };

  const handleReAnalyze = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
    }, 1200);
  };

  return (
    <div className="flex min-h-screen bg-[#0a0d13] text-gray-100 font-sans antialiased selection:bg-purple-600/30 selection:text-purple-200">
      {/* Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        sampleCount={traces.length}
      />

      {/* Main Forensic Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Sticky Header */}
        <Header
          traces={traces}
          activeTrace={activeTrace}
          onSelectTrace={handleSelectTrace}
          onUploadClick={() => setIsUploadModalOpen(true)}
          onAnalyzeClick={handleReAnalyze}
          isAnalyzing={isAnalyzing}
        />

        {/* Dynamic Body Content by Tab */}
        <main className="flex-1 p-6 flex flex-col gap-6 max-w-7xl w-full mx-auto">
          {/* Main Trace View */}
          {(currentTab === "trace" || currentTab === "timeline") && (
            <>
              {/* Stat Metric Cards */}
              <TraceSummaryCards trace={activeTrace} />

              {/* Core 2-Column or Stacked Inspection Workspace */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left 7 Cols: Waterfall Timeline */}
                <div className="lg:col-span-7 flex flex-col gap-6">
                  <WaterfallTimeline
                    trace={activeTrace}
                    selectedEventId={selectedEventId}
                    onSelectEvent={setSelectedEventId}
                  />
                </div>

                {/* Right 5 Cols: Gemma 2 Hypothesis & Test Generator */}
                <div className="lg:col-span-5 flex flex-col gap-6 sticky top-20">
                  <EvidenceHypothesisCard
                    trace={activeTrace}
                    selectedEventId={selectedEventId}
                    onSelectEvent={setSelectedEventId}
                  />

                  <RegressionTestExporter trace={activeTrace} />
                </div>
              </div>
            </>
          )}

          {/* Dedicated Hypotheses Tab */}
          {currentTab === "hypotheses" && (
            <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
              <div className="p-6 rounded-xl border border-gray-800 bg-[#0d1117]">
                <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-blue-400" />
                  <span>Google Gemma 2 Root Cause Forensics</span>
                </h2>
                <p className="text-sm text-gray-400 leading-relaxed">
                  GhostTrace pairs open-weight Gemma 2 with strict deterministic grounding. Every failure explanation
                  must link directly to verified trace event IDs and timestamps to prevent reasoning hallucinations.
                </p>
              </div>

              <EvidenceHypothesisCard
                trace={activeTrace}
                selectedEventId={selectedEventId}
                onSelectEvent={setSelectedEventId}
              />

              <div className="p-4 rounded-xl border border-gray-800 bg-[#0d1117] flex items-center justify-between text-xs text-gray-400">
                <span>Model provider: Google Gemma 2 (9B / 27B) via Backboard / Local Ollama</span>
                <span className="font-mono text-emerald-400">Status: Verified Grounded</span>
              </div>
            </div>
          )}

          {/* Dedicated Regression Test Tab */}
          {currentTab === "regression" && (
            <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
              <div className="p-6 rounded-xl border border-gray-800 bg-[#0d1117]">
                <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-emerald-400" />
                  <span>Automated Regression Test Suite</span>
                </h2>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Export reproducible test cases synthesized from real failure traces to guarantee that your agent fixes
                  persist across model updates and prompt refactoring.
                </p>
              </div>

              <RegressionTestExporter trace={activeTrace} />
            </div>
          )}

          {/* Sentry Agent Ingestion Tab */}
          {currentTab === "live" && (
            <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
              <div className="p-6 rounded-xl border border-gray-800 bg-[#0d1117]">
                <div className="flex items-center gap-2 mb-2">
                  <Radio className="h-5 w-5 text-purple-400 animate-pulse" />
                  <h2 className="text-xl font-bold text-white">Live Agent Ingestion &amp; Sentry Spans</h2>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Stream agent telemetry directly from your Python or TypeScript agents using Sentry OpenTelemetry spans,
                  Mastra workflows, or HTTP webhooks into GhostTrace for real-time root-cause analysis.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl border border-gray-800 bg-[#0d1117]">
                  <div className="flex items-center gap-2 font-semibold text-white mb-2">
                    <Database className="h-4 w-4 text-blue-400" />
                    <span>MongoDB Atlas Storage</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Persistent archival of multi-turn traces, LLM cost trends, and regression test histories.
                  </p>
                </div>

                <div className="p-5 rounded-xl border border-gray-800 bg-[#0d1117]">
                  <div className="flex items-center gap-2 font-semibold text-white mb-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <span>Deterministic Circuit Breakers</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Instantly catches repetitive tool loops and stops run-away token billing before reaching external APIs.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Upload Modal */}
      <TraceUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onTraceLoaded={handleTraceLoaded}
      />
    </div>
  );
}
