"use client";

import React, { useState } from "react";
import {
  Sparkles,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  FileCheck2,
  Cpu,
  Coins,
  ShieldAlert,
  Info,
} from "lucide-react";
import { TraceRun } from "@/types/trace";

interface EvidenceHypothesisCardProps {
  trace: TraceRun;
  selectedEventId: string | null;
  onSelectEvent: (eventId: string | null) => void;
}

export const EvidenceHypothesisCard: React.FC<EvidenceHypothesisCardProps> = ({
  trace,
  selectedEventId,
  onSelectEvent,
}) => {
  const [activeView, setActiveView] = useState<"current" | "ultramarine">(
    "current"
  );

  const { hypothesis, ultramarineInvestigation } = trace;
  const isUltramarineSelected =
    activeView === "ultramarine" &&
    ultramarineInvestigation !== undefined &&
    ultramarineInvestigation !== null;

  const currentDisplay = (isUltramarineSelected && ultramarineInvestigation)
    ? {
        title: ultramarineInvestigation.investigation.summary,
        model: `Paper Instruments (ultramarine-1-flash)`,
        provider: "paperinstruments" as const,
        executionMode: "live_inference" as const,
        latencyMs: ultramarineInvestigation.latencyMs,
        explanation: ultramarineInvestigation.investigation.rootCause,
        groundedEventIds:
          ultramarineInvestigation.evidenceValidation.validEventIds as string[],
        confidence: ultramarineInvestigation.evidenceValidation
          .causalClaimUnverified
          ? 0.75
          : 0.96,
        validationStatus: (ultramarineInvestigation.evidenceValidation
          .eventReferenceValid
          ? "grounded"
          : "hallucination_flagged") as "grounded" | "hallucination_flagged",
        suggestedFix: ultramarineInvestigation.investigation.remediation,
        uncertaintyWarnings:
          ultramarineInvestigation.investigation.uncertaintyWarnings as string[],
        evidenceValidation: ultramarineInvestigation.evidenceValidation,
        cost: ultramarineInvestigation.cost,
        tokenUsage: ultramarineInvestigation.tokenUsage,
        fallbackReason: undefined,
      }
    : hypothesis;

  const isFallback =
    currentDisplay.executionMode === "deterministic_fallback" ||
    currentDisplay.provider === "deterministic_rules" ||
    currentDisplay.provider === "deterministic";

  const validationInfo = currentDisplay.evidenceValidation;
  const isUltramarineProvider =
    currentDisplay.provider === "paperinstruments" ||
    currentDisplay.provider === "ultramarine";

  // Validate citations against actual trace events
  const allValidEventIds = new Set(trace.events.map((e) => e.id));
  
  // Model-supplied evidence citations
  const modelSuppliedCitations = Array.from(
    new Set(
      (currentDisplay.groundedEventIds || []).filter(
        (id) => typeof id === "string" && allValidEventIds.has(id)
      )
    )
  );

  // System-detected anomaly events from deterministic heuristics
  const systemAnomalyIds = Array.from(
    new Set(
      trace.events
        .filter((e) => e.isCausalAnomaly || e.status === "error")
        .map((e) => e.id)
    )
  );

  return (
    <div
      className={`rounded-xl border ${
        isUltramarineProvider
          ? "border-cyan-500/40 shadow-cyan-950/20"
          : "border-purple-500/30"
      } bg-[#0d1117] overflow-hidden flex flex-col shadow-xl`}
    >
      {/* Top Provider Switcher (when both baseline and Ultramarine exist) */}
      {ultramarineInvestigation && (
        <div className="flex border-b border-gray-800 bg-[#161b22]/90 text-xs">
          <button
            onClick={() => setActiveView("current")}
            className={`flex-1 py-2 px-3 text-center font-medium transition flex items-center justify-center gap-1.5 ${
              activeView === "current"
                ? "text-purple-300 border-b-2 border-purple-500 bg-purple-950/20"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Cpu className="h-3.5 w-3.5 text-purple-400" />
            <span>Mastra Forensic Engine</span>
          </button>
          <button
            onClick={() => setActiveView("ultramarine")}
            className={`flex-1 py-2 px-3 text-center font-medium transition flex items-center justify-center gap-1.5 ${
              activeView === "ultramarine"
                ? "text-cyan-300 border-b-2 border-cyan-500 bg-cyan-950/20"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>Paper Instruments Ultramarine</span>
          </button>
        </div>
      )}

      {/* Card Header */}
      <div
        className={`p-4 border-b border-gray-800 ${
          isUltramarineProvider
            ? "bg-gradient-to-r from-cyan-950/30 to-transparent"
            : "bg-gradient-to-r from-purple-950/30 to-transparent"
        } flex items-center justify-between`}
      >
        <div className="flex items-center gap-2">
          {isUltramarineProvider ? (
            <Sparkles className="h-5 w-5 text-cyan-400 animate-pulse" />
          ) : (
            <Cpu className="h-5 w-5 text-purple-400" />
          )}
          <h3 className="font-semibold text-white text-sm">
            {isUltramarineProvider
              ? "Paper Instruments Ultramarine Investigation"
              : "Root Cause Hypothesis"}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Provider Badge */}
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
              isUltramarineProvider
                ? "bg-cyan-950/50 border-cyan-500/40 text-cyan-300"
                : isFallback
                ? "bg-emerald-950/50 border-emerald-500/40 text-emerald-300"
                : "bg-purple-950/50 border-purple-500/40 text-purple-300"
            }`}
          >
            {isUltramarineProvider
              ? "provider: paperinstruments"
              : isFallback
              ? "provider: deterministic_rules"
              : `provider: ${currentDisplay.provider || "gemma"}`}
          </span>

          {/* Execution Mode Badge */}
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
              isFallback
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                : isUltramarineProvider
                ? "bg-cyan-950/60 border-cyan-500/40 text-cyan-300"
                : "bg-blue-950/60 border-blue-500/40 text-blue-300"
            }`}
          >
            {isFallback ? "mode: rule_engine" : "mode: live_inference"}
          </span>

          {/* Confidence Badge */}
          <span
            className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${
              currentDisplay.confidence >= 0.85
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : currentDisplay.confidence >= 0.6
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {(currentDisplay.confidence * 100).toFixed(0)}% confidence
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4 text-sm flex-1 flex flex-col justify-between">
        {/* Deterministic Forensic Notice Banner (Truthful language per Task 2) */}
        {isFallback && (
          <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-300">Deterministic Forensic Engine Active</p>
              <p className="text-[11px] text-emerald-400/90 mt-0.5">
                Rule-based analysis completed successfully. LLM inference was not used for this investigation. Event references were validated against the original trace.
              </p>
            </div>
          </div>
        )}

        {/* Sanitized Payload Privacy Notice (for Ultramarine) */}
        {isUltramarineProvider && (
          <div className="p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-500/30 text-cyan-200 text-xs flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-[11px]">
              <span className="font-semibold text-cyan-300">
                Privacy Safeguard:
              </span>{" "}
              Payload scrubbed of authorization headers, API keys, cookies, client secrets, and JWTs prior to transmission via OpenAI-compatible SDK to Paper Instruments (<code>https://api.paperinstruments.com/v1</code>).
            </div>
          </div>
        )}

        {/* Model and Title */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400 font-mono">
            <span>
              {isFallback
                ? "Engine: Rule-Based Forensic Analyzer"
                : `Engine: ${currentDisplay.model}`}
            </span>
            <span>{currentDisplay.latencyMs ?? 0}ms latency</span>
          </div>
          <h4 className="text-base font-bold text-white leading-snug">
            {currentDisplay.title}
          </h4>
        </div>

        {/* Explanation */}
        <div className="space-y-1">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Root Cause Diagnosis
          </span>
          <p className="text-gray-300 text-xs leading-relaxed bg-[#161b22] p-3 rounded-lg border border-gray-800">
            {currentDisplay.explanation}
          </p>
        </div>

        {/* Grounding & Hallucination Defense Report */}
        {validationInfo && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileCheck2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Grounding Verification</span>
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  validationInfo.eventReferenceValid && !validationInfo.causalClaimUnverified
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                    : "bg-amber-950 text-amber-300 border border-amber-500/30"
                }`}
              >
                {validationInfo.eventReferenceValid && !validationInfo.causalClaimUnverified
                  ? "Citations Verified"
                  : "Unverified Claims Detected"}
              </span>
            </div>

            {validationInfo.warningMessage && (
              <div className="p-2.5 rounded bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-semibold">Review Alert:</span>{" "}
                  {validationInfo.warningMessage}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Uncertainty Warnings */}
        {currentDisplay.uncertaintyWarnings &&
          currentDisplay.uncertaintyWarnings.length > 0 && (
            <div className="p-3 rounded-lg bg-gray-900/40 border border-gray-800 text-[11px] text-gray-400 flex flex-col gap-1">
              <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-amber-400" />
                <span>Uncertainty &amp; Scope Constraints:</span>
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-gray-400 text-[10px]">
                {currentDisplay.uncertaintyWarnings.map(
                  (w: string, i: number) => (
                    <li key={i}>{w}</li>
                  )
                )}
              </ul>
            </div>
          )}

        {/* Separated Citations & System Anomalies (Truthful distinction per Task 3) */}
        <div className="space-y-3">
          {/* Section A: Model-Supplied Evidence Citations */}
          {modelSuppliedCitations.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 mb-1.5">
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                <span>Model-Supplied Evidence Citations (Validated Event References):</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {modelSuppliedCitations.map((eventId) => {
                  const isSelected = selectedEventId === eventId;
                  return (
                    <button
                      key={eventId}
                      onClick={() => onSelectEvent(isSelected ? null : eventId)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 ${
                        isSelected
                          ? isUltramarineProvider
                            ? "bg-cyan-600 text-white font-bold shadow-lg shadow-cyan-600/30 scale-105"
                            : "bg-purple-600 text-white font-bold shadow-lg shadow-purple-600/30 scale-105"
                          : isUltramarineProvider
                          ? "bg-cyan-950/30 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-900/40"
                          : "bg-purple-950/30 text-purple-300 border border-purple-500/30 hover:bg-purple-900/40"
                      }`}
                    >
                      <Sparkles
                        className={`h-3 w-3 ${
                          isUltramarineProvider ? "text-cyan-400" : "text-purple-400"
                        }`}
                      />
                      <span>#{eventId}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section B: System-Detected Anomaly Events */}
          {systemAnomalyIds.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 mb-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                <span>System-Detected Anomaly Events (Rule-Based Timeline Heuristics):</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {systemAnomalyIds.map((eventId) => {
                  const isSelected = selectedEventId === eventId;
                  return (
                    <button
                      key={eventId}
                      onClick={() => onSelectEvent(isSelected ? null : eventId)}
                      className={`px-2.5 py-1 rounded-md text-xs font-mono transition flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-amber-600 text-white font-bold shadow-lg scale-105"
                          : "bg-amber-950/30 text-amber-300 border border-amber-500/30 hover:bg-amber-900/40"
                      }`}
                    >
                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                      <span>#{eventId}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {modelSuppliedCitations.length === 0 && systemAnomalyIds.length === 0 && (
            <div className="text-xs text-gray-500 font-mono italic">
              No causal anomaly events flagged in trace.
            </div>
          )}
        </div>

        {/* Actionable Fix Recommendation */}
        <div className="p-3.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-200">
          <div className="flex items-center gap-2 font-semibold text-xs text-emerald-400 mb-1">
            <Lightbulb className="h-4 w-4" />
            <span>Actionable Remediation</span>
          </div>
          <p className="text-[11px] leading-relaxed text-emerald-100/90">
            {currentDisplay.suggestedFix}
          </p>
        </div>

        {/* Telemetry info */}
        <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between text-[11px] font-mono text-gray-400">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isUltramarineProvider ? "bg-cyan-400" : isFallback ? "bg-emerald-400" : "bg-purple-400"
              } animate-pulse`}
            />
            <span className="text-gray-300">Provider:</span>
            <span
              className={
                isUltramarineProvider ? "text-cyan-300" : isFallback ? "text-emerald-300" : "text-purple-300"
              }
            >
              {isUltramarineProvider
                ? "Paper Instruments (ultramarine-1-flash)"
                : isFallback
                ? "Deterministic Timeline Rules Engine"
                : `${currentDisplay.provider || "gemma"}`}
            </span>
          </div>
          <span className="text-gray-500">
            {isUltramarineProvider
              ? "open_ai_sdk: base_url=api.paperinstruments.com"
              : isFallback
              ? "deterministic: timeline_analyzer"
              : "otel: gen_ai.system=google_gemma"}
          </span>
        </div>
      </div>
    </div>
  );
};
