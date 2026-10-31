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

  const filteredEvents = trace.events.filter((evt) => {
    if (filter === "all") return true;
    if (filter === "llm") return evt.type === "llm";
    if (filter === "tool") return evt.type === "tool";
    if (filter === "error") return evt.type === "error" || evt.status === "error";
    return true;
  });

  const getEventIcon = (type: TraceEvent["type"]) => {
    switch (type) {
      case "llm":
        return <Cpu className="h-3.5 w-3.5 text-blue-400" />;
      case "tool":
        return <Wrench className="h-3.5 w-3.5 text-purple-400" />;
      case "state":
        return <Database className="h-3.5 w-3.5 text-amber-400" />;
      case "error":
        return <AlertOctagon className="h-3.5 w-3.5 text-rose-400" />;
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
        return "bg-gray-500";
    }
  };

  const totalTime = Math.max(trace.totalDurationMs, 1);

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

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-[#0a0d13] p-1 rounded-lg border border-gray-800 text-xs shrink-0">
          {["all", "llm", "tool", "error"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs capitalize transition ${
                filter === f
                  ? "bg-purple-600/30 text-purple-300 font-medium border border-purple-500/40"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {f === "error" ? "Errors" : f}
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
              const leftPercent = Math.min((evt.startTimeMs / totalTime) * 100, 98);
              const widthPercent = Math.max((evt.durationMs / totalTime) * 100, 2);

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
                            <span className="shrink-0 text-[9px] font-mono px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-0.5">
                              <Sparkles className="h-2 w-2" />
                              <span>CAUSE</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-gray-500">#{evt.id}</span>
                      </div>
                    </div>

                    {/* Duration */}
                    <div className="col-span-2 sm:col-span-2 text-right pr-4 font-mono text-[11px] text-gray-400">
                      {evt.durationMs}ms
                    </div>

                    {/* Waterfall Visual Bar */}
                    <div className="col-span-5 sm:col-span-6 relative h-6 flex items-center">
                      {/* Subtle Grid Track */}
                      <div className="absolute inset-0 border-x border-gray-800/40 pointer-events-none" />

                      {/* Offset Bar */}
                      <div
                        style={{
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                        }}
                        className={`absolute h-4 rounded-sm shadow-sm transition-all duration-300 flex items-center px-1.5 ${getBarColor(
                          evt
                        )}`}
                      >
                        <span className="text-[9px] font-mono font-bold text-white/90 drop-shadow truncate">
                          {evt.durationMs > 150 ? `${evt.durationMs}ms` : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded JSON Inspector Drawer */}
                  {isExpanded && (
                    <div className="px-10 pb-4 pt-1 bg-black/40 text-[11px] font-mono border-t border-gray-800/40 flex flex-col gap-2">
                      {evt.input && (
                        <div>
                          <div className="text-gray-500 text-[10px] uppercase font-semibold mb-1">
                            Input Payload:
                          </div>
                          <pre className="p-2.5 rounded bg-[#161b22] border border-gray-800 text-gray-300 overflow-x-auto">
                            {typeof evt.input === "string"
                              ? evt.input
                              : JSON.stringify(evt.input, null, 2)}
                          </pre>
                        </div>
                      )}

                      {evt.output && (
                        <div>
                          <div className="text-gray-500 text-[10px] uppercase font-semibold mb-1">
                            Output Result:
                          </div>
                          <pre className="p-2.5 rounded bg-[#161b22] border border-gray-800 text-gray-300 overflow-x-auto">
                            {typeof evt.output === "string"
                              ? evt.output
                              : JSON.stringify(evt.output, null, 2)}
                          </pre>
                        </div>
                      )}

                      {evt.error && (
                        <div>
                          <div className="text-rose-400 text-[10px] uppercase font-semibold mb-1">
                            Captured Exception:
                          </div>
                          <div className="p-2.5 rounded bg-rose-950/30 border border-rose-800/50 text-rose-300">
                            {evt.error}
                          </div>
                        </div>
                      )}

                      {evt.tokens && (
                        <div className="flex items-center gap-4 text-gray-400 text-[10px]">
                          <span>Prompt Tokens: {evt.tokens.prompt}</span>
                          <span>Completion: {evt.tokens.completion}</span>
                          <span className="text-purple-400 font-semibold">
                            Total: {evt.tokens.total}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
