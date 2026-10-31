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
    currentDisplay.executionMode === "deterministic_fallback";
  const validationInfo = currentDisplay.evidenceValidation;
  const isUltramarineProvider =
    currentDisplay.provider === "paperinstruments" ||
    currentDisplay.provider === "ultramarine";

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
            <span>Mastra + Gemma Baseline</span>
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
                : "bg-purple-950/50 border-purple-500/40 text-purple-300"
            }`}
          >
            {isUltramarineProvider
              ? "provider: paperinstruments"
              : `provider: ${currentDisplay.provider || "mastra"}`}
          </span>

          {/* Execution Mode Badge */}
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
              isFallback
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                : isUltramarineProvider
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                : "bg-blue-950/60 border-blue-500/40 text-blue-300"
            }`}
          >
            {isFallback ? "mode: deterministic" : "mode: live_inference"}
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
        {/* Grounded Deterministic Notice Banner */}
        {isFallback && currentDisplay.fallbackReason && (
          <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-300">Grounded Deterministic Engine Active</p>
              <p className="text-[11px] text-emerald-400/90 mt-0.5">
                {currentDisplay.fallbackReason}
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
            <span>Model: {currentDisplay.model}</span>
            {currentDisplay.latencyMs !== undefined && (
              <span>Latency: {currentDisplay.latencyMs}ms</span>
            )}
          </div>
          <h4 className="text-sm font-semibold text-white leading-snug">
            {currentDisplay.title}
          </h4>
        </div>

        {/* GT-UM-04: Actual Token Usage & Inference Cost Card */}
        {currentDisplay.cost && (
          <div className="p-3 rounded-lg bg-[#161b22] border border-gray-800 text-xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-gray-300 font-medium">
                <Coins className="h-3.5 w-3.5 text-amber-400" />
                <span>Actual Inference Cost:</span>
                {currentDisplay.cost.costUsd !== null && currentDisplay.cost.costUsd !== undefined ? (
                  <span className="font-mono font-bold text-emerald-400">
                    ${currentDisplay.cost.costUsd.toFixed(6)}
                  </span>
                ) : (
                  <span className="font-mono font-bold text-amber-400">
                    Unknown
                  </span>
                )}
              </div>
              <span className="text-[10px] text-gray-400 font-mono">
                Official Paper Instruments Rates
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-800/60 text-[10px] font-mono text-gray-400">
              <div>
                <span className="text-gray-500 block">Uncached In ($0.15/M):</span>
                <span className="text-gray-300">
                  {currentDisplay.cost.uncachedInputTokens !== null && currentDisplay.cost.uncachedInputTokens !== undefined
                    ? `${currentDisplay.cost.uncachedInputTokens} tok`
                    : "Unknown"}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Cached In ($0.03/M):</span>
                <span className="text-gray-300">
                  {currentDisplay.cost.cachedInputTokens !== null && currentDisplay.cost.cachedInputTokens !== undefined
                    ? `${currentDisplay.cost.cachedInputTokens} tok`
                    : "Unknown"}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Completion ($0.50/M):</span>
                <span className="text-gray-300">
                  {currentDisplay.cost.completionTokens !== null && currentDisplay.cost.completionTokens !== undefined
                    ? `${currentDisplay.cost.completionTokens} tok`
                    : "Unknown"}
                </span>
              </div>
            </div>

            {currentDisplay.cost.formula && (
              <p className="text-[9px] text-gray-500 font-mono italic">
                Formula: {currentDisplay.cost.formula}
              </p>
            )}
          </div>
        )}

        {/* Detailed Explanation */}
        <div className="p-3 rounded-lg bg-[#161b22] border border-gray-800 text-gray-300 leading-relaxed text-[11px]">
          {currentDisplay.explanation}
        </div>

        {/* GT-UM-03: Evidence Verification & Causal Status Separation */}
        {validationInfo && (
          <div className="p-3 rounded-lg bg-[#161b22] border border-gray-800 flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 font-medium flex items-center gap-1.5">
                <FileCheck2 className="h-3.5 w-3.5 text-blue-400" />
                <span>Telemetry Evidence Grounding:</span>
              </span>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span
                  className={
                    validationInfo.eventReferenceValid
                      ? "text-emerald-400 font-semibold"
                      : "text-red-400 font-semibold"
                  }
                >
                  {validationInfo.eventReferenceValid
                    ? "✓ event_refs_valid"
                    : "✗ invalid_event_refs"}
                </span>
                <span className="text-gray-600">|</span>
                <span
                  className={
                    validationInfo.causalClaimUnverified
                      ? "text-amber-400 font-semibold"
                      : "text-emerald-400 font-semibold"
                  }
                >
                  {validationInfo.causalClaimUnverified
                    ? "⚠ causal_claim_unverified"
                    : "✓ causal_claim_verified"}
                </span>
              </div>
            </div>

            {validationInfo.warningMessage && (
              <p className="text-[10px] text-amber-300 bg-amber-950/20 p-2 rounded border border-amber-500/20">
                ⚠ {validationInfo.warningMessage}
              </p>
            )}

            {validationInfo.humanReviewRequired && (
              <p className="text-[10px] text-amber-300/90 bg-amber-950/20 p-2 rounded border border-amber-500/20">
                ⚠ Human Review Required: AI-attributed causal findings must be
                confirmed against system state transitions before applying code
                fixes.
              </p>
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

        {/* Grounded Trace Event Citations */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 mb-2">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
            <span>Causal Event Citations (Click to highlight in timeline):</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {(() => {
              const rawCitations =
                currentDisplay.groundedEventIds && currentDisplay.groundedEventIds.length > 0
                  ? currentDisplay.groundedEventIds
                  : (currentDisplay as any)?.citations && (currentDisplay as any).citations.length > 0
                  ? (currentDisplay as any).citations
                  : (currentDisplay as any)?.causalEventIds && (currentDisplay as any).causalEventIds.length > 0
                  ? (currentDisplay as any).causalEventIds
                  : trace.events
                      .filter((e) => e.isCausalAnomaly || e.status === "error")
                      .map((e) => e.id);

              if (!rawCitations || rawCitations.length === 0) {
                return (
                  <span className="text-xs text-gray-500 font-mono italic">
                    No causal anomaly events flagged
                  </span>
                );
              }

              return rawCitations.map((eventId: string) => {
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
              });
            })()}
          </div>
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
                isUltramarineProvider ? "bg-cyan-400" : "bg-purple-400"
              } animate-pulse`}
            />
            <span className="text-gray-300">Provider:</span>
            <span
              className={
                isUltramarineProvider ? "text-cyan-300" : "text-purple-300"
              }
            >
              {isUltramarineProvider
                ? "Paper Instruments (ultramarine-1-flash)"
                : `${currentDisplay.provider || "deterministic"}`}
            </span>
          </div>
          <span className="text-gray-500">
            {isUltramarineProvider
              ? "open_ai_sdk: base_url=api.paperinstruments.com"
              : "otel: gen_ai.system=google_gemma"}
          </span>
        </div>
      </div>
    </div>
  );
};
