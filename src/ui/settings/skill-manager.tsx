'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useWidget } from '@/widget/widget-provider';
import { getSkillRegistry } from '@/skills/registry';
import { Puzzle, ChevronDown, Plus, Trash2, X, RotateCcw } from 'lucide-react';
import type { CustomSkillRecord } from '@/types/widget';
import type { SkillDefinition } from '@/types';

interface SkillEditState {
  description: string;
  prompt: string;
}

function skillToEditState(skill: SkillDefinition): SkillEditState {
  return {
    description: skill.meta.description,
    prompt: skill.prompt,
  };
}

function hasChanges(original: SkillDefinition, edit: SkillEditState): boolean {
  return (
    edit.description !== original.meta.description ||
    edit.prompt !== original.prompt
  );
}

export function SkillManager() {
  const { config, updateConfig, appDefaultConfig, appDefaultConfigLoaded } = useWidget();
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [editStates, setEditStates] = useState<Record<string, SkillEditState>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSkillId, setNewSkillId] = useState('');

  const registry = useMemo(() => getSkillRegistry(), []);
  // Only show skills that are active in the app default config
  const allowedSkillIds = useMemo(() => new Set(appDefaultConfig.activeSkills), [appDefaultConfig.activeSkills]);
  const allSkills = useMemo(
    () => registry.getAllSkillDefinitions().filter(s => allowedSkillIds.has(s.meta.skill_id)),
    [registry, config.customSkills, allowedSkillIds],
  );

  const handleExpand = useCallback((skillId: string) => {
    if (expandedSkill === skillId) {
      setExpandedSkill(null);
      return;
    }
    setExpandedSkill(skillId);
    const skill = allSkills.find(s => s.meta.skill_id === skillId);
    if (skill && !editStates[skillId]) {
      setEditStates(prev => ({ ...prev, [skillId]: skillToEditState(skill) }));
    }
  }, [expandedSkill, allSkills, editStates]);

  useEffect(() => {
    setEditStates(prev => {
      const next = { ...prev };
      for (const skill of allSkills) {
        if (!next[skill.meta.skill_id]) {
          next[skill.meta.skill_id] = skillToEditState(skill);
        }
      }
      return next;
    });
  }, [allSkills]);

  const updateField = (skillId: string, field: keyof SkillEditState, value: string) => {
    setEditStates(prev => ({
      ...prev,
      [skillId]: { ...prev[skillId], [field]: value },
    }));
  };

  const toggleSkill = (skillId: string) => {
    const activeSkills = config.activeSkills.includes(skillId)
      ? config.activeSkills.filter(s => s !== skillId)
      : [...config.activeSkills, skillId];
    updateConfig({ activeSkills });
  };

  const handleSave = (skillId: string) => {
    const edit = editStates[skillId];
    if (!edit) return;

    const skill = allSkills.find(s => s.meta.skill_id === skillId);
    const record: CustomSkillRecord = {
      skill_id: skillId,
      description: edit.description.trim(),
      tools: skill?.meta.tools || [],
      requires: skill?.meta.requires || [],
      prompt: edit.prompt,
      budget_context_tokens: skill?.meta.budget.context_tokens || 2000,
      budget_history_turns: skill?.meta.budget.history_turns || 3,
    };

    registry.registerSkill(skillId, {
      meta: {
        skill_id: skillId,
        description: record.description,
        tools: record.tools,
        requires: record.requires,
        budget: {
          context_tokens: record.budget_context_tokens,
          history_turns: record.budget_history_turns,
        },
        signals_schema: skill?.meta.signals_schema || {},
      },
      prompt: record.prompt,
    });

    const existing = config.customSkills.find(s => s.skill_id === skillId);
    const customSkills = existing
      ? config.customSkills.map(s => s.skill_id === skillId ? record : s)
      : [...config.customSkills, record];
    updateConfig({ customSkills });
  };

  const handleRevert = (skillId: string) => {
    const skill = allSkills.find(s => s.meta.skill_id === skillId);
    if (skill) {
      setEditStates(prev => ({ ...prev, [skillId]: skillToEditState(skill) }));
    }
  };

  /** Restore builtin skill to its original definition and remove from customSkills */
  const handleRestoreDefault = (skillId: string) => {
    const original = registry.getBuiltinOriginal(skillId);
    if (!original) return;

    // Restore in runtime registry
    registry.registerSkill(skillId, original);

    // Remove from customSkills
    updateConfig({
      customSkills: config.customSkills.filter(s => s.skill_id !== skillId),
    });

    // Update edit state to original
    setEditStates(prev => ({ ...prev, [skillId]: skillToEditState(original) }));
  };

  const handleDelete = (skillId: string) => {
    registry.removeSkill(skillId);
    updateConfig({
      customSkills: config.customSkills.filter(s => s.skill_id !== skillId),
      activeSkills: config.activeSkills.filter(s => s !== skillId),
    });
    if (expandedSkill === skillId) setExpandedSkill(null);
    setEditStates(prev => {
      const next = { ...prev };
      delete next[skillId];
      return next;
    });
  };

  const handleAdd = () => {
    const id = newSkillId.trim();
    if (!id || allSkills.some(s => s.meta.skill_id === id)) return;

    const record: CustomSkillRecord = {
      skill_id: id,
      description: '',
      tools: [],
      requires: [],
      prompt: '',
      budget_context_tokens: 2000,
      budget_history_turns: 3,
    };

    registry.registerSkill(id, {
      meta: {
        skill_id: id,
        description: '',
        tools: [],
        requires: [],
        budget: { context_tokens: 2000, history_turns: 3 },
        signals_schema: {},
      },
      prompt: '',
    });

    updateConfig({
      customSkills: [...config.customSkills, record],
      activeSkills: [...config.activeSkills, id],
    });

    setNewSkillId('');
    setShowAddForm(false);
    setEditStates(prev => ({
      ...prev,
      [id]: { description: '', prompt: '' },
    }));
    setExpandedSkill(id);
  };

  const inputCls = 'w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary';

  return (
    <div className="p-4 bg-card-bg border border-border rounded-xl space-y-3">
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, var(--success), #34d399)' }}
        >
          <Puzzle size={12} className="text-white" />
        </div>
        <span className="text-sm font-medium text-foreground">Skill Manager</span>
        <span className="ml-auto text-xs text-text-muted">
          {appDefaultConfigLoaded ? `${config.activeSkills.length}/${allSkills.length} active` : 'Loading...'}
        </span>
      </div>

      {!appDefaultConfigLoaded ? (
        <div className="text-xs text-text-muted py-4 text-center">Loading skills...</div>
      ) : (<>
      <div className="space-y-1">
        {allSkills.map(skill => {
          const skillId = skill.meta.skill_id;
          const isActive = config.activeSkills.includes(skillId);
          const isExpanded = expandedSkill === skillId;
          const isBuiltin = registry.isBuiltin(skillId);
          const isCustomized = config.customSkills.some(s => s.skill_id === skillId);
          const edit = editStates[skillId];
          const changed = edit ? hasChanges(skill, edit) : false;

          return (
            <div key={skillId} className="rounded-lg overflow-hidden transition-all">
              {/* Skill row */}
              <div
                className="flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer transition-colors"
                style={{ background: isExpanded ? 'var(--secondary)' : 'transparent' }}
              >
                {/* Toggle */}
                <div
                  className="relative w-8 h-4 rounded-full flex-shrink-0 transition-colors cursor-pointer"
                  style={{ background: isActive ? 'var(--primary)' : 'var(--border)' }}
                  onClick={(e) => { e.stopPropagation(); toggleSkill(skillId); }}
                >
                  <div
                    className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform"
                    style={{ transform: isActive ? 'translateX(16px)' : 'translateX(2px)' }}
                  />
                </div>

                {/* Name */}
                <div
                  className="flex-1 flex items-center gap-2 min-w-0"
                  onClick={() => handleExpand(skillId)}
                >
                  <span className="text-sm text-foreground">{skillId}</span>
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
                    onClick={(e) => { e.stopPropagation(); handleDelete(skillId); }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              {/* Expanded detail */}
              {isExpanded && edit && (
                <div className="px-3 pb-3 pt-1 space-y-3 text-xs" style={{ animation: 'slideUp 0.2s ease-out' }}>
                  {/* Restore default (customized builtin only) */}
                  {isBuiltin && isCustomized && (
                    <button
                      onClick={() => handleRestoreDefault(skillId)}
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
                      onChange={(e) => updateField(skillId, 'description', e.target.value)}
                      placeholder="Describe what this skill does"
                    />
                  </div>

                  {/* Prompt */}
                  <div>
                    <label className="block text-[10px] font-medium text-text-muted mb-1">Prompt</label>
                    <textarea
                      className={`${inputCls} resize-y min-h-[200px] font-mono`}
                      value={edit.prompt}
                      onChange={(e) => updateField(skillId, 'prompt', e.target.value)}
                      placeholder="Write skill execution instructions"
                    />
                  </div>

                  {/* Save / Revert */}
                  {changed && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSave(skillId)}
                        className="px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors"
                        style={{ background: 'var(--primary)' }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => handleRevert(skillId)}
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

      {/* Add skill */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 text-xs text-primary hover:opacity-80 transition-opacity"
        >
          <Plus size={14} />
          <span>Add Skill</span>
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            className={`${inputCls} flex-1 font-mono`}
            placeholder="Skill ID (e.g. my-skill)"
            value={newSkillId}
            onChange={(e) => setNewSkillId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <button
            onClick={handleAdd}
            disabled={!newSkillId.trim()}
            className="px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50"
            style={{ background: 'var(--primary)' }}
          >
            Add
          </button>
          <button
            onClick={() => { setShowAddForm(false); setNewSkillId(''); }}
            className="p-1 rounded hover:bg-slate-100 text-text-muted"
          >
            <X size={14} />
          </button>
        </div>
      )}
      </>
      )}
    </div>
  );
}
