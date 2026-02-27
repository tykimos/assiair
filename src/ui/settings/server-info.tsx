'use client';

import React from 'react';
import { useWidget } from '@/widget/widget-provider';
import { Server } from 'lucide-react';

export function ServerInfoDisplay() {
  const { serverConfig } = useWidget();

  if (!serverConfig) {
    return (
      <div className="p-4 bg-card-bg border border-border rounded-xl">
        <div className="flex items-center gap-2 text-text-muted">
          <Server size={15} />
          <span className="text-sm">Loading server info...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-card-bg border border-border rounded-xl space-y-3">
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
        >
          <Server size={12} className="text-white" />
        </div>
        <span className="text-sm font-medium text-foreground">Server Info</span>
        <span className="text-xs text-text-muted ml-auto bg-secondary px-2 py-0.5 rounded-full">
          v{serverConfig.version}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm">
        <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
          <span className="text-xs text-text-muted">Provider</span>
          <span className="font-mono text-xs text-foreground">{serverConfig.provider}</span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
          <span className="text-xs text-text-muted">Orchestrator</span>
          <span className="font-mono text-xs text-foreground">{serverConfig.orchModel}</span>
        </div>
        <div className="flex items-center justify-between py-1.5">
          <span className="text-xs text-text-muted">Executor</span>
          <span className="font-mono text-xs text-foreground">{serverConfig.execModel}</span>
        </div>
      </div>
    </div>
  );
}
