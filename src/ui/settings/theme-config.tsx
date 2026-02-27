'use client';

import React from 'react';
import { useWidget } from '@/widget/widget-provider';
import { Palette } from 'lucide-react';
import type { WidgetConfig } from '@/types';

type ThemeId = WidgetConfig['theme'];

interface ThemeDef {
  id: ThemeId;
  label: string;
  preview: { bg: string; primary: string; accent: string };
}

const THEMES: ThemeDef[] = [
  {
    id: 'light',
    label: 'Light',
    preview: { bg: '#fafafa', primary: '#6366f1', accent: '#8b5cf6' },
  },
  {
    id: 'assiworks',
    label: 'AssiWorks',
    preview: { bg: '#f5f3ff', primary: '#4f46e5', accent: '#7c3aed' },
  },
  {
    id: 'aifactory',
    label: 'AIFactory',
    preview: { bg: '#fffbf0', primary: '#f59e0b', accent: '#f97316' },
  },
  {
    id: 'dark',
    label: 'Dark',
    preview: { bg: '#0f172a', primary: '#818cf8', accent: '#a78bfa' },
  },
];

export function ThemeConfig() {
  const { config, updateConfig } = useWidget();

  return (
    <div className="p-4 border border-border rounded-xl space-y-3" style={{ background: 'var(--card-bg)' }}>
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
        >
          <Palette size={12} className="text-white" />
        </div>
        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Theme</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {THEMES.map(theme => {
          const active = config.theme === theme.id;
          return (
            <button
              key={theme.id}
              onClick={() => updateConfig({ theme: theme.id })}
              className="flex flex-col items-center gap-1.5 p-2 rounded-lg text-xs transition-all"
              style={{
                border: active ? `2px solid ${theme.preview.primary}` : '2px solid var(--border)',
                background: active ? 'var(--secondary)' : 'transparent',
              }}
            >
              {/* Color swatch */}
              <div
                className="w-full h-6 rounded-md flex items-center justify-center gap-1"
                style={{ background: theme.preview.bg, border: '1px solid var(--border)' }}
              >
                <div className="w-3 h-3 rounded-full" style={{ background: theme.preview.primary }} />
                <div className="w-2 h-2 rounded-full" style={{ background: theme.preview.accent }} />
              </div>
              <span
                className="font-medium"
                style={{ color: active ? theme.preview.primary : 'var(--text-muted)', fontSize: '10px' }}
              >
                {theme.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
