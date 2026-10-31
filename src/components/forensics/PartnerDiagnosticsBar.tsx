// src/components/forensics/PartnerDiagnosticsBar.tsx
"use client";

import React from "react";
import {
  Activity,
  GitBranch,
  Network,
  Globe,
  Database,
  Info,
} from "lucide-react";
import { TraceRun, PartnerStatus, TelemetrySource } from "@/types/trace";

interface PartnerDiagnosticsBarProps {
  trace: TraceRun;
}

export const PartnerDiagnosticsBar: React.FC<PartnerDiagnosticsBarProps> = ({
  trace,
}) => {
  const isFixture = trace.isSampleFixture ?? true;
  const source: TelemetrySource = isFixture ? "fixture" : "live";

  // Use real backend diagnostic result if present, otherwise explicit fixture telemetry
  const customDiagnostics = trace.partnerDiagnostics;

  const isLoop = trace.failureCategory === "infinite_loop";
  const isHallucination = trace.failureCategory === "parameter_hallucination";

  // TabPFN diagnostic state
  const tabpfnStatus: PartnerStatus = customDiagnostics?.tabpfn?.status ?? (isFixture ? "simulated" : "not_configured");
  const tabpfnValue = customDiagnostics?.tabpfn?.metricValue ?? (isLoop ? "98.4%" : isHallucination ? "94.1%" : "96.2%");

  // Tiger Data diagnostic state
  const tigerStatus: PartnerStatus = customDiagnostics?.tigerData?.status ?? (isFixture ? "simulated" : "not_configured");
  const tigerCluster = customDiagnostics?.tigerData?.metricValue ?? (isLoop ? "#CLUSTER-LOOP-404" : isHallucination ? "#CLUSTER-ARG-MISMATCH" : "#CLUSTER-UPSTREAM-500");

  // Temporal diagnostic state
  const temporalStatus: PartnerStatus = customDiagnostics?.temporal?.status ?? (isFixture ? "simulated" : "not_configured");
  const temporalWorkflowId = customDiagnostics?.temporal?.executionId ?? (isFixture ? `sim_wf_${trace.id.slice(-6)}` : "None");

  // Browserbase diagnostic state
  const browserbaseStatus: PartnerStatus = customDiagnostics?.browserbase?.status ?? (isFixture ? "simulated" : "not_configured");
  const browserbaseSessionId = customDiagnostics?.browserbase?.executionId ?? (isFixture ? `sim_bb_${trace.id.slice(-8)}` : "None");

  const getStatusBadge = (status: PartnerStatus, itemSource: TelemetrySource) => {
    switch (status) {
      case "connected":
      case "executed":
        return (
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-500/30">
            {itemSource === "live" ? "Live Executed" : "Verified Fixture"}
          </span>
        );
      case "simulated":
        return (
          <span className="text-[10px] font-mono text-amber-300 bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-500/30">
            Simulated Demo
          </span>
        );
      case "not_configured":
      case "unavailable":
      default:
        return (
          <span className="text-[10px] font-mono text-gray-400 bg-gray-800/60 px-1.5 py-0.5 rounded border border-gray-700/50">
            Not Configured
          </span>
        );
    }
  };

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
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
            <Info className="h-3 w-3 text-cyan-400" />
            <span>
              {isFixture
                ? "Data Source: Illustrative Fixture Trace"
                : "Data Source: Live Captured Ingestion"}
            </span>
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
            {getStatusBadge(tabpfnStatus, source)}
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-cyan-300">
              {tabpfnValue}
            </div>
            <p className="text-[10px] text-gray-400">
              Prior Labs Tabular Foundation Model (Metric Drift Analysis)
            </p>
          </div>
          <div className="text-[9px] font-mono text-gray-500 border-t border-gray-800/60 pt-1">
            {isFixture ? "Mode: Illustrative TabPFN Demo" : "Mode: Live TabPFN SDK Probe"}
          </div>
        </div>

        {/* Tiger Data Historical Incident Graph */}
        <div className="p-3 rounded-lg bg-[#161b22] border border-gray-800 flex flex-col justify-between gap-1.5">
          <div className="flex items-center justify-between text-gray-400">
            <span className="font-semibold text-gray-300 flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-amber-400" />
              <span>Tiger Data Cluster</span>
            </span>
            {getStatusBadge(tigerStatus, source)}
          </div>
          <div>
            <div className="text-xs font-mono font-bold text-amber-300 truncate">
              {tigerCluster}
            </div>
            <p className="text-[10px] text-gray-400">
              Historical incident clustering via graph embeddings
            </p>
          </div>
          <div className="text-[9px] font-mono text-gray-500 border-t border-gray-800/60 pt-1">
            {isFixture ? "Graph Pattern: Simulated Fixture Trace" : "Graph Pattern: Persistent MongoDB Atlas"}
          </div>
        </div>

        {/* Temporal Durable Workflow Guard */}
        <div className="p-3 rounded-lg bg-[#161b22] border border-gray-800 flex flex-col justify-between gap-1.5">
          <div className="flex items-center justify-between text-gray-400">
            <span className="font-semibold text-gray-300 flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-emerald-400" />
              <span>Temporal State Guard</span>
            </span>
            {getStatusBadge(temporalStatus, source)}
          </div>
          <div>
            <div className="text-xs font-mono font-bold text-emerald-300 truncate">
              {temporalWorkflowId}
            </div>
            <p className="text-[10px] text-gray-400">
              Durable execution state replay &amp; divergence detection
            </p>
          </div>
          <div className="text-[9px] font-mono text-gray-500 border-t border-gray-800/60 pt-1">
            {isFixture ? "Guard: Simulated Fixture Blueprint" : "Guard: Live Temporal Server"}
          </div>
        </div>

        {/* Browserbase & Backboard Memory Diagnostics */}
        <div className="p-3 rounded-lg bg-[#161b22] border border-gray-800 flex flex-col justify-between gap-1.5">
          <div className="flex items-center justify-between text-gray-400">
            <span className="font-semibold text-gray-300 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-purple-400" />
              <span>Browserbase &amp; Memory</span>
            </span>
            {getStatusBadge(browserbaseStatus, source)}
          </div>
          <div>
            <div className="text-xs font-mono font-bold text-purple-300 truncate">
              {browserbaseSessionId}
            </div>
            <p className="text-[10px] text-gray-400">
              Headless browser session tracing &amp; Backboard memory
            </p>
          </div>
          <div className="text-[9px] font-mono text-gray-500 border-t border-gray-800/60 pt-1">
            {isFixture ? "Debugger: Demo Fixture Session" : "Debugger: Live Browserbase Session"}
          </div>
        </div>
      </div>
    </div>
  );
};
