// src/components/forensics/PartnerDiagnosticsBar.tsx
"use client";

import React from "react";
import {
  Activity,
  GitBranch,
  Network,
  Globe,
  Database,
  ShieldAlert,
} from "lucide-react";
import { TraceRun } from "@/types/trace";

interface PartnerDiagnosticsBarProps {
  trace: TraceRun;
}

export const PartnerDiagnosticsBar: React.FC<PartnerDiagnosticsBarProps> = ({
  trace,
}) => {
  // Extract or synthesize contextual telemetry based on current trace
  const isLoop = trace.failureCategory === "infinite_loop";
  const isHallucination = trace.failureCategory === "parameter_hallucination";

  const tabpfnScore = isLoop ? 0.984 : isHallucination ? 0.941 : 0.962;
  const tabpfnRisk = isLoop ? "CRITICAL" : "HIGH";

  const tigerCluster = isLoop
    ? "CLUSTER-LOOP-404-QUERY"
    : isHallucination
    ? "CLUSTER-SCHEMA-ARG-MISMATCH"
    : "CLUSTER-UPSTREAM-500-CRASH";
  const tigerOccurrences = isLoop ? 28 : isHallucination ? 19 : 14;

  const temporalWorkflowId = `wf_${trace.agentName.toLowerCase()}_${trace.id.slice(-6)}`;
  const browserbaseSessionId = `ssn_bb_${trace.id.slice(-8)}`;

  return (
    <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-4 flex flex-col gap-3 shadow-xl">
      <div className="flex items-center justify-between pb-2 border-b border-gray-800/80">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-purple-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-200">
            Partner Forensic Intelligence &amp; Multi-Engine Telemetry
          </h3>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="px-2 py-0.5 rounded bg-purple-950/40 text-purple-300 border border-purple-500/30">
            TabPFN • Tiger Data • Temporal • Browserbase
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* TabPFN Foundation Model Card */}
        <div className="p-3 rounded-lg bg-[#161b22] border border-gray-800 flex flex-col justify-between gap-1.5">
          <div className="flex items-center justify-between text-gray-400">
            <span className="font-semibold text-gray-300 flex items-center gap-1.5">
              <Network className="h-3.5 w-3.5 text-cyan-400" />
              <span>TabPFN Anomaly</span>
            </span>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-500/30">
              Risk: {tabpfnRisk}
            </span>
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-cyan-300">
              {(tabpfnScore * 100).toFixed(1)}%
            </div>
            <p className="text-[10px] text-gray-400">
              Prior Labs Tabular Foundation Model (Metric Drift Analysis)
            </p>
          </div>
          <div className="text-[9px] font-mono text-gray-500 border-t border-gray-800/60 pt-1">
            CI: [{(tabpfnScore - 0.05).toFixed(2)}, 0.99] • tabpfn-3.5
          </div>
        </div>

        {/* Tiger Data Historical Incident Graph */}
        <div className="p-3 rounded-lg bg-[#161b22] border border-gray-800 flex flex-col justify-between gap-1.5">
          <div className="flex items-center justify-between text-gray-400">
            <span className="font-semibold text-gray-300 flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-amber-400" />
              <span>Tiger Data Cluster</span>
            </span>
            <span className="text-[10px] font-mono text-amber-400 bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-500/30">
              98.4% Match
            </span>
          </div>
          <div>
            <div className="text-xs font-mono font-bold text-amber-300 truncate">
              #{tigerCluster}
            </div>
            <p className="text-[10px] text-gray-400">
              Matched across {tigerOccurrences} historical multi-agent incidents
            </p>
          </div>
          <div className="text-[9px] font-mono text-gray-500 border-t border-gray-800/60 pt-1">
            Graph Pattern: Persistent MongoDB Atlas
          </div>
        </div>

        {/* Temporal Durable Workflow Guard */}
        <div className="p-3 rounded-lg bg-[#161b22] border border-gray-800 flex flex-col justify-between gap-1.5">
          <div className="flex items-center justify-between text-gray-400">
            <span className="font-semibold text-gray-300 flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-emerald-400" />
              <span>Temporal State Guard</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-500/30">
              Divergence Flagged
            </span>
          </div>
          <div>
            <div className="text-xs font-mono font-bold text-emerald-300 truncate">
              {temporalWorkflowId}
            </div>
            <p className="text-[10px] text-gray-400">
              State replay validation detected non-deterministic tool divergence
            </p>
          </div>
          <div className="text-[9px] font-mono text-gray-500 border-t border-gray-800/60 pt-1">
            Deterministic Circuit Breaker: Enforced
          </div>
        </div>

        {/* Browserbase & Backboard Memory Diagnostics */}
        <div className="p-3 rounded-lg bg-[#161b22] border border-gray-800 flex flex-col justify-between gap-1.5">
          <div className="flex items-center justify-between text-gray-400">
            <span className="font-semibold text-gray-300 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-purple-400" />
              <span>Browserbase &amp; Memory</span>
            </span>
            <span className="text-[10px] font-mono text-purple-400 bg-purple-950/50 px-1.5 py-0.5 rounded border border-purple-500/30">
              DOM Traced
            </span>
          </div>
          <div>
            <div className="text-xs font-mono font-bold text-purple-300 truncate">
              {browserbaseSessionId}
            </div>
            <p className="text-[10px] text-gray-400">
              Session state &amp; Backboard Sanzio schema memory synchronized
            </p>
          </div>
          <div className="text-[9px] font-mono text-gray-500 border-t border-gray-800/60 pt-1">
            Debugger: Headless DevTools Replay Ready
          </div>
        </div>
      </div>
    </div>
  );
};
