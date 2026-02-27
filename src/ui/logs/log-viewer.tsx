'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useWidget } from '@/widget/widget-provider';
import type { LogCategory } from '@/types';

const CATEGORY_COLORS: Record<LogCategory, string> = {
  ORCH: 'text-accent',
  EXEC: 'text-primary',
  TOOL: 'text-warning',
  SIGNAL: 'text-success',
  POST: 'text-orange-500',
};

const CATEGORY_BG: Record<LogCategory, string> = {
  ORCH: 'bg-accent/10',
  EXEC: 'bg-primary/10',
  TOOL: 'bg-warning/10',
  SIGNAL: 'bg-success/10',
  POST: 'bg-orange-500/10',
};

const LEVEL_BG: Record<string, string> = {
  info: '',
  warn: 'bg-warning/5',
  error: 'bg-red-50',
  debug: '',
};

/** Truncate data URLs for display */
function truncateForDisplay(value: unknown, depth = 0): unknown {
  if (depth > 4) return '...';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.startsWith('data:') && value.length > 100) {
      return value.slice(0, 60) + `...[${Math.round(value.length / 1024)}KB]`;
    }
    if (value.length > 300) return value.slice(0, 300) + '...';
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(v => truncateForDisplay(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = truncateForDisplay(v, depth + 1);
    }
    return out;
  }
  return value;
}

interface LogViewerProps {
  filterCategory?: string;
}

export function LogViewer({ filterCategory = 'All' }: LogViewerProps) {
  const { logs } = useWidget();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filteredLogs = filterCategory === 'All'
    ? logs
    : logs.filter(log => log.category === filterCategory);

  return (
    <div
      className="flex-1 overflow-y-auto font-mono text-xs p-3 space-y-0.5 bg-background"
      onScroll={(e) => {
        const el = e.currentTarget;
        const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
        setAutoScroll(isAtBottom);
      }}
    >
      {filteredLogs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-text-muted">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 opacity-40">
            <path d="M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5M17 9.5C17 9.5 16 8 12 8s-5 1.5-5 1.5" />
            <circle cx="12" cy="12" r="10" />
          </svg>
          <p className="text-xs">No logs</p>
        </div>
      )}

      {filteredLogs.map(log => {
        const hasData = log.data !== undefined && log.data !== null;
        const isExpanded = expandedIds.has(log.id);

        return (
          <div key={log.id}>
            <div
              className={`flex gap-2 py-1 px-2 rounded-lg ${LEVEL_BG[log.level] || ''} ${hasData ? 'cursor-pointer hover:bg-slate-50' : ''}`}
              onClick={hasData ? () => toggleExpand(log.id) : undefined}
            >
              <span className="text-text-muted flex-shrink-0 opacity-60">
                {log.timestamp.toLocaleTimeString('ko-KR', { hour12: false })}
              </span>
              <span
                className={`flex-shrink-0 font-bold px-1 rounded text-[10px] ${CATEGORY_COLORS[log.category]} ${CATEGORY_BG[log.category]}`}
              >
                {log.category}
              </span>
              <span className="text-foreground break-all opacity-80 flex-1">
                {log.message}
              </span>
              {hasData && (
                <span className="text-text-muted flex-shrink-0 opacity-40 text-[10px] select-none">
                  {isExpanded ? '▾' : '▸'}
                </span>
              )}
            </div>
            {hasData && isExpanded && (
              <div className="ml-[72px] mr-2 mb-1 px-2 py-1.5 rounded bg-slate-50 border border-border text-[10px] leading-relaxed overflow-x-auto">
                <pre className="whitespace-pre-wrap text-slate-600">
                  {JSON.stringify(truncateForDisplay(log.data), null, 2)}
                </pre>
              </div>
            )}
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
