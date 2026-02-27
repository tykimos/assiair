'use client';

import React, { useState } from 'react';
import { LogViewer } from '@/ui/logs/log-viewer';
import { LogFilter } from '@/ui/logs/log-filter';
import { LogExport } from '@/ui/logs/log-export';

export function LogsTab() {
  const [filterCategory, setFilterCategory] = useState('All');

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card-bg">
        <LogFilter activeCategory={filterCategory} onCategoryChange={setFilterCategory} />
        <div className="ml-auto">
          <LogExport />
        </div>
      </div>
      <LogViewer filterCategory={filterCategory} />
    </div>
  );
}
