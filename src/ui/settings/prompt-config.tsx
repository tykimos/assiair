'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useWidget } from '@/widget/widget-provider';
import { getSkillRegistry } from '@/skills/registry';
import { getWorkflowRegistry } from '@/workflows/registry';
import { ORCHESTRATOR_DEFAULT_BASE, buildDynamicSections } from '@/orchestrator/orchestrator-prompt';
import { EXECUTOR_BASE_PROMPT } from '@/executor/executor-prompt';
import { MessageSquare, RotateCcw } from 'lucide-react';

type PromptTab = 'orchestrator' | 'executor';

export function PromptConfig() {
  const { config, updateConfig } = useWidget();
  const [activeTab, setActiveTab] = useState<PromptTab>('orchestrator');

  // Orchestrator: editable base (user override or default)
  const [orchBase, setOrchBase] = useState(config.systemPrompt || ORCHESTRATOR_DEFAULT_BASE);
  // Executor: editable full prompt (user override or default)
  const [execPrompt, setExecPrompt] = useState(config.executorPrompt || EXECUTOR_BASE_PROMPT);

  useEffect(() => {
    setOrchBase(config.systemPrompt || ORCHESTRATOR_DEFAULT_BASE);
    setExecPrompt(config.executorPrompt || EXECUTOR_BASE_PROMPT);
  }, [config.systemPrompt, config.executorPrompt]);

  // Dynamic sections (auto-generated from active workflows/skills)
  const dynamicSection = useMemo(() => {
    const registry = getSkillRegistry();
    const workflowRegistry = getWorkflowRegistry();
    const workflows = workflowRegistry.getAll();
    const skillMetas = registry.getAllSkillMetas();
    return buildDynamicSections(workflows, skillMetas);
  }, [config.activeSkills, config.activeWorkflows, config.customSkills, config.customWorkflows]);

  const orchHasChanges = orchBase !== (config.systemPrompt || ORCHESTRATOR_DEFAULT_BASE);
  const execHasChanges = execPrompt !== (config.executorPrompt || EXECUTOR_BASE_PROMPT);
  const orchIsOverridden = !!config.systemPrompt;
  const execIsOverridden = !!config.executorPrompt;

  const handleSave = () => {
    if (activeTab === 'orchestrator') {
      // Save empty string if same as default (no override)
      const value = orchBase === ORCHESTRATOR_DEFAULT_BASE ? '' : orchBase;
      updateConfig({ systemPrompt: value });
    } else {
      const value = execPrompt === EXECUTOR_BASE_PROMPT ? '' : execPrompt;
      updateConfig({ executorPrompt: value });
    }
  };

  const handleReset = () => {
    if (activeTab === 'orchestrator') {
      setOrchBase(ORCHESTRATOR_DEFAULT_BASE);
      updateConfig({ systemPrompt: '' });
    } else {
      setExecPrompt(EXECUTOR_BASE_PROMPT);
      updateConfig({ executorPrompt: '' });
    }
  };

  return (
    <div className="p-4 bg-card-bg border border-border rounded-xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)' }}
        >
          <MessageSquare size={12} className="text-white" />
        </div>
        <span className="text-sm font-medium text-foreground">System Prompt</span>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-border">
        {(['orchestrator', 'executor'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-3 py-1.5 text-xs font-medium transition-colors relative"
            style={{
              color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {tab === 'orchestrator' ? 'Orchestrator' : 'Executor'}
            {((tab === 'orchestrator' && orchIsOverridden) || (tab === 'executor' && execIsOverridden)) && (
              <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-amber-50 text-amber-600">Custom</span>
            )}
          </button>
        ))}
      </div>

      {/* Orchestrator tab */}
      {activeTab === 'orchestrator' && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-medium text-text-muted">
                Base Prompt (editable)
              </label>
              {orchIsOverridden && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 text-[10px] text-text-muted hover:text-foreground transition-colors"
                >
                  <RotateCcw size={10} />
                  Restore Defaults
                </button>
              )}
            </div>
            <textarea
              className="w-full px-3 py-2 text-[11px] font-mono leading-relaxed border border-border rounded-lg bg-background text-foreground resize-y min-h-[300px] max-h-[500px] focus:outline-none focus:ring-1 focus:ring-primary"
              value={orchBase}
              onChange={(e) => setOrchBase(e.target.value)}
            />
          </div>

          {/* Dynamic sections (read-only) */}
          <div>
            <label className="block text-[10px] font-medium text-text-muted mb-1">
              Flow / Skill List (auto-generated from active settings)
            </label>
            <pre className="px-3 py-2 text-[10px] leading-relaxed text-slate-500 whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-lg max-h-[200px] overflow-y-auto">
              {dynamicSection.trim()}
            </pre>
          </div>

          {orchHasChanges && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                className="px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors"
                style={{ background: 'var(--primary)' }}
              >
                Save
              </button>
              <button
                onClick={() => setOrchBase(config.systemPrompt || ORCHESTRATOR_DEFAULT_BASE)}
                className="px-3 py-1.5 text-xs font-medium text-text-muted rounded-lg hover:bg-slate-100 transition-colors"
              >
                Revert
              </button>
            </div>
          )}

          <p className="text-[10px] text-text-muted leading-relaxed">
            Custom base prompt is saved to localStorage. Flow/Skill list is always auto-appended based on active settings.
          </p>
        </div>
      )}

      {/* Executor tab */}
      {activeTab === 'executor' && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-medium text-text-muted">
                Executor Prompt (editable)
              </label>
              {execIsOverridden && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 text-[10px] text-text-muted hover:text-foreground transition-colors"
                >
                  <RotateCcw size={10} />
                  Restore Defaults
                </button>
              )}
            </div>
            <textarea
              className="w-full px-3 py-2 text-[11px] font-mono leading-relaxed border border-border rounded-lg bg-background text-foreground resize-y min-h-[300px] max-h-[500px] focus:outline-none focus:ring-1 focus:ring-primary"
              value={execPrompt}
              onChange={(e) => setExecPrompt(e.target.value)}
            />
          </div>

          {execHasChanges && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                className="px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors"
                style={{ background: 'var(--primary)' }}
              >
                Save
              </button>
              <button
                onClick={() => setExecPrompt(config.executorPrompt || EXECUTOR_BASE_PROMPT)}
                className="px-3 py-1.5 text-xs font-medium text-text-muted rounded-lg hover:bg-slate-100 transition-colors"
              >
                Revert
              </button>
            </div>
          )}

          <p className="text-[10px] text-text-muted leading-relaxed">
            Custom executor prompt is saved to localStorage. Each skill's Instructions are automatically appended after this prompt.
          </p>
        </div>
      )}
    </div>
  );
}
