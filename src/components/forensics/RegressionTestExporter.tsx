"use client";

import React, { useState } from "react";
import { Copy, Check, Download, FileCode, Terminal } from "lucide-react";
import { TraceRun } from "@/types/trace";

interface RegressionTestExporterProps {
  trace: TraceRun;
}

export const RegressionTestExporter: React.FC<RegressionTestExporterProps> = ({ trace }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(trace.generatedTestCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([trace.generatedTestCode], { type: "text/typescript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${trace.id}.regression.test.ts`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-[#0d1117] overflow-hidden flex flex-col shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#161b22]/40">
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Reproducible Regression Test Blueprint</h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Vitest Blueprint
          </span>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800/80 hover:bg-gray-800 text-gray-200 text-xs transition"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition shadow-lg shadow-emerald-600/20"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download .test.ts</span>
          </button>
        </div>
      </div>

      {/* Code Display */}
      <div className="p-4 bg-black/50 overflow-x-auto">
        <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 pb-2 border-b border-gray-800/60 mb-2">
          <span>{`// Auto-generated regression blueprint for #${trace.id}`}</span>
          <span>Target: {trace.agentName}</span>
        </div>
        <pre className="text-xs font-mono text-emerald-300 leading-relaxed overflow-x-auto">
          <code>{trace.generatedTestCode}</code>
        </pre>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-gray-800/80 bg-[#161b22]/20 text-[11px] text-gray-400 flex items-center gap-2">
        <Terminal className="h-3.5 w-3.5 text-purple-400" />
        <span>Synthesized test blueprint. Review imports and assertions before running with <code className="text-gray-200 bg-black/40 px-1 py-0.5 rounded font-mono">pnpm test</code>.</span>
      </div>
    </div>
  );
};
