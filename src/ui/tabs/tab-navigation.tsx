'use client';

import React from 'react';
import { useWidget } from '@/widget/widget-provider';
import { MessageSquare, Settings, ScrollText } from 'lucide-react';

const TABS = [
  { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
  { id: 'settings' as const, label: 'Settings', icon: Settings },
  { id: 'logs' as const, label: 'Logs', icon: ScrollText },
];

export function TabNavigation() {
  const { activeTab, setActiveTab } = useWidget();

  return (
    <div className="flex border-b border-border bg-card-bg flex-shrink-0">
      {TABS.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm transition-all ${
              isActive
                ? 'text-primary border-b-2 border-primary font-medium -mb-px'
                : 'text-text-muted hover:text-foreground'
            }`}
          >
            <Icon size={15} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
