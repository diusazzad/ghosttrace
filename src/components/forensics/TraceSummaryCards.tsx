"use client";

import React from "react";
import { AlertCircle, Clock, Zap, DollarSign, Layers, Info } from "lucide-react";
import { TraceRun } from "@/types/trace";

interface TraceSummaryCardsProps {
  trace: TraceRun;
}

export const TraceSummaryCards: React.FC<TraceSummaryCardsProps> = ({ trace }) => {
  const isFixture = trace.isSampleFixture ?? true;
  const llmCount = trace.events.filter((e) => e.type === "llm").length;
  const toolCount = trace.events.filter((e) => e.type === "tool").length;
  const errorCount = trace.events.filter((e) => e.type === "error" || e.status === "error").length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Failure Category */}
      <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-rose-400">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Failure Mode</span>
            {isFixture && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-950/40 text-blue-300 border border-blue-500/30">
                Sample Fixture
              </span>
            )}
          </div>
          <AlertCircle className="h-4 w-4" />
        </div>
        <div className="mt-2">
          <div className="text-lg font-bold text-white capitalize">
            {trace.failureCategory.replace("_", " ")}
          </div>
          <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">
            {trace.failureDescription}
          </p>
        </div>
        <div className="mt-3 pt-2 border-t border-rose-500/20 text-[10px] font-mono text-rose-400 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span>STATUS: EXECUTION ABORTED</span>
          </div>
        </div>
      </div>

      {/* Latency / Execution Time */}
      <div className="p-4 rounded-xl border border-gray-800 bg-[#0d1117] flex flex-col justify-between">
        <div className="flex items-center justify-between text-gray-400">
          <span className="text-xs font-semibold uppercase tracking-wider">Total Duration</span>
          <Clock className="h-4 w-4 text-purple-400" />
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold font-mono text-white">
            {(trace.totalDurationMs / 1000).toFixed(2)}s
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Across {trace.events.length} execution milestones
          </p>
        </div>
        <div className="mt-3 pt-2 border-t border-gray-800 text-[10px] font-mono text-gray-400 flex items-center justify-between">
          <span>Started: {new Date(trace.startedAt).toLocaleTimeString()}</span>
          {isFixture && <span className="text-gray-500">Illustrative</span>}
        </div>
      </div>

      {/* Event Breakdown */}
      <div className="p-4 rounded-xl border border-gray-800 bg-[#0d1117] flex flex-col justify-between">
        <div className="flex items-center justify-between text-gray-400">
          <span className="text-xs font-semibold uppercase tracking-wider">Events &amp; Spans</span>
          <Layers className="h-4 w-4 text-blue-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-white">{trace.events.length}</span>
          <span className="text-xs text-gray-400">total spans</span>
        </div>
        <div className="mt-3 pt-2 border-t border-gray-800 flex items-center gap-3 text-[11px] font-mono">
          <span className="text-blue-400">{llmCount} LLM</span>
          <span className="text-purple-400">{toolCount} Tool</span>
          <span className="text-rose-400">{errorCount} Error</span>
        </div>
      </div>

      {/* Tokens & Cost (Truthfully labeled illustrative per Task 4) */}
      <div className="p-4 rounded-xl border border-gray-800 bg-[#0d1117] flex flex-col justify-between">
        <div className="flex items-center justify-between text-gray-400">
          <span className="text-xs font-semibold uppercase tracking-wider">
            {isFixture ? "Fixture Token Footprint" : "Token Footprint"}
          </span>
          <Zap className="h-4 w-4 text-amber-400" />
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold font-mono text-white">
            {trace.totalTokens.toLocaleString()}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            {isFixture ? "Illustrative fixture footprint" : "Total context consumed"}
          </p>
        </div>
        <div className="mt-3 pt-2 border-t border-gray-800 flex items-center justify-between text-[11px] font-mono text-emerald-400">
          <span className="flex items-center">
            <DollarSign className="h-3 w-3" />
            <span>
              {isFixture
                ? `Est. Fixture Cost: $${trace.estimatedCostUsd.toFixed(4)}`
                : `Est. Cost: $${trace.estimatedCostUsd.toFixed(4)}`}
            </span>
          </span>
          {isFixture && (
            <span className="text-[9px] font-mono text-amber-400/80 bg-amber-950/40 px-1 py-0.5 rounded border border-amber-500/20">
              Sample
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
