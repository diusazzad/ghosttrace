// src/components/layout/Header.tsx
"use client";

import React from "react";
import {
  Cpu,
  Search,
  Upload,
  Sparkles,
  Shield,
  CheckCircle,
  Menu,
  X,
  Ghost,
} from "lucide-react";
import { TraceRun } from "@/types/trace";

export interface AuthStateDTO {
  isConfigured: boolean;
  isAuthenticated: boolean;
  user: {
    userId: string;
    name?: string | null;
    email?: string | null;
  } | null;
}

interface HeaderProps {
  traces: TraceRun[];
  activeTrace: TraceRun;
  onSelectTrace: (trace: TraceRun) => void;
  onUploadClick: () => void;
  onAnalyzeClick: () => void;
  isAnalyzing: boolean;
  onUltramarineClick?: () => void;
  isAnalyzingUltramarine?: boolean;
  authState?: AuthStateDTO;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  traces,
  activeTrace,
  onSelectTrace,
  onUploadClick,
  onAnalyzeClick,
  isAnalyzing,
  onUltramarineClick,
  isAnalyzingUltramarine = false,
  authState,
  onToggleMobileMenu,
  isMobileMenuOpen = false,
}) => {
  return (
    <header className="h-16 border-b border-gray-800/80 bg-[#0d1117]/95 backdrop-blur px-3 sm:px-6 flex items-center justify-between sticky top-0 z-40 gap-2 sm:gap-4">
      {/* Left: Mobile Toggle, Brand & Trace Selector */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 max-w-xl">
        {/* Mobile Navigation Drawer Toggle Button */}
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="lg:hidden p-1.5 rounded-lg border border-gray-800 bg-[#161b22] text-gray-300 hover:text-white hover:bg-gray-800 transition shrink-0"
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        )}

        {/* Compact Mobile Brand Icon */}
        <div className="flex items-center gap-2 lg:hidden shrink-0">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md shadow-purple-500/20">
            <Ghost className="h-4 w-4 text-white" />
          </div>
        </div>

        {/* Search Bar (Hidden on phone, visible on tablet & desktop) */}
        <div className="relative hidden md:flex flex-1 max-w-xs xl:max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            aria-label="Search events, tools, or errors"
            placeholder="Search events, tools, or errors..."
            className="w-full bg-[#161b22] border border-gray-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
          />
        </div>

        {/* Trace Dropdown Selector */}
        <select
          value={activeTrace.id}
          aria-label="Select agent trace for forensic analysis"
          onChange={(e) => {
            const selected = traces.find((t) => t.id === e.target.value);
            if (selected) onSelectTrace(selected);
          }}
          className="bg-[#161b22] border border-gray-800 text-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-500 max-w-[130px] sm:max-w-[200px] md:max-w-xs truncate shrink-0"
        >
          {traces.map((trace) => (
            <option key={trace.id} value={trace.id}>
              {trace.agentName} ({trace.id})
            </option>
          ))}
        </select>
      </div>

      {/* Right: Actions, Sentry Agent Tracing & Auth0 Log In Cluster */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Upload Custom Trace */}
        <button
          onClick={onUploadClick}
          aria-label="Upload custom trace JSON"
          title="Upload custom trace JSON"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-800 text-gray-200 text-xs transition"
        >
          <Upload className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden xl:inline">Upload Trace</span>
          <span className="hidden sm:inline xl:hidden">Upload</span>
        </button>

        {/* Mastra + Gemma Investigation */}
        <button
          onClick={onAnalyzeClick}
          disabled={isAnalyzing || isAnalyzingUltramarine}
          aria-label="Run Mastra and Gemma investigation"
          title="Run sequential forensic pipeline powered by Mastra Core and Google Gemma 2"
          className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-medium shadow-md shadow-purple-600/20 transition disabled:opacity-50"
        >
          <Cpu className={`h-3.5 w-3.5 shrink-0 ${isAnalyzing ? "animate-spin" : ""}`} />
          <span className="hidden xl:inline">
            {isAnalyzing ? "Executing..." : "Run (Mastra + Gemma)"}
          </span>
          <span className="hidden sm:inline xl:hidden">
            {isAnalyzing ? "..." : "Mastra"}
          </span>
        </button>

        {/* Ultramarine Investigation Button */}
        {onUltramarineClick && (
          <button
            onClick={onUltramarineClick}
            disabled={isAnalyzing || isAnalyzingUltramarine}
            aria-label="Analyze trace with Paper Instruments Ultramarine-1-Flash"
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-medium shadow-md shadow-cyan-600/20 transition disabled:opacity-50"
            title="Analyze trace with Paper Instruments Ultramarine-1-Flash"
          >
            <Sparkles
              className={`h-3.5 w-3.5 shrink-0 ${
                isAnalyzingUltramarine ? "animate-spin" : ""
              }`}
            />
            <span className="hidden xl:inline">
              {isAnalyzingUltramarine
                ? "Calling Ultramarine..."
                : "Run with Ultramarine"}
            </span>
            <span className="hidden sm:inline xl:hidden">
              {isAnalyzingUltramarine ? "..." : "Ultramarine"}
            </span>
          </button>
        )}

        {/* UNIFIED OBSERVABILITY & IDENTITY CLUSTER (SENTRY + AUTH0) */}
        <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-lg bg-[#161b22] border border-purple-500/30 shadow-sm shrink-0">
          {/* Sentry Agent Tracing Live Status Indicator */}
          <div
            className="flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 shrink-0"
            title="Sentry Agent Tracing instrumenting OpenTelemetry gen_ai spans & breadcrumbs"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse shrink-0" />
            <span className="hidden sm:inline">Sentry:</span>
            <span>Tracing</span>
          </div>

          {/* Auth0 Authentication State Badge & Login / Logout Button */}
          {authState?.isAuthenticated && authState.user ? (
            <div className="flex items-center gap-1.5">
              <div
                className="flex items-center gap-1 text-xs text-gray-200 bg-gray-800/80 px-2 py-1 rounded border border-gray-700 font-medium"
                title={`Logged in as ${authState.user.email || authState.user.userId}`}
              >
                <Shield className="h-3 w-3 text-emerald-400 shrink-0" />
                <span className="max-w-[70px] sm:max-w-[100px] truncate">
                  {authState.user.name || authState.user.email || "Investigator"}
                </span>
                <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" />
              </div>
              <a
                href="/auth/logout"
                className="text-[10px] text-gray-400 hover:text-red-400 px-1 py-0.5 rounded transition font-medium"
                title="Sign out of Auth0"
              >
                Logout
              </a>
            </div>
          ) : (
            <a
              href="/auth/login"
              id="header-auth0-login-btn"
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition shrink-0"
              title="Authenticate with Auth0 Universal Login"
            >
              <Shield className="h-3.5 w-3.5 text-white shrink-0" />
              <span>Log in</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
};
