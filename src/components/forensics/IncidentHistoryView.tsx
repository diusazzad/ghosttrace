"use client";

import React, { useEffect, useState } from "react";
import {
  Database,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  Clock,
  Coins,
  Cpu,
  ArrowRight,
} from "lucide-react";
import { StoredInvestigation } from "@/lib/db/traceRepository";

interface IncidentHistoryViewProps {
  onSelectHistoricalTrace?: (traceId: string) => void;
}

export const IncidentHistoryView: React.FC<IncidentHistoryViewProps> = ({
  onSelectHistoricalTrace,
}) => {
  const [investigations, setInvestigations] = useState<StoredInvestigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchAgent, setSearchAgent] = useState<string>("");
  const [storageEngine, setStorageEngine] = useState<string>("mongodb_atlas");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [stats, setStats] = useState<{
    totalTraces: number;
    failureCategoryCounts: Record<string, number>;
    averageTokens: number;
  }>({
    totalTraces: 0,
    failureCategoryCounts: {},
    averageTokens: 0,
  });

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        const url = new URL("/api/traces/history", window.location.origin);
        if (filterCategory !== "all") url.searchParams.set("category", filterCategory);
        if (searchAgent.trim()) url.searchParams.set("agent", searchAgent.trim());

        const res = await fetch(url.toString());
        if (!res.ok) {
          if (!ignore) setLoading(false);
          return;
        }

        const data = await res.json();
        if (!ignore && data.success) {
          setInvestigations(data.investigations || []);
          setStorageEngine(data.storageEngine || "mongodb_atlas");
          if (data.statistics) setStats(data.statistics);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load MongoDB Atlas history:", err);
        if (!ignore) setLoading(false);
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [filterCategory, searchAgent, refreshTrigger]);

  const handleManualRefresh = () => {
    setLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">MongoDB Atlas Trace Repository</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {storageEngine === "mongodb_atlas" ? "Cloud Connected" : "In-Memory Fallback"}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Historical incident timelines, causal findings, and synthesized regression test suites.
            </p>
          </div>
        </div>

        <button
          onClick={handleManualRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-800 text-gray-200 text-xs transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Database</span>
        </button>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-white">{stats.totalTraces}</div>
            <div className="text-[11px] text-gray-400">Archived Investigations</div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
            <Coins className="h-4 w-4" />
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-white">{stats.averageTokens.toLocaleString()}</div>
            <div className="text-[11px] text-gray-400">Average Token Footprint</div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-white">
              {Object.keys(stats.failureCategoryCounts).length}
            </div>
            <div className="text-[11px] text-gray-400">Distinct Failure Modes</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by agent name..."
            value={searchAgent}
            onChange={(e) => setSearchAgent(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualRefresh()}
            className="w-full bg-[#161b22] border border-gray-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5 text-gray-400" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-[#161b22] border border-gray-800 text-gray-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Failure Categories</option>
            <option value="infinite_loop">Infinite Tool Loop</option>
            <option value="tool_cascade_failure">Tool Cascade Failure</option>
            <option value="context_window_overflow">Context Window Overflow</option>
            <option value="schema_contract_violation">Schema Contract Violation</option>
            <option value="timeout_exhaustion">Timeout Exhaustion</option>
            <option value="none">Healthy Execution</option>
          </select>
        </div>
      </div>

      {/* Investigations Table */}
      <div className="rounded-xl border border-gray-800 bg-[#0d1117] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-purple-400" />
            <span>Querying MongoDB Atlas repository...</span>
          </div>
        ) : investigations.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400">
            No historical incident investigations match the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#161b22] text-gray-400 text-[11px] uppercase border-b border-gray-800 font-mono">
                <tr>
                  <th className="p-3.5">Agent / Trace ID</th>
                  <th className="p-3.5">Failure Category</th>
                  <th className="p-3.5">Root Cause Hypothesis</th>
                  <th className="p-3.5">Tokens &amp; Latency</th>
                  <th className="p-3.5">Investigated</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {investigations.map((item) => (
                  <tr key={item.traceId} className="hover:bg-gray-800/30 transition">
                    <td className="p-3.5">
                      <div className="font-semibold text-white">{item.agentName}</div>
                      <div className="font-mono text-[10px] text-gray-400">{item.traceId}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="inline-block px-2 py-0.5 rounded font-mono text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        {item.primaryFailureCategory}
                      </span>
                    </td>
                    <td className="p-3.5 max-w-xs">
                      <div className="text-gray-200 truncate">{item.hypothesis.title}</div>
                      <div className="text-[10px] text-gray-500 font-mono">
                        Citations: {item.hypothesis.groundedEventIds.join(", ") || "none"}
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-gray-300">
                      <div>{item.totalTokens.toLocaleString()} tokens</div>
                      <div className="text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{(item.totalDurationMs / 1000).toFixed(1)}s</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-gray-400 font-mono text-[10px]">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3.5 text-right">
                      {onSelectHistoricalTrace && (
                        <button
                          onClick={() => onSelectHistoricalTrace(item.traceId)}
                          className="px-2.5 py-1 rounded bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 transition text-xs font-mono inline-flex items-center gap-1"
                        >
                          <span>Inspect</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
