"use client";

import React from "react";
import {
  Upload,
  Cpu,
  Search,
  CheckCircle,
  Shield,
} from "lucide-react";
import { TraceRun } from "@/types/trace";

export interface AuthStateDTO {
  isConfigured: boolean;
  isAuthenticated: boolean;
  user: {
    name?: string;
    email?: string;
    userId: string;
  } | null;
}

interface HeaderProps {
  traces: TraceRun[];
  activeTrace: TraceRun;
  onSelectTrace: (trace: TraceRun) => void;
  onUploadClick: () => void;
  onAnalyzeClick: () => void;
  isAnalyzing: boolean;
  authState?: AuthStateDTO;
}

export const Header: React.FC<HeaderProps> = ({
  traces,
  activeTrace,
  onSelectTrace,
  onUploadClick,
  onAnalyzeClick,
  isAnalyzing,
  authState,
}) => {
  return (
    <header className="h-16 border-b border-gray-800/80 bg-[#0d1117]/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Left: Active Run Selector & Search */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
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
          className="bg-[#161b22] border border-gray-800 text-gray-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500"
        >
          {traces.map((trace) => (
            <option key={trace.id} value={trace.id}>
              {trace.agentName} ({trace.id})
            </option>
          ))}
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

        {/* Sentry Agent Tracing Live Status Indicator */}
        <div
          className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20"
          title="Sentry Agent Tracing instrumenting OpenTelemetry gen_ai spans & breadcrumbs"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
          <span>Sentry: Agent Tracing</span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle className="h-3 w-3" />
          <span>Engine: Active</span>
        </div>

        {/* Auth0 for AI Agents Identity Status (Truthful Server-Derived) */}
        {!authState?.isConfigured ? (
          <div
            className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-md bg-gray-800/60 text-gray-400 border border-gray-700/60 select-none"
            title="Auth0 unconfigured: Running in local-first demo mode with synthetic fixtures."
          >
            <Shield className="h-3 w-3 text-gray-500" />
            <span>Demo Mode · Sign-in unavailable</span>
          </div>
        ) : !authState?.isAuthenticated ? (
          <a
            href="/auth/login"
            className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition cursor-pointer"
            title="Sign in with Auth0 Universal Login"
          >
            <Shield className="h-3 w-3 text-blue-400" />
            <span>Sign in</span>
          </a>
        ) : (
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              title={`Server-verified session: ${authState.user?.userId}`}
            >
              <Shield className="h-3 w-3 text-emerald-400" />
              <span>{authState.user?.name || authState.user?.email || "Authenticated user"}</span>
            </div>
            <a
              href="/auth/logout"
              className="text-[11px] font-mono text-gray-400 hover:text-gray-200 underline transition"
              title="Sign out of Auth0 session"
            >
              Sign out
            </a>
          </div>
        )}
      </div>
    </header>
  );
};
