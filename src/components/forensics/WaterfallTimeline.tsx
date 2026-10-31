"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Cpu,
  Wrench,
  Database,
  AlertOctagon,
  Clock,
  Sparkles,
} from "lucide-react";
import { TraceEvent, TraceRun } from "@/types/trace";

interface WaterfallTimelineProps {
  trace: TraceRun;
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
}

export const WaterfallTimeline: React.FC<WaterfallTimelineProps> = ({
  trace,
  selectedEventId,
  onSelectEvent,
}) => {
  const [filter, setFilter] = useState<string>("all");
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedEvents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const events = trace.events || [];
  const filteredEvents = events.filter((evt) => {
    if (filter === "all") return true;
    if (filter === "llm") return evt.type === "llm";
    if (filter === "tool") return evt.type === "tool";
    if (filter === "error") return evt.type === "error" || evt.status === "error";
    return true;
  });

  const getEventIcon = (type?: string) => {
    switch (type) {
      case "llm":
        return <Cpu className="h-3.5 w-3.5 text-blue-400" />;
      case "tool":
        return <Wrench className="h-3.5 w-3.5 text-purple-400" />;
      case "state":
        return <Database className="h-3.5 w-3.5 text-amber-400" />;
      case "error":
        return <AlertOctagon className="h-3.5 w-3.5 text-rose-400" />;
      default:
        return <Database className="h-3.5 w-3.5 text-gray-400" />;
    }
  };

  const getBarColor = (evt: TraceEvent) => {
    if (evt.status === "error" || evt.type === "error") {
      return "bg-rose-500 shadow-rose-500/30";
    }
    if (evt.isCausalAnomaly) {
      return "bg-amber-500 shadow-amber-500/30";
    }
    switch (evt.type) {
      case "llm":
        return "bg-blue-500 shadow-blue-500/20";
      case "tool":
        return "bg-purple-500 shadow-purple-500/20";
      case "state":
        return "bg-amber-400 shadow-amber-400/20";
      default:
        return "bg-emerald-500 shadow-emerald-500/20";
    }
  };

  const totalTime = Math.max(trace.totalDurationMs || 1, 1);

  return (
    <div className="rounded-xl border border-gray-800 bg-[#0d1117] overflow-hidden flex flex-col shadow-xl">
      {/* Header & Filter Controls */}
      <div className="p-3 sm:p-4 border-b border-gray-800 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 bg-[#161b22]/40">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-purple-400 shrink-0" />
          <h2 className="text-xs sm:text-sm font-semibold text-white">Execution Waterfall Timeline</h2>
          <span className="text-[10px] font-mono text-gray-400">
            ({filteredEvents.length} events)
          </span>
        </div>

        {/* Filter Pills with explicit acronym styling for LLM */}
        <div className="flex items-center gap-1 bg-[#0a0d13] p-1 rounded-lg border border-gray-800 text-xs shrink-0">
          {[
            { id: "all", label: "All" },
            { id: "llm", label: "LLM" },
            { id: "tool", label: "Tools" },
            { id: "error", label: "Errors" },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-medium transition ${
                filter === id
                  ? "bg-purple-600/30 text-purple-300 border border-purple-500/40"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Horizontal Scroll Canvas for narrow viewports */}
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          {/* Timeline Ruler Header */}
          <div className="grid grid-cols-12 px-4 py-2 border-b border-gray-800/80 bg-black/30 text-[10px] font-mono text-gray-500">
            <div className="col-span-5 sm:col-span-4">SPAN / OPERATION</div>
            <div className="col-span-2 sm:col-span-2 text-right pr-4">DURATION</div>
            <div className="col-span-5 sm:col-span-6 relative flex justify-between">
              <span>0ms</span>
              <span>{Math.round(totalTime * 0.25)}ms</span>
              <span>{Math.round(totalTime * 0.5)}ms</span>
              <span>{Math.round(totalTime * 0.75)}ms</span>
              <span>{totalTime}ms</span>
            </div>
          </div>

          {/* Events List */}
          <div className="divide-y divide-gray-800/60 max-h-[600px] overflow-y-auto">
            {filteredEvents.map((evt) => {
              const isSelected = selectedEventId === evt.id;
              const isExpanded = !!expandedEvents[evt.id];
              const startTimeMs = typeof evt.startTimeMs === "number" && !isNaN(evt.startTimeMs) ? evt.startTimeMs : 0;
              const durationMs = typeof evt.durationMs === "number" && !isNaN(evt.durationMs) ? evt.durationMs : 10;
              const leftPercent = Math.min(Math.max((startTimeMs / totalTime) * 100, 0), 98);
              const widthPercent = Math.max(Math.min((durationMs / totalTime) * 100, 100 - leftPercent), 2);

              return (
                <div
                  key={evt.id}
                  onClick={() => onSelectEvent(isSelected ? null : evt.id)}
                  className={`transition cursor-pointer ${
                    isSelected
                      ? "bg-purple-950/20 border-l-4 border-l-purple-500"
                      : evt.isCausalAnomaly
                      ? "bg-rose-950/10 hover:bg-rose-950/20"
                      : "hover:bg-gray-800/30"
                  }`}
                >
                  {/* Row Grid */}
                  <div className="grid grid-cols-12 px-4 py-2.5 items-center gap-2 text-xs">
                    {/* Name & ID */}
                    <div className="col-span-5 sm:col-span-4 flex items-center gap-2 overflow-hidden">
                      <button
                        onClick={(e) => toggleExpand(evt.id, e)}
                        className="text-gray-400 hover:text-gray-200 shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>

                      <div className="p-1 rounded bg-black/40 border border-gray-800 shrink-0">
                        {getEventIcon(evt.type)}
                      </div>

                      <div className="flex flex-col truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] font-semibold text-gray-200 truncate">
                            {evt.name}
                          </span>
                          {evt.isCausalAnomaly && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 flex items-center gap-0.5">
                              <Sparkles className="h-2.5 w-2.5" />
                              <span>Anomaly</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-gray-500 truncate">
                          #{evt.id}
                        </span>
                      </div>
                    </div>

                    {/* Duration & Tokens */}
                    <div className="col-span-2 sm:col-span-2 text-right pr-4 font-mono text-[11px] text-gray-400">
                      <div>{durationMs}ms</div>
                      {evt.tokens && (
                        <div className="text-[9px] text-gray-500">
                          {evt.tokens.total} tok
                        </div>
                      )}
                    </div>

                    {/* Visual Gantt Bar */}
                    <div className="col-span-5 sm:col-span-6 relative h-6 flex items-center bg-[#0a0d13]/60 rounded border border-gray-800/40 px-1 overflow-hidden">
                      <div
                        style={{
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                        }}
                        className={`absolute h-3.5 rounded transition-all duration-300 shadow-sm ${getBarColor(
                          evt
                        )}`}
                      />
                    </div>
                  </div>

                  {/* Expanded Inspector Drawer */}
                  {isExpanded && (
                    <div className="px-10 py-3 bg-black/40 border-t border-gray-800/50 text-[11px] font-mono text-gray-300 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Input Payload */}
                      <div>
                        <span className="text-gray-500 uppercase tracking-wider block mb-1">
                          Input Payload
                        </span>
                        <pre className="p-2 rounded bg-[#0a0d13] border border-gray-800/80 overflow-x-auto text-gray-400 max-h-36">
                          {evt.input
                            ? JSON.stringify(evt.input, null, 2)
                            : "// No input payload recorded"}
                        </pre>
                      </div>

                      {/* Output Payload / Error */}
                      <div>
                        <span className="text-gray-500 uppercase tracking-wider block mb-1">
                          {evt.error ? "Error Traceback" : "Output Result"}
                        </span>
                        <pre
                          className={`p-2 rounded border overflow-x-auto max-h-36 ${
                            evt.error
                              ? "bg-rose-950/20 border-rose-800/40 text-rose-300"
                              : "bg-[#0a0d13] border-gray-800/80 text-gray-400"
                          }`}
                        >
                          {evt.error
                            ? evt.error
                            : evt.output
                            ? JSON.stringify(evt.output, null, 2)
                            : "// No output payload recorded"}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredEvents.length === 0 && (
              <div className="p-8 text-center text-xs text-gray-500">
                No events matched the current filter.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
