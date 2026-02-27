'use client';

import React from 'react';
import { useWidget } from '@/widget/widget-provider';
import { ChatTab } from './chat-tab';
import { SettingsTab } from './settings-tab';
import { LogsTab } from './logs-tab';

export function TabContainer() {
  const { activeTab } = useWidget();

  return (
    <div style={{ height: '100%', overflow: 'hidden', background: 'var(--background)' }}>
      {/* Keep all tabs mounted to preserve state */}
      <div className={activeTab === 'chat' ? 'h-full' : 'hidden'}>
        <ChatTab />
      </div>
      <div className={activeTab === 'settings' ? 'h-full' : 'hidden'}>
        <SettingsTab />
      </div>
      <div className={activeTab === 'logs' ? 'h-full' : 'hidden'}>
        <LogsTab />
      </div>
    </div>
  );
}
