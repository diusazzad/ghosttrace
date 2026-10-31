"use client";

import React from "react";
import {
  ShieldAlert,
  Cpu,
  CheckCircle,
  Lightbulb,
  Sparkles,
  AlertTriangle,
  Clock,
  Info,
} from "lucide-react";
import { TraceRun } from "@/types/trace";

interface EvidenceHypothesisCardProps {
  trace: TraceRun;
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
}

export const EvidenceHypothesisCard: React.FC<EvidenceHypothesisCardProps> = ({
  trace,
  selectedEventId,
  onSelectEvent,
}) => {
  const { hypothesis } = trace;
  const isFallback = hypothesis.executionMode === "deterministic_fallback";
  const validationInfo = hypothesis.evidenceValidation;

  return (
    <div className="rounded-xl border border-purple-500/30 bg-[#0d1117] overflow-hidden flex flex-col shadow-xl">
      {/* Card Header */}
      <div className="p-4 border-b border-gray-800 bg-gradient-to-r from-purple-950/30 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white">Root Cause Hypothesis</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {hypothesis.model}
              </span>
              {hypothesis.latencyMs !== undefined && (
                <span className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {hypothesis.latencyMs}ms
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400">
              {isFallback
                ? "Deterministic Diagnostic (Honest Offline Mode)"
                : "Gemma 2 Grounded Reasoning"}
            </p>
          </div>
        </div>

        {/* Execution Mode / Validation Status Badge */}
        <div className="flex items-center gap-2">
          {isFallback ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-mono">
              <Info className="h-3.5 w-3.5" />
              <span>Deterministic Fallback</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Grounded &amp; Verified</span>
            </div>
          )}
        </div>
      </div>

      {/* Content Body */}
      <div className="p-5 flex flex-col gap-4 text-xs">
        {/* Offline Fallback Notice Banner */}
        {hypothesis.fallbackReason && (
          <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-300">
                Execution Mode Notice:{" "}
              </span>
              <span className="text-amber-200/90 leading-relaxed">
                {hypothesis.fallbackReason}
              </span>
            </div>
          </div>
        )}

        {/* Hypothesis Title & Confidence */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase font-semibold tracking-wider text-purple-400">
              Inferred Diagnosis
            </span>
            <span className="font-mono text-[11px] text-emerald-400">
              Confidence: {Math.round(hypothesis.confidence * 100)}%
            </span>
          </div>
          <h4 className="text-base font-bold text-white flex items-center gap-2">
            <span>{hypothesis.title}</span>
          </h4>
        </div>

        {/* Explanation */}
        <div className="p-3.5 rounded-lg bg-[#161b22] border border-gray-800 text-gray-300 leading-relaxed text-xs">
          {hypothesis.explanation}
        </div>

        {/* Evidence Validation & Audit Findings */}
        {validationInfo && (
          <div className="p-3.5 rounded-lg bg-[#111620] border border-gray-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-300 flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-blue-400" />
                <span>Evidence Grounding Validation (TASK 02.3)</span>
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  validationInfo.eventReferenceValid
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}
              >
                {validationInfo.eventReferenceValid
                  ? "event_reference_valid"
                  : "hallucinated_reference_flagged"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-gray-400 pt-1">
              <div className="bg-black/30 p-2 rounded border border-gray-800/80">
                <span className="text-gray-500">Verified Event IDs:</span>{" "}
                <span className="text-emerald-400">
                  {validationInfo.validEventIds.join(", ") || "None"}
                </span>
              </div>
              <div className="bg-black/30 p-2 rounded border border-gray-800/80">
                <span className="text-gray-500">Causal Claim Status:</span>{" "}
                <span
                  className={
                    validationInfo.causalClaimUnverified
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }
                >
                  {validationInfo.causalClaimUnverified
                    ? "causal_claim_unverified"
                    : "verified_causal"}
                </span>
              </div>
            </div>

            {validationInfo.humanReviewRequired && (
              <p className="text-[10px] text-amber-300/90 bg-amber-950/20 p-2 rounded border border-amber-500/20">
                ⚠ Human Review Required: AI-attributed causal findings must be
                confirmed against system state transitions before applying code fixes.
              </p>
            )}
          </div>
        )}

        {/* Uncertainty Warnings */}
        {hypothesis.uncertaintyWarnings && hypothesis.uncertaintyWarnings.length > 0 && (
          <div className="p-3 rounded-lg bg-gray-900/40 border border-gray-800 text-[11px] text-gray-400 flex flex-col gap-1">
            <span className="font-semibold text-gray-300 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-amber-400" />
              <span>Uncertainty &amp; Scope Constraints:</span>
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-gray-400 text-[10px]">
              {hypothesis.uncertaintyWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
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
            {hypothesis.groundedEventIds.map((eventId) => {
              const isSelected = selectedEventId === eventId;
              return (
                <button
                  key={eventId}
                  onClick={() => onSelectEvent(isSelected ? null : eventId)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-purple-600 text-white font-bold shadow-lg shadow-purple-600/30 scale-105"
                      : "bg-purple-950/30 text-purple-300 border border-purple-500/30 hover:bg-purple-900/40"
                  }`}
                >
                  <Sparkles className="h-3 w-3 text-purple-400" />
                  <span>#{eventId}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actionable Fix Recommendation */}
        <div className="p-3.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-200">
          <div className="flex items-center gap-2 font-semibold text-xs text-emerald-400 mb-1">
            <Lightbulb className="h-4 w-4" />
            <span>Actionable Remediation</span>
          </div>
          <p className="text-[11px] leading-relaxed text-emerald-100/90">
            {hypothesis.suggestedFix}
          </p>
        </div>

        {/* Telemetry info */}
        <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between text-[11px] font-mono text-gray-400">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-gray-300">Sentry AI Span:</span>
            <span className="text-purple-300">
              gen_ai.chat ({hypothesis.provider})
            </span>
          </div>
          <span className="text-gray-500">otel: gen_ai.system=google_gemma</span>
        </div>
      </div>
    </div>
  );
};
