"use client";

import React, { useState } from "react";
import { X, Upload, FileText, AlertCircle } from "lucide-react";
import { TraceRun } from "@/types/trace";
import { reconstructTimeline } from "@/lib/detector";
import { timelineToTraceRun } from "@/lib/sampleTraces";

interface TraceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTraceLoaded: (trace: TraceRun) => void;
}

export const TraceUploadModal: React.FC<TraceUploadModalProps> = ({
  isOpen,
  onClose,
  onTraceLoaded,
}) => {
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParse = () => {
    try {
      setError(null);
      const parsed = JSON.parse(jsonText);
      const timeline = reconstructTimeline(parsed);
      const traceRun = timelineToTraceRun(timeline);
      onTraceLoaded(traceRun);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid trace JSON";
      setError(msg);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonText(content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0d1117] border border-gray-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white">Import Execution Trace</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* File Drop / Upload */}
        <div className="border-2 border-dashed border-gray-800 hover:border-purple-500/50 rounded-xl p-4 text-center cursor-pointer transition bg-[#161b22]/40 relative">
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <FileText className="h-6 w-6 text-purple-400 mx-auto mb-1" />
          <p className="text-xs text-gray-300 font-medium">
            Drag &amp; drop an OpenTelemetry or JSON trace file here
          </p>
          <span className="text-[10px] text-gray-500">Supports standard agent traces</span>
        </div>

        {/* Or Paste Raw JSON */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400 font-medium">Or paste JSON content:</label>
          <textarea
            rows={7}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder='{ "id": "agent-run-...", "events": [...] }'
            className="w-full bg-[#161b22] border border-gray-800 rounded-lg p-3 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleParse}
            disabled={!jsonText.trim()}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition shadow-lg shadow-purple-600/20 disabled:opacity-40"
          >
            Load Trace
          </button>
        </div>
      </div>
    </div>
  );
};
