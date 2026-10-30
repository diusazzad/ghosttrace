"use client";

import React from "react";
import {
  Upload,
  Cpu,
  Search,
  CheckCircle,
} from "lucide-react";
import { TraceRun } from "@/types/trace";

interface HeaderProps {
  traces: TraceRun[];
  activeTrace: TraceRun;
  onSelectTrace: (trace: TraceRun) => void;
  onUploadClick: () => void;
  onAnalyzeClick: () => void;
  isAnalyzing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  traces,
  activeTrace,
  onSelectTrace,
  onUploadClick,
  onAnalyzeClick,
  isAnalyzing,
}) => {
  return (
    <header className="h-16 border-b border-gray-800/80 bg-[#0d1117]/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Left: Active Run Selector & Search */}
      <div className="flex items-center gap-4 flex-1 max-w-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search events, tools, or errors..."
            className="w-full bg-[#161b22] border border-gray-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
          />
        </div>

        {/* Trace Dropdown */}
        <select
          value={activeTrace.id}
          onChange={(e) => {
            const selected = traces.find((t) => t.id === e.target.value);
            if (selected) onSelectTrace(selected);
          }}
          className="bg-[#161b22] border border-gray-800 text-gray-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500 max-w-xs truncate"
        >
          {traces.map((trace) => {
            const tag =
              trace.status === "completed"
                ? "HEALTHY"
                : trace.failureCategory.toUpperCase().replace("_", " ");
            return (
              <option key={trace.id} value={trace.id}>
                [{tag}] {trace.agentName}
              </option>
            );
          })}
        </select>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={onUploadClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-800 text-gray-200 text-xs transition"
        >
          <Upload className="h-3.5 w-3.5" />
          <span>Upload Trace</span>
        </button>

        <button
          onClick={onAnalyzeClick}
          disabled={isAnalyzing}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-medium shadow-lg shadow-purple-600/20 transition disabled:opacity-50"
        >
          <Cpu className={`h-3.5 w-3.5 ${isAnalyzing ? "animate-spin" : ""}`} />
          <span>{isAnalyzing ? "Reasoning with Gemma..." : "Re-Analyze (Gemma 2)"}</span>
        </button>

        <div className="h-4 w-px bg-gray-800" />

        <div className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle className="h-3 w-3" />
          <span>Engine: Active</span>
        </div>
      </div>
    </header>
  );
};
