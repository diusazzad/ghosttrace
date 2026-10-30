"use client";

import React from "react";
import {
  ShieldAlert,
  Cpu,
  CheckCircle,
  Lightbulb,
  Sparkles,
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

  return (
    <div className="rounded-xl border border-purple-500/30 bg-[#0d1117] overflow-hidden flex flex-col shadow-xl">
      {/* Card Header */}
      <div className="p-4 border-b border-gray-800 bg-gradient-to-r from-purple-950/30 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Root Cause Hypothesis</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {hypothesis.model}
              </span>
            </div>
            <p className="text-[11px] text-gray-400">Gemma 2 Grounded Reasoning</p>
          </div>
        </div>

        {/* Validation Status Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono">
          <CheckCircle className="h-3.5 w-3.5" />
          <span>Grounded &amp; Verified</span>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-5 flex flex-col gap-4 text-xs">
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
      </div>
    </div>
  );
};
