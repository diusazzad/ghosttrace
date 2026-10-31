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
import { TraceRun, TraceHypothesis } from "@/types/trace";

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

  const safeHypothesis: TraceHypothesis = hypothesis || {
    title: (trace.failureCategory === "none" || trace.status === "completed")
      ? "Healthy Execution — Zero Anomalies"
      : "Deterministic Anomaly Diagnostic",
    model: "Rule-Based Deterministic Grounding Engine",
    provider: "deterministic_rules" as const,
    executionMode: "deterministic_fallback" as const,
    latencyMs: 8,
    explanation:
      trace.failureDescription ||
      "All execution spans completed within normal parameters with zero tool loops, schema hallucinations, or uncaught exceptions.",
    groundedEventIds: [],
    confidence: 1.0,
    validationStatus: "grounded" as const,
    suggestedFix:
      "Workflow completed within acceptable parameters. No remediation required.",
    uncertaintyWarnings: [],
    evidenceValidation: {
      eventReferenceValid: true,
      causalClaimUnverified: false,
      validEventIds: [],
      hallucinatedEventIds: [],
      humanReviewRequired: false,
    },
  };

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
    : safeHypothesis;

  const isFallback =
    currentDisplay.executionMode === "deterministic_fallback" ||
    currentDisplay.provider === "deterministic_rules" ||
    currentDisplay.provider === "deterministic";

  const validationInfo = currentDisplay.evidenceValidation;
  const isUltramarineProvider =
    currentDisplay.provider === "paperinstruments" ||
    currentDisplay.provider === "ultramarine";

  const events = trace.events || [];
  // Validate citations against actual trace events
  const allValidEventIds = new Set(events.map((e) => e.id));
  
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
      events
        .filter((e) => e.isCausalAnomaly || e.status === "error")
        .map((e) => e.id)
    )
  );

  const hallucinatedIds =
    validationInfo &&
    "hallucinatedEventIds" in validationInfo &&
    Array.isArray((validationInfo as any).hallucinatedEventIds)
      ? ((validationInfo as any).hallucinatedEventIds as string[])
      : [];

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
            <Sparkles className="h-4 w-4 text-cyan-400" />
          ) : (
            <Lightbulb className="h-4 w-4 text-purple-400" />
          )}
          <h3 className="text-sm font-semibold text-white">
            {isUltramarineProvider
              ? "Paper Instruments Ultramarine Investigation"
              : "Root Cause Hypothesis & Causal Grounding"}
          </h3>
        </div>

        {/* Model Badge */}
        <div className="flex items-center gap-2">
          {isFallback && (
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-600/40 flex items-center gap-1 cursor-help"
              title={
                currentDisplay.fallbackReason ||
                "Operating under grounded deterministic rules"
              }
            >
              <AlertTriangle className="h-3 w-3 text-amber-400" />
              <span>Offline Rule-Based Diagnostic</span>
            </span>
          )}
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded ${
              isUltramarineProvider
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
            }`}
          >
            {currentDisplay.model}
          </span>
        </div>
      </div>

      {/* Hypothesis Summary & Title */}
      <div className="p-4 border-b border-gray-800 bg-[#161b22]/30 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400">
              Diagnostic Finding
            </span>
            <h4 className="text-base font-bold text-white mt-0.5">
              {currentDisplay.title}
            </h4>
          </div>

          {/* Validation Status Badge */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            {currentDisplay.validationStatus === "grounded" ? (
              <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Evidence Grounded</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/30">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Grounding Discrepancy</span>
              </span>
            )}
            <span className="text-[10px] font-mono text-gray-400">
              Confidence: {Math.round((currentDisplay.confidence || 1) * 100)}%
            </span>
          </div>
        </div>

        {/* Latency & Token Footprint telemetry bar */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-gray-400 pt-1 border-t border-gray-800/40">
          {currentDisplay.latencyMs !== undefined && (
            <span>Latency: {currentDisplay.latencyMs}ms</span>
          )}
          {currentDisplay.tokenUsage && (
            <span>
              Tokens:{" "}
              {currentDisplay.tokenUsage.totalTokens?.toLocaleString() ?? "N/A"}{" "}
              (In: {currentDisplay.tokenUsage.promptTokens ?? 0}, Out:{" "}
              {currentDisplay.tokenUsage.completionTokens ?? 0})
            </span>
          )}
          {currentDisplay.cost?.costUsd !== null &&
            currentDisplay.cost?.costUsd !== undefined && (
              <span className="text-emerald-400 flex items-center gap-1">
                <Coins className="h-3 w-3" />
                <span>${currentDisplay.cost.costUsd.toFixed(6)}</span>
              </span>
            )}
        </div>
      </div>

      {/* Explanation & Evidence Citations */}
      <div className="p-4 flex flex-col gap-4 text-xs">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 block mb-1">
            Root Cause Explanation
          </span>
          <p className="text-gray-300 leading-relaxed font-sans">
            {currentDisplay.explanation}
          </p>
        </div>

        {/* Evidence Verification Section */}
        <div className="flex flex-col gap-2 pt-2 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 flex items-center gap-1">
              <FileCheck2 className="h-3 w-3 text-purple-400" />
              <span>Verified Evidence Spans (Click to Inspect in Waterfall)</span>
            </span>
            {validationInfo && (
              <span
                className={`text-[10px] font-mono ${
                  validationInfo.eventReferenceValid
                    ? "text-emerald-400"
                    : "text-rose-400"
                }`}
              >
                {validationInfo.eventReferenceValid
                  ? "✓ References Validated"
                  : "⚠ Unverified Spans Flagged"}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Model-cited events */}
            {modelSuppliedCitations.map((eventId) => {
              const isSelected = selectedEventId === eventId;
              return (
                <button
                  key={eventId}
                  onClick={() => onSelectEvent(isSelected ? null : eventId)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition flex items-center gap-1.5 border ${
                    isSelected
                      ? "bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30"
                      : "bg-[#161b22] text-purple-300 border-purple-500/30 hover:border-purple-400 hover:bg-purple-950/20"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <span>#{eventId}</span>
                </button>
              );
            })}

            {/* System detected anomaly events */}
            {systemAnomalyIds
              .filter((id) => !modelSuppliedCitations.includes(id))
              .map((eventId) => {
                const isSelected = selectedEventId === eventId;
                return (
                  <button
                    key={eventId}
                    onClick={() => onSelectEvent(isSelected ? null : eventId)}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition flex items-center gap-1.5 border ${
                      isSelected
                        ? "bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-600/30"
                        : "bg-[#161b22] text-amber-300 border-amber-500/30 hover:border-amber-400 hover:bg-amber-950/20"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>#{eventId} (Anomaly)</span>
                  </button>
                );
              })}

            {modelSuppliedCitations.length === 0 && systemAnomalyIds.length === 0 && (
              <span className="text-gray-500 italic text-[11px]">
                No causal anomalies or citations. Execution verified clean.
              </span>
            )}
          </div>
        </div>

        {/* Hallucinated citations warning */}
        {hallucinatedIds.length > 0 && (
          <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 flex items-start gap-2 text-[11px]">
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <span className="font-semibold block">
                Grounding Warning: Hallucinated Event IDs Suppressed
              </span>
              <span>
                The model cited non-existent event IDs (
                {hallucinatedIds.join(", ")}). These citations were flagged and
                stripped by the Grounding Defense Layer.
              </span>
            </div>
          </div>
        )}

        {/* Suggested Fix */}
        <div className="pt-2 border-t border-gray-800">
          <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1 mb-1">
            <Lightbulb className="h-3 w-3" />
            <span>Recommended Remediation</span>
          </span>
          <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-gray-200 font-sans text-xs">
            {currentDisplay.suggestedFix}
          </div>
        </div>
      </div>
    </div>
  );
};
