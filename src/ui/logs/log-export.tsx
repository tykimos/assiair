'use client';

import React from 'react';
import { useWidget } from '@/widget/widget-provider';
import { Download, Trash2 } from 'lucide-react';

export function LogExport() {
  const { logs, clearLogs } = useWidget();

  const handleExport = () => {
    const data = JSON.stringify(logs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assiair-logs-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-1">
      <button
        onClick={handleExport}
        disabled={logs.length === 0}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg text-text-muted hover:text-foreground hover:bg-hover disabled:opacity-40 transition-colors"
        title="Export JSON"
      >
        <Download size={12} />
        Export
      </button>
      <button
        onClick={clearLogs}
        disabled={logs.length === 0}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg text-red-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
        title="Clear Logs"
      >
        <Trash2 size={12} />
        Clear
      </button>
    </div>
  );
}
