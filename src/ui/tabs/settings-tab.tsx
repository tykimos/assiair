'use client';

import React, { useState } from 'react';
import { ServerInfoDisplay } from '@/ui/settings/server-info';
import { OrchConfig } from '@/ui/settings/orch-config';
import { TriggerConfig } from '@/ui/settings/trigger-config';
import { SkillManager } from '@/ui/settings/skill-manager';
import { ThemeConfig } from '@/ui/settings/theme-config';
import { PromptConfig } from '@/ui/settings/prompt-config';
import { WorkflowManager } from '@/ui/settings/workflow-manager';
import { ToolManager } from '@/ui/settings/tool-manager';
import { ContextConfig } from '@/ui/settings/context-config';
import { ServiceEndpoints } from '@/ui/settings/service-endpoints';
import { Settings, MessageSquare, Puzzle, GitBranch, Wrench, Zap, Database, Globe } from 'lucide-react';

type SettingsPage = 'general' | 'prompts' | 'skills' | 'workflows' | 'tools' | 'context' | 'services' | 'triggers';

const PAGES: { id: SettingsPage; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: 'General', icon: <Settings size={14} /> },
  { id: 'prompts', label: 'Prompts', icon: <MessageSquare size={14} /> },
  { id: 'skills', label: 'Skills', icon: <Puzzle size={14} /> },
  { id: 'workflows', label: 'Flows', icon: <GitBranch size={14} /> },
  { id: 'tools', label: 'Tools', icon: <Wrench size={14} /> },
  { id: 'context', label: 'Context', icon: <Database size={14} /> },
  { id: 'services', label: 'Services', icon: <Globe size={14} /> },
  { id: 'triggers', label: 'Triggers', icon: <Zap size={14} /> },
];

export function SettingsTab() {
  const [currentPage, setCurrentPage] = useState<SettingsPage>('general');

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Top tab navigation — horizontally scrollable */}
      <div className="flex-shrink-0 border-b border-border overflow-x-auto">
        <div className="flex gap-0.5 px-2 py-1.5 min-w-max">
          {PAGES.map(page => {
            const isActive = currentPage === page.id;
            return (
              <button
                key={page.id}
                onClick={() => setCurrentPage(page.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                style={{
                  background: isActive ? 'var(--primary)' : 'transparent',
                  color: isActive ? 'white' : 'var(--text-muted)',
                }}
              >
                {page.icon}
                {page.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {currentPage === 'general' && (
          <>
            <ServerInfoDisplay />
            <OrchConfig />
            <ThemeConfig />
          </>
        )}
        {currentPage === 'prompts' && <PromptConfig />}
        {currentPage === 'skills' && <SkillManager />}
        {currentPage === 'workflows' && <WorkflowManager />}
        {currentPage === 'tools' && <ToolManager />}
        {currentPage === 'context' && <ContextConfig />}
        {currentPage === 'services' && <ServiceEndpoints />}
        {currentPage === 'triggers' && <TriggerConfig />}
      </div>
    </div>
  );
}
