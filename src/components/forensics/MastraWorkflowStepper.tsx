"use client";

import React, { useState } from "react";
import {
  Workflow,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Cpu,
} from "lucide-react";
import { MastraWorkflowStepInfo } from "@/types/trace";

interface MastraWorkflowStepperProps {
  steps?: MastraWorkflowStepInfo[];
  workflowEngine?: string;
  isAnalyzing?: boolean;
}

const DEFAULT_STEP_NAMES = [
  "1. Ingest & Normalize Timeline",
  "2. Deterministic Anomaly Detection",
  "3. Root Cause Investigation & Grounding",
  "4. Grounding Verification & Test Synthesis",
];

export const MastraWorkflowStepper: React.FC<MastraWorkflowStepperProps> = ({
  steps,
  workflowEngine = "Mastra v1.80.0",
  isAnalyzing = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Compute total duration of all completed steps
  const totalDurationMs = steps
    ? steps.reduce((acc, s) => acc + (s.durationMs || 0), 0)
    : 0;

  return (
    <div className="rounded-xl border border-gray-800 bg-[#0d1117] overflow-hidden flex flex-col shadow-xl">
      {/* Stepper Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#161b22]/40">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Workflow className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">
                Mastra 4-Step Forensic Workflow
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {workflowEngine}
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              Orchestrated Sequential Agent Pipeline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {totalDurationMs > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-mono text-gray-400 bg-black/40 px-2 py-1 rounded-md border border-gray-800">
              <Clock className="h-3 w-3 text-indigo-400" />
              <span>Total: {totalDurationMs}ms</span>
            </div>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white p-1 rounded transition"
            aria-label="Toggle workflow steps"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Stepper Body */}
      {isExpanded && (
        <div className="p-4 bg-black/20">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {DEFAULT_STEP_NAMES.map((defaultName, idx) => {
              const step = steps && steps[idx];
              const isCurrent = isAnalyzing && (!steps || steps.length === idx);
              const isCompleted = step && step.status === "success";

              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-lg border flex flex-col justify-between transition ${
                    isCompleted
                      ? "border-emerald-500/30 bg-emerald-950/10"
                      : isCurrent
                      ? "border-indigo-500/50 bg-indigo-950/20 animate-pulse"
                      : "border-gray-800 bg-[#161b22]/30"
                  }`}
                >
                  <div>
                    {/* Step Title & Status */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="text-[11px] font-bold text-gray-200 truncate">
                        {step?.name || defaultName}
                      </span>
                      {isCompleted ? (
                        <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          <span>{step.durationMs}ms</span>
                        </span>
                      ) : isCurrent ? (
                        <span className="flex items-center gap-1 text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 shrink-0">
                          <Cpu className="h-2.5 w-2.5 animate-spin" />
                          <span>Running</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-gray-500">
                          Pending
                        </span>
                      )}
                    </div>

                    {/* Input Summary */}
                    {step?.inputSummary && (
                      <p className="text-[10px] text-gray-400 leading-relaxed mb-1 line-clamp-2">
                        <span className="text-gray-500 font-mono">In:</span>{" "}
                        {step.inputSummary}
                      </p>
                    )}

                    {/* Output Summary */}
                    {step?.outputSummary && (
                      <p className="text-[10px] text-gray-300 leading-relaxed line-clamp-2">
                        <span className="text-emerald-400 font-mono">Out:</span>{" "}
                        {step.outputSummary}
                      </p>
                    )}
                  </div>

                  {/* Footer status line */}
                  <div className="mt-2 pt-2 border-t border-gray-800/60 flex items-center justify-between text-[9px] font-mono text-gray-500">
                    <span>Step 0{idx + 1}</span>
                    <span className="capitalize text-gray-400">
                      {isCompleted ? "Completed" : isCurrent ? "Processing" : "Queued"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
