'use client';

import React from 'react';
import { Filter } from 'lucide-react';

const CATEGORIES = ['All', 'ORCH', 'EXEC', 'TOOL', 'SIGNAL', 'POST'] as const;

const CATEGORY_ACTIVE_COLORS: Record<string, string> = {
  All: 'var(--foreground)',
  ORCH: 'var(--accent)',
  EXEC: 'var(--primary)',
  TOOL: 'var(--warning)',
  SIGNAL: 'var(--success)',
  POST: '#f97316',
};

interface LogFilterProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export function LogFilter({ activeCategory, onCategoryChange }: LogFilterProps) {
  return (
    <div className="flex items-center gap-1">
      <Filter size={13} className="text-text-muted mr-0.5" />
      {CATEGORIES.map(cat => {
        const isActive = activeCategory === cat;
        const activeColor = CATEGORY_ACTIVE_COLORS[cat];
        return (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className="px-2 py-0.5 text-[11px] rounded-full transition-all font-medium"
            style={{
              background: isActive ? `${activeColor}18` : 'transparent',
              color: isActive ? activeColor : 'var(--text-muted)',
              border: isActive ? `1px solid ${activeColor}40` : '1px solid transparent',
            }}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}
