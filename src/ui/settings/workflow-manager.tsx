'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useWidget } from '@/widget/widget-provider';
import { getWorkflowRegistry } from '@/workflows/registry';
import { GitBranch, ChevronDown, Plus, Trash2, X, RotateCcw } from 'lucide-react';
import type { CustomWorkflowRecord } from '@/types/widget';
import type { WorkflowDefinition } from '@/types';

interface WorkflowEditState {
  description: string;
  trigger_patterns: string;
  steps_natural: string;
}

function wfToEditState(wf: WorkflowDefinition): WorkflowEditState {
  return {
    description: wf.description,
    trigger_patterns: wf.trigger_patterns.join('\n'),
    steps_natural: wf.steps_natural || wf.steps.map(s => s.skill_id).join(' → '),
  };
}

function hasChanges(original: WorkflowDefinition, edit: WorkflowEditState): boolean {
  return (
    edit.description !== original.description ||
    edit.trigger_patterns !== original.trigger_patterns.join('\n') ||
    edit.steps_natural !== (original.steps_natural || original.steps.map(s => s.skill_id).join(' → '))
  );
}

export function WorkflowManager() {
  const { config, updateConfig } = useWidget();
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null);
  const [editStates, setEditStates] = useState<Record<string, WorkflowEditState>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');

  const registry = useMemo(() => getWorkflowRegistry(), []);
  const allWorkflows = useMemo(() => registry.getAllDefinitions(), [registry, config.customWorkflows]);

  const handleExpand = useCallback((name: string) => {
    if (expandedWorkflow === name) {
      setExpandedWorkflow(null);
      return;
    }
    setExpandedWorkflow(name);
    const wf = allWorkflows.find(w => w.name === name);
    if (wf && !editStates[name]) {
      setEditStates(prev => ({ ...prev, [name]: wfToEditState(wf) }));
    }
  }, [expandedWorkflow, allWorkflows, editStates]);

  useEffect(() => {
    setEditStates(prev => {
      const next = { ...prev };
      for (const wf of allWorkflows) {
        if (!next[wf.name]) {
          next[wf.name] = wfToEditState(wf);
        }
      }
      return next;
    });
  }, [allWorkflows]);

  const updateField = (name: string, field: keyof WorkflowEditState, value: string) => {
    setEditStates(prev => ({
      ...prev,
      [name]: { ...prev[name], [field]: value },
    }));
  };

  const toggleWorkflow = (name: string) => {
    const activeWorkflows = config.activeWorkflows.includes(name)
      ? config.activeWorkflows.filter(w => w !== name)
      : [...config.activeWorkflows, name];
    updateConfig({ activeWorkflows });
  };

  const handleSave = (name: string) => {
    const edit = editStates[name];
    if (!edit) return;

    const record: CustomWorkflowRecord = {
      name,
      description: edit.description.trim(),
      trigger_patterns: edit.trigger_patterns.split('\n').map(p => p.trim()).filter(Boolean),
      steps_natural: edit.steps_natural.trim(),
    };

    registry.register({
      name: record.name,
      description: record.description,
      trigger_patterns: record.trigger_patterns,
      steps: [],
      steps_natural: record.steps_natural,
    });

    const existing = config.customWorkflows.find(w => w.name === name);
    const customWorkflows = existing
      ? config.customWorkflows.map(w => w.name === name ? record : w)
      : [...config.customWorkflows, record];
    updateConfig({ customWorkflows });
  };

  const handleRevert = (name: string) => {
    const wf = allWorkflows.find(w => w.name === name);
    if (wf) {
      setEditStates(prev => ({ ...prev, [name]: wfToEditState(wf) }));
    }
  };

  const handleRestoreDefault = (name: string) => {
    const original = registry.getBuiltinOriginal(name);
    if (!original) return;

    registry.register(original);
    updateConfig({
      customWorkflows: config.customWorkflows.filter(w => w.name !== name),
    });
    setEditStates(prev => ({ ...prev, [name]: wfToEditState(original) }));
  };

  const handleDelete = (name: string) => {
    registry.remove(name);
    updateConfig({
      customWorkflows: config.customWorkflows.filter(w => w.name !== name),
      activeWorkflows: config.activeWorkflows.filter(w => w !== name),
    });
    if (expandedWorkflow === name) setExpandedWorkflow(null);
    setEditStates(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleAdd = () => {
    const id = newName.trim();
    if (!id || allWorkflows.some(w => w.name === id)) return;

    const record: CustomWorkflowRecord = {
      name: id,
      description: '',
      trigger_patterns: [],
      steps_natural: '',
    };

    registry.register({
      name: id,
      description: '',
      trigger_patterns: [],
      steps: [],
      steps_natural: '',
    });

    updateConfig({
      customWorkflows: [...config.customWorkflows, record],
      activeWorkflows: [...config.activeWorkflows, id],
    });

    setNewName('');
    setShowAddForm(false);
    setEditStates(prev => ({
      ...prev,
      [id]: { description: '', trigger_patterns: '', steps_natural: '' },
    }));
    setExpandedWorkflow(id);
  };

  const inputCls = 'w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary';

  return (
    <div className="p-4 bg-card-bg border border-border rounded-xl space-y-3">
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #60a5fa)' }}
        >
          <GitBranch size={12} className="text-white" />
        </div>
        <span className="text-sm font-medium text-foreground">Flow Manager</span>
        <span className="ml-auto text-xs text-text-muted">
          {config.activeWorkflows.length}/{allWorkflows.length} active
        </span>
      </div>

      <div className="space-y-1">
        {allWorkflows.map(workflow => {
          const name = workflow.name;
          const isActive = config.activeWorkflows.includes(name);
          const isExpanded = expandedWorkflow === name;
          const isBuiltin = registry.isBuiltin(name);
          const isCustomized = config.customWorkflows.some(w => w.name === name);
          const edit = editStates[name];
          const changed = edit ? hasChanges(workflow, edit) : false;

          return (
            <div key={name} className="rounded-lg overflow-hidden transition-all">
              {/* Row */}
              <div
                className="flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer transition-colors"
                style={{ background: isExpanded ? 'var(--secondary)' : 'transparent' }}
              >
                {/* Toggle */}
                <div
                  className="relative w-8 h-4 rounded-full flex-shrink-0 transition-colors cursor-pointer"
                  style={{ background: isActive ? 'var(--primary)' : 'var(--border)' }}
                  onClick={(e) => { e.stopPropagation(); toggleWorkflow(name); }}
                >
                  <div
                    className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform"
                    style={{ transform: isActive ? 'translateX(16px)' : 'translateX(2px)' }}
                  />
                </div>

                {/* Name */}
                <div
                  className="flex-1 flex items-center gap-2 min-w-0"
                  onClick={() => handleExpand(name)}
                >
                  <span className="text-sm text-foreground">{name}</span>
                  {isBuiltin && !isCustomized && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-500">Built-in</span>
                  )}
                  {isCustomized && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600">Custom</span>
                  )}
                  {changed && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">Modified</span>
                  )}
                  <ChevronDown
                    size={12}
                    className="text-text-muted transition-transform"
                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                </div>

                {/* Delete (non-builtin only) */}
                {!isBuiltin && (
                  <button
                    className="p-1 rounded hover:bg-red-50 text-red-400"
                    onClick={(e) => { e.stopPropagation(); handleDelete(name); }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              {/* Expanded detail */}
              {isExpanded && edit && (
                <div className="px-3 pb-3 pt-1 space-y-3 text-xs" style={{ animation: 'slideUp 0.2s ease-out' }}>
                  {/* Restore default */}
                  {isBuiltin && isCustomized && (
                    <button
                      onClick={() => handleRestoreDefault(name)}
                      className="flex items-center gap-1 text-[10px] text-text-muted hover:text-foreground transition-colors"
                    >
                      <RotateCcw size={10} />
                      Restore Defaults
                    </button>
                  )}

                  {/* Description */}
                  <div>
                    <label className="block text-[10px] font-medium text-text-muted mb-1">Description</label>
                    <input
                      className={inputCls}
                      value={edit.description}
                      onChange={(e) => updateField(name, 'description', e.target.value)}
                      placeholder="Describe what this flow does"
                    />
                  </div>

                  {/* Trigger patterns */}
                  <div>
                    <label className="block text-[10px] font-medium text-text-muted mb-1">Trigger Patterns (one per line)</label>
                    <textarea
                      className={`${inputCls} resize-y min-h-[60px]`}
                      value={edit.trigger_patterns}
                      onChange={(e) => updateField(name, 'trigger_patterns', e.target.value)}
                      placeholder={"review this code\ncheck my code\ncode review please"}
                    />
                  </div>

                  {/* Steps natural */}
                  <div>
                    <label className="block text-[10px] font-medium text-text-muted mb-1">Execution Flow (natural language)</label>
                    <textarea
                      className={`${inputCls} resize-y min-h-[120px]`}
                      value={edit.steps_natural}
                      onChange={(e) => updateField(name, 'steps_natural', e.target.value)}
                      placeholder={"e.g. Review code with code-review. If no issues, stop. If issues found, fix with code-fix."}
                    />
                  </div>

                  {/* Save / Revert */}
                  {changed && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSave(name)}
                        className="px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors"
                        style={{ background: 'var(--primary)' }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => handleRevert(name)}
                        className="px-3 py-1.5 text-xs font-medium text-text-muted rounded-lg transition-colors hover:bg-slate-100"
                      >
                        Revert
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add workflow */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 text-xs text-primary hover:opacity-80 transition-opacity"
        >
          <Plus size={14} />
          <span>Add Flow</span>
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            className={`${inputCls} flex-1 font-mono`}
            placeholder="Flow name (e.g. my-flow)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50"
            style={{ background: 'var(--primary)' }}
          >
            Add
          </button>
          <button
            onClick={() => { setShowAddForm(false); setNewName(''); }}
            className="p-1 rounded hover:bg-slate-100 text-text-muted"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
