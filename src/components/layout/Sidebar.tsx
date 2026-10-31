"use client";

import React from "react";
import {
  Ghost,
  Activity,
  Layers,
  ShieldAlert,
  FileCode2,
  Radio,
  Cpu,
  CheckCircle2,
  Database,
  ExternalLink,
  X,
} from "lucide-react";

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  sampleCount: number;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  sampleCount,
  isOpen = false,
  onClose,
}) => {
  const navItems = [
    { id: "trace", label: "Trace Forensics", icon: Activity, badge: `${sampleCount} Runs` },
    { id: "timeline", label: "Waterfall Timeline", icon: Layers },
    { id: "hypotheses", label: "Evidence Root Cause", icon: ShieldAlert },
    { id: "regression", label: "Test Exporter", icon: FileCode2 },
    { id: "history", label: "Atlas Incident History", icon: Database, badge: "MongoDB" },
    { id: "live", label: "Agent Ingestion", icon: Radio, badge: "Sentry" },
  ];

  const handleNavClick = (tabId: string) => {
    onTabChange(tabId);
    if (onClose) {
      onClose();
    }
  };

  const renderContent = (isMobile: boolean) => (
    <>
      <div>
        {/* Brand Header */}
        <div className="p-4 sm:p-5 border-b border-gray-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
              <Ghost className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-white text-base">GhostTrace</span>
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  v0.1
                </span>
              </div>
              <p className="text-[11px] text-gray-400">Agent Forensic Debugger</p>
            </div>
          </div>
          {isMobile && onClose && (
            <button
              onClick={onClose}
              aria-label="Close sidebar navigation"
              className="p-1.5 rounded-lg border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800 transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="p-3 flex flex-col gap-1">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Forensics Workspace
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? "bg-purple-600/15 text-purple-300 border border-purple-500/30 font-semibold"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/40"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${isActive ? "text-purple-400" : "text-gray-400"}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      isActive
                        ? "bg-purple-500/20 text-purple-300"
                        : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* System Status Footer */}
      <div className="p-4 border-t border-gray-800/80 bg-black/20 text-xs flex flex-col gap-2.5">
        <div className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider">
          Runtime Verification
        </div>

        <div className="flex items-center justify-between text-gray-300 text-[11px]">
          <span className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-blue-400" />
            <span>Gemma 2 Reasoner</span>
          </span>
          <span className="text-[10px] font-mono text-emerald-400">READY</span>
        </div>

        <div className="flex items-center justify-between text-gray-300 text-[11px]">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>Grounding Defense</span>
          </span>
          <span className="text-[10px] font-mono text-emerald-400">ENFORCED</span>
        </div>

        <div className="flex items-center justify-between text-gray-300 text-[11px]">
          <span className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-emerald-400" />
            <span>MongoDB Atlas</span>
          </span>
          <span className="text-[10px] font-mono text-emerald-400">PERSISTENT</span>
        </div>

        <a
          href="https://github.com/diusazzad/ghosttrace"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 pt-2 border-t border-gray-800/60 flex items-center justify-between text-[11px] text-gray-400 hover:text-gray-200 transition"
        >
          <span>diusazzad/ghosttrace</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-gray-800/80 bg-[#0d1117] flex-col justify-between shrink-0 h-screen sticky top-0 select-none z-30">
        {renderContent(false)}
      </aside>

      {/* 2. Mobile / Tablet Overlay Drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 lg:hidden transition-opacity"
          onClick={onClose}
          aria-label="Close mobile navigation"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[#0d1117] border-r border-gray-800 z-50 flex flex-col justify-between shadow-2xl transition-transform duration-300 ease-in-out lg:hidden select-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {renderContent(true)}
      </aside>
    </>
  );
};
