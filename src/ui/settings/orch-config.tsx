'use client';

import React from 'react';
import { useWidget } from '@/widget/widget-provider';
import { Sliders } from 'lucide-react';

export function OrchConfig() {
  const { config, updateConfig } = useWidget();

  return (
    <div className="p-4 bg-card-bg border border-border rounded-xl space-y-4">
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--primary))' }}
        >
          <Sliders size={12} className="text-white" />
        </div>
        <span className="text-sm font-medium text-foreground">Orchestrator Settings</span>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-text-muted">Max Plan Steps</label>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
              style={{ background: 'var(--primary)' }}
            >
              {config.maxPlanSteps}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={config.maxPlanSteps}
            onChange={(e) => updateConfig({ maxPlanSteps: Number(e.target.value) })}
            className="w-full cursor-pointer"
            style={{ accentColor: 'var(--primary)' }}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-text-muted">Max Chain Depth</label>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
              style={{ background: 'var(--accent)' }}
            >
              {config.maxChainDepth}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={config.maxChainDepth}
            onChange={(e) => updateConfig({ maxChainDepth: Number(e.target.value) })}
            className="w-full cursor-pointer"
            style={{ accentColor: 'var(--accent)' }}
          />
        </div>
      </div>
    </div>
  );
}
