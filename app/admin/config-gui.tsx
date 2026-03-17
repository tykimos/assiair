'use client';

import React, { useState } from 'react';
import { getDefaultConfig } from '@/storage/config-store';

type GuiTab = 'general' | 'skills' | 'workflows' | 'tools' | 'prompts' | 'triggers';

const ALL_TABS: { id: GuiTab; label: string }[] = [
  { id: 'general', label: '일반' },
  { id: 'skills', label: '스킬' },
  { id: 'workflows', label: '워크플로우' },
  { id: 'tools', label: '도구' },
  { id: 'prompts', label: '프롬프트' },
  { id: 'triggers', label: '트리거' },
];

const USER_TAB_IDS = new Set<GuiTab>(['general', 'skills', 'workflows', 'tools']);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyConfig = Record<string, any>;

interface ConfigGuiProps {
  /** The full merged config to display */
  config: AnyConfig;
  onChange: (config: AnyConfig) => void;
  mode: 'admin' | 'user';
  appConfig?: AnyConfig;
  /** Base app config — when provided, shows inheritance indicators & revert buttons */
  baseConfig?: AnyConfig;
}

const defaults = getDefaultConfig();
const BUILTIN_SKILLS = [...defaults.activeSkills];
const BUILTIN_WORKFLOWS = [...defaults.activeWorkflows];
const BUILTIN_TOOLS = [...defaults.activeTools];

/** Check if a specific config field differs from the base */
function isFieldOverridden(field: string, config: AnyConfig, baseConfig?: AnyConfig): boolean {
  if (!baseConfig) return false;
  return JSON.stringify(config[field]) !== JSON.stringify(baseConfig[field]);
}

/* ── inline styles ─────────────────────────────────────────────────── */

const gs = {
  tabBar: {
    display: 'flex',
    gap: '0.25rem',
    marginBottom: '0.7rem',
    flexWrap: 'wrap',
    borderBottom: '1px solid rgba(17,21,50,0.07)',
    paddingBottom: '0.4rem',
  } as React.CSSProperties,

  tab: (active: boolean): React.CSSProperties => ({
    border: 'none',
    borderRadius: 8,
    padding: '0.3rem 0.6rem',
    fontSize: '0.76rem',
    fontWeight: 600,
    cursor: 'pointer',
    background: active ? 'linear-gradient(90deg, #636bff, #404dff)' : 'transparent',
    color: active ? '#fff' : '#5d6698',
    transition: 'all 0.15s',
  }),

  section: {
    border: '1px solid rgba(17,21,50,0.06)',
    borderRadius: 10,
    padding: '0.6rem',
    marginBottom: '0.4rem',
  } as React.CSSProperties,

  sectionTitle: {
    margin: '0 0 0.4rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    color: '#202753',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties,

  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.3rem 0.3rem',
    borderBottom: '1px solid rgba(17,21,50,0.04)',
    fontSize: '0.82rem',
  } as React.CSSProperties,

  label: {
    flex: 1,
    color: '#23284f',
    fontSize: '0.82rem',
  } as React.CSSProperties,

  badge: (type: string): React.CSSProperties => ({
    fontSize: '0.6rem',
    padding: '0.08rem 0.3rem',
    borderRadius: 5,
    fontWeight: 600,
    background: type === 'custom' ? 'rgba(139,92,246,0.08)'
      : type === 'overridden' ? 'rgba(245,158,11,0.1)'
      : type === 'inherited' ? 'rgba(16,185,129,0.08)'
      : 'rgba(59,130,246,0.08)',
    color: type === 'custom' ? '#8b5cf6'
      : type === 'overridden' ? '#d97706'
      : type === 'inherited' ? '#059669'
      : '#3b82f6',
    whiteSpace: 'nowrap',
  }),

  count: {
    fontWeight: 400,
    fontSize: '0.75rem',
    color: '#8f97c2',
    marginLeft: 6,
  } as React.CSSProperties,

  addBtn: {
    border: '1px dashed rgba(99,107,255,0.35)',
    borderRadius: 7,
    padding: '0.25rem 0.55rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    background: 'rgba(99,107,255,0.03)',
    color: '#636bff',
    marginTop: '0.3rem',
  } as React.CSSProperties,

  miniInput: {
    borderRadius: 7,
    border: '1px solid rgba(72, 84, 172, 0.25)',
    background: '#fff',
    padding: '0.3rem 0.5rem',
    color: '#111532',
    fontSize: '0.78rem',
    fontFamily: 'monospace',
    outline: 'none',
    width: 180,
  } as React.CSSProperties,

  textarea: {
    width: '100%',
    borderRadius: 10,
    border: '1px solid rgba(72, 84, 172, 0.2)',
    background: '#fff',
    padding: '0.5rem 0.6rem',
    color: '#111532',
    fontSize: '0.78rem',
    fontFamily: 'monospace',
    outline: 'none',
    boxSizing: 'border-box' as const,
    resize: 'vertical' as const,
    minHeight: 100,
  } as React.CSSProperties,

  cancelBtn: {
    border: 'none',
    background: 'none',
    color: '#5d6698',
    cursor: 'pointer',
    fontSize: '0.7rem',
    padding: '0.15rem 0.3rem',
    borderRadius: 4,
  } as React.CSSProperties,

  deleteBtn: {
    border: 'none',
    background: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: '0.7rem',
    padding: '0.15rem 0.3rem',
    borderRadius: 4,
  } as React.CSSProperties,

  revertBtn: {
    border: 'none',
    background: 'rgba(245,158,11,0.08)',
    color: '#d97706',
    cursor: 'pointer',
    fontSize: '0.62rem',
    fontWeight: 600,
    padding: '0.12rem 0.35rem',
    borderRadius: 4,
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  inheritBadge: {
    fontSize: '0.58rem',
    fontWeight: 600,
    padding: '0.06rem 0.25rem',
    borderRadius: 4,
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
};

/* ── Toggle ─────────────────────────────────────────────────────────── */

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      style={{
        width: 30, height: 15, borderRadius: 999, flexShrink: 0,
        background: on ? '#636bff' : '#d1d5db', position: 'relative',
        cursor: 'pointer', transition: 'background 0.15s',
      }}
    >
      <div style={{
        position: 'absolute', top: 2, width: 11, height: 11, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
        left: on ? 16 : 2, transition: 'left 0.15s',
      }} />
    </div>
  );
}

/* ── Override indicator + revert button ────────────────────────────── */

function OverrideIndicator({ field, config, baseConfig, onRevert }: {
  field: string;
  config: AnyConfig;
  baseConfig?: AnyConfig;
  onRevert: (field: string) => void;
}) {
  if (!baseConfig) return null;
  const overridden = isFieldOverridden(field, config, baseConfig);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 6 }}>
      <span style={{
        ...gs.inheritBadge,
        background: overridden ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.08)',
        color: overridden ? '#d97706' : '#059669',
      }}>
        {overridden ? '변경됨' : '상속'}
      </span>
      {overridden && (
        <button onClick={() => onRevert(field)} style={gs.revertBtn}>되돌리기</button>
      )}
    </span>
  );
}

/* ── Expandable custom skill editor ────────────────────────────────── */

function CustomSkillDetail({ skill, onChange, onDelete }: {
  skill: AnyConfig;
  onChange: (updated: AnyConfig) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ marginTop: 2, marginBottom: 4 }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer', fontSize: '0.7rem', color: '#636bff', marginLeft: 34, userSelect: 'none' }}
      >
        {expanded ? '▾ 상세 닫기' : '▸ 상세 보기'}
      </div>
      {expanded && (
        <div style={{
          marginLeft: 34, marginTop: 4, padding: '0.5rem',
          background: 'rgba(99,107,255,0.02)', borderRadius: 8,
          border: '1px solid rgba(99,107,255,0.1)',
        }}>
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: '0.7rem', color: '#5d6698', display: 'block', marginBottom: 2 }}>설명</label>
            <input
              value={skill.description || ''}
              onChange={e => onChange({ ...skill, description: e.target.value })}
              style={{ ...gs.miniInput, width: '100%' }}
              placeholder="스킬 설명"
            />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: '0.7rem', color: '#5d6698', display: 'block', marginBottom: 2 }}>도구 (쉼표 구분)</label>
            <input
              value={(skill.tools || []).join(', ')}
              onChange={e => onChange({ ...skill, tools: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })}
              style={{ ...gs.miniInput, width: '100%' }}
              placeholder="tool1, tool2"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
            <div>
              <label style={{ fontSize: '0.7rem', color: '#5d6698', display: 'block', marginBottom: 2 }}>Context Tokens</label>
              <input
                type="number"
                value={skill.budget_context_tokens ?? 2000}
                onChange={e => onChange({ ...skill, budget_context_tokens: Number(e.target.value) })}
                style={{ ...gs.miniInput, width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: '#5d6698', display: 'block', marginBottom: 2 }}>History Turns</label>
              <input
                type="number"
                value={skill.budget_history_turns ?? 3}
                onChange={e => onChange({ ...skill, budget_history_turns: Number(e.target.value) })}
                style={{ ...gs.miniInput, width: '100%' }}
              />
            </div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: '0.7rem', color: '#5d6698', display: 'block', marginBottom: 2 }}>프롬프트</label>
            <textarea
              value={skill.prompt || ''}
              onChange={e => onChange({ ...skill, prompt: e.target.value })}
              style={{ ...gs.textarea, minHeight: 80 }}
              placeholder="스킬 프롬프트 내용"
            />
          </div>
          <button onClick={onDelete} style={{ ...gs.deleteBtn, fontSize: '0.72rem' }}>이 커스텀 스킬 삭제</button>
        </div>
      )}
    </div>
  );
}

/* ── Expandable custom workflow editor ────────────────────────────── */

function CustomWorkflowDetail({ workflow, onChange, onDelete }: {
  workflow: AnyConfig;
  onChange: (updated: AnyConfig) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ marginTop: 2, marginBottom: 4 }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer', fontSize: '0.7rem', color: '#636bff', marginLeft: 34, userSelect: 'none' }}
      >
        {expanded ? '▾ 상세 닫기' : '▸ 상세 보기'}
      </div>
      {expanded && (
        <div style={{
          marginLeft: 34, marginTop: 4, padding: '0.5rem',
          background: 'rgba(99,107,255,0.02)', borderRadius: 8,
          border: '1px solid rgba(99,107,255,0.1)',
        }}>
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: '0.7rem', color: '#5d6698', display: 'block', marginBottom: 2 }}>설명</label>
            <input
              value={workflow.description || ''}
              onChange={e => onChange({ ...workflow, description: e.target.value })}
              style={{ ...gs.miniInput, width: '100%' }}
              placeholder="워크플로우 설명"
            />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: '0.7rem', color: '#5d6698', display: 'block', marginBottom: 2 }}>트리거 패턴 (쉼표 구분)</label>
            <input
              value={(workflow.trigger_patterns || []).join(', ')}
              onChange={e => onChange({ ...workflow, trigger_patterns: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })}
              style={{ ...gs.miniInput, width: '100%' }}
              placeholder="패턴1, 패턴2"
            />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: '0.7rem', color: '#5d6698', display: 'block', marginBottom: 2 }}>흐름 (자연어)</label>
            <textarea
              value={workflow.steps_natural || ''}
              onChange={e => onChange({ ...workflow, steps_natural: e.target.value })}
              style={{ ...gs.textarea, minHeight: 60 }}
              placeholder="예: greeting 후 report-summary 실행"
            />
          </div>
          <button onClick={onDelete} style={{ ...gs.deleteBtn, fontSize: '0.72rem' }}>이 커스텀 워크플로우 삭제</button>
        </div>
      )}
    </div>
  );
}

/* ── Expandable custom tool editor ────────────────────────────────── */

function CustomToolDetail({ tool, onChange, onDelete }: {
  tool: AnyConfig;
  onChange: (updated: AnyConfig) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ marginTop: 2, marginBottom: 4 }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer', fontSize: '0.7rem', color: '#636bff', marginLeft: 34, userSelect: 'none' }}
      >
        {expanded ? '▾ 상세 닫기' : '▸ 상세 보기'}
      </div>
      {expanded && (
        <div style={{
          marginLeft: 34, marginTop: 4, padding: '0.5rem',
          background: 'rgba(99,107,255,0.02)', borderRadius: 8,
          border: '1px solid rgba(99,107,255,0.1)',
        }}>
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: '0.7rem', color: '#5d6698', display: 'block', marginBottom: 2 }}>설명</label>
            <input
              value={tool.description || ''}
              onChange={e => onChange({ ...tool, description: e.target.value })}
              style={{ ...gs.miniInput, width: '100%' }}
              placeholder="도구 설명"
            />
          </div>
          <button onClick={onDelete} style={{ ...gs.deleteBtn, fontSize: '0.72rem' }}>이 커스텀 도구 삭제</button>
        </div>
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────── */

export function ConfigGui({ config, onChange, mode, appConfig, baseConfig }: ConfigGuiProps) {
  const [tab, setTab] = useState<GuiTab>('general');
  const [addingType, setAddingType] = useState<string | null>(null);
  const [newItemId, setNewItemId] = useState('');

  const hasBase = !!baseConfig;

  const visibleTabs = mode === 'user'
    ? ALL_TABS.filter(t => USER_TAB_IDS.has(t.id))
    : ALL_TABS;

  // Safe accessors with fallback to defaults
  const activeSkills: string[] = config.activeSkills ?? defaults.activeSkills;
  const activeWorkflows: string[] = config.activeWorkflows ?? defaults.activeWorkflows;
  const activeTools: string[] = config.activeTools ?? defaults.activeTools;
  const customSkills: AnyConfig[] = config.customSkills ?? [];
  const customWorkflows: AnyConfig[] = config.customWorkflows ?? [];
  const customTools: AnyConfig[] = config.customTools ?? [];
  const triggers: AnyConfig[] = config.triggers ?? defaults.triggers;

  // Revert a field back to base value
  const revertField = (field: string) => {
    if (!baseConfig) return;
    onChange({ ...config, [field]: baseConfig[field] });
  };

  // Derive all available items to display
  function deriveAvailable(
    builtins: string[],
    customList: AnyConfig[],
    idField: string,
    activeList: string[],
    srcConfig?: AnyConfig,
  ): string[] {
    if (mode === 'user' && srcConfig) {
      const activeField = idField === 'skill_id' ? 'activeSkills' : idField === 'name' ? 'activeWorkflows' : 'activeTools';
      const appActive = (srcConfig[activeField] || builtins) as string[];
      return [...appActive];
    }
    const customIds = customList.map((c: AnyConfig) => c[idField] as string);
    return [...new Set([...builtins, ...activeList, ...customIds])];
  }

  const availableSkills = deriveAvailable(BUILTIN_SKILLS, customSkills, 'skill_id', activeSkills, appConfig);
  const availableWorkflows = deriveAvailable(BUILTIN_WORKFLOWS, customWorkflows, 'name', activeWorkflows, appConfig);
  const availableTools = deriveAvailable(BUILTIN_TOOLS, customTools, 'id', activeTools, appConfig);

  // Toggle an item in a string array field
  const toggleItem = (field: string, currentList: string[], item: string) => {
    const next = currentList.includes(item)
      ? currentList.filter(i => i !== item)
      : [...currentList, item];
    onChange({ ...config, [field]: next });
  };

  // Add custom item (admin only)
  const addItem = (type: 'skill' | 'workflow' | 'tool') => {
    const id = newItemId.trim();
    if (!id) return;
    const cfg = { ...config };
    if (type === 'skill') {
      if (availableSkills.includes(id)) return;
      cfg.customSkills = [...customSkills, {
        skill_id: id, description: '', tools: [], requires: [],
        prompt: '', budget_context_tokens: 2000, budget_history_turns: 3,
      }];
      cfg.activeSkills = [...activeSkills, id];
    } else if (type === 'workflow') {
      if (availableWorkflows.includes(id)) return;
      cfg.customWorkflows = [...customWorkflows, {
        name: id, description: '', trigger_patterns: [], steps_natural: '',
      }];
      cfg.activeWorkflows = [...activeWorkflows, id];
    } else {
      if (availableTools.includes(id)) return;
      cfg.customTools = [...customTools, { id, description: '', parameters: [] }];
      cfg.activeTools = [...activeTools, id];
    }
    onChange(cfg);
    setNewItemId('');
    setAddingType(null);
  };

  // Delete custom item (admin only)
  const deleteItem = (type: 'skill' | 'workflow' | 'tool', id: string) => {
    const cfg = { ...config };
    if (type === 'skill') {
      cfg.customSkills = customSkills.filter((s: AnyConfig) => s.skill_id !== id);
      cfg.activeSkills = activeSkills.filter(s => s !== id);
    } else if (type === 'workflow') {
      cfg.customWorkflows = customWorkflows.filter((w: AnyConfig) => w.name !== id);
      cfg.activeWorkflows = activeWorkflows.filter(w => w !== id);
    } else {
      cfg.customTools = customTools.filter((t: AnyConfig) => t.id !== id);
      cfg.activeTools = activeTools.filter(t => t !== id);
    }
    onChange(cfg);
  };

  // Update a custom skill
  const updateCustomSkill = (skillId: string, updated: AnyConfig) => {
    const cfg = { ...config };
    cfg.customSkills = customSkills.map((s: AnyConfig) =>
      s.skill_id === skillId ? updated : s
    );
    onChange(cfg);
  };

  // Update a custom workflow
  const updateCustomWorkflow = (name: string, updated: AnyConfig) => {
    const cfg = { ...config };
    cfg.customWorkflows = customWorkflows.map((w: AnyConfig) =>
      w.name === name ? updated : w
    );
    onChange(cfg);
  };

  // Update a custom tool
  const updateCustomTool = (toolId: string, updated: AnyConfig) => {
    const cfg = { ...config };
    cfg.customTools = customTools.map((t: AnyConfig) =>
      t.id === toolId ? updated : t
    );
    onChange(cfg);
  };

  // Check if a list field (activeSkills, etc.) has item-level differences from base
  const isItemDiffFromBase = (field: string, item: string): 'same' | 'added' | 'removed' => {
    if (!baseConfig) return 'same';
    const baseList: string[] = baseConfig[field] ?? [];
    const curList: string[] = config[field] ?? [];
    const inBase = baseList.includes(item);
    const inCur = curList.includes(item);
    if (inBase && inCur) return 'same';
    if (!inBase && inCur) return 'added';
    if (inBase && !inCur) return 'removed';
    return 'same';
  };

  // Render a toggle list for skills/workflows/tools with inheritance info
  const renderList = (
    items: string[],
    activeList: string[],
    field: string,
    type: 'skill' | 'workflow' | 'tool',
    customIdField: string,
    customList: AnyConfig[],
  ) => {
    const customIds = new Set(customList.map((c: AnyConfig) => c[customIdField] as string));
    const fieldOverridden = hasBase && isFieldOverridden(field, config, baseConfig);

    return (
      <>
        {/* Field-level override indicator */}
        {hasBase && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, fontSize: '0.7rem' }}>
            <span style={{
              ...gs.inheritBadge,
              background: fieldOverridden ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.08)',
              color: fieldOverridden ? '#d97706' : '#059669',
            }}>
              {fieldOverridden ? '변경됨 (base와 다름)' : '상속 (base와 동일)'}
            </span>
            {fieldOverridden && (
              <button onClick={() => revertField(field)} style={gs.revertBtn}>base로 되돌리기</button>
            )}
          </div>
        )}

        {items.map(item => {
          const diff = isItemDiffFromBase(field, item);
          return (
            <React.Fragment key={item}>
              <div style={{
                ...gs.toggleRow,
                background: diff === 'added' ? 'rgba(245,158,11,0.04)' : diff === 'removed' ? 'rgba(239,68,68,0.04)' : undefined,
              }}>
                <Toggle on={activeList.includes(item)} onToggle={() => toggleItem(field, activeList, item)} />
                <span style={gs.label}>{item}</span>
                {hasBase && diff !== 'same' && (
                  <span style={gs.badge(diff === 'added' ? 'overridden' : 'custom')}>
                    {diff === 'added' ? '추가됨' : '제거됨'}
                  </span>
                )}
                <span style={gs.badge(customIds.has(item) ? 'custom' : 'builtin')}>
                  {customIds.has(item) ? 'Custom' : 'Built-in'}
                </span>
                {mode === 'admin' && customIds.has(item) && (
                  <button onClick={() => deleteItem(type, item)} style={gs.deleteBtn}>삭제</button>
                )}
              </div>
              {/* Show expandable detail for custom items */}
              {mode === 'admin' && customIds.has(item) && type === 'skill' && (
                <CustomSkillDetail
                  skill={customList.find((s: AnyConfig) => s[customIdField] === item)!}
                  onChange={(updated) => updateCustomSkill(item, updated)}
                  onDelete={() => deleteItem(type, item)}
                />
              )}
              {mode === 'admin' && customIds.has(item) && type === 'workflow' && (
                <CustomWorkflowDetail
                  workflow={customList.find((w: AnyConfig) => w[customIdField] === item)!}
                  onChange={(updated) => updateCustomWorkflow(item, updated)}
                  onDelete={() => deleteItem(type, item)}
                />
              )}
              {mode === 'admin' && customIds.has(item) && type === 'tool' && (
                <CustomToolDetail
                  tool={customList.find((t: AnyConfig) => t[customIdField] === item)!}
                  onChange={(updated) => updateCustomTool(item, updated)}
                  onDelete={() => deleteItem(type, item)}
                />
              )}
            </React.Fragment>
          );
        })}
        {mode === 'admin' && (
          addingType === type ? (
            <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem', alignItems: 'center' }}>
              <input
                value={newItemId}
                onChange={e => setNewItemId(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addItem(type);
                  if (e.key === 'Escape') { setAddingType(null); setNewItemId(''); }
                }}
                placeholder={`새 ${type === 'skill' ? '스킬' : type === 'workflow' ? '워크플로우' : '도구'} ID`}
                style={gs.miniInput}
                autoFocus
              />
              <button onClick={() => addItem(type)} style={gs.addBtn}>추가</button>
              <button onClick={() => { setAddingType(null); setNewItemId(''); }} style={gs.cancelBtn}>취소</button>
            </div>
          ) : (
            <button onClick={() => { setAddingType(type); setNewItemId(''); }} style={gs.addBtn}>+ 추가</button>
          )
        )}
      </>
    );
  };

  return (
    <div>
      {/* Tab bar */}
      <div style={gs.tabBar}>
        {visibleTabs.map(t => {
          // Show dot indicator if tab has overrides
          const tabOverrideFields: Record<GuiTab, string[]> = {
            general: ['maxPlanSteps', 'maxChainDepth', 'theme'],
            skills: ['activeSkills', 'customSkills'],
            workflows: ['activeWorkflows', 'customWorkflows'],
            tools: ['activeTools', 'customTools'],
            prompts: ['systemPrompt', 'executorPrompt'],
            triggers: ['triggers'],
          };
          const hasOverride = hasBase && tabOverrideFields[t.id]?.some(f => isFieldOverridden(f, config, baseConfig));
          return (
            <button key={t.id} onClick={() => { setTab(t.id); setAddingType(null); }} style={{
              ...gs.tab(tab === t.id),
              position: 'relative',
            }}>
              {t.label}
              {hasOverride && (
                <span style={{
                  position: 'absolute', top: 2, right: 2,
                  width: 5, height: 5, borderRadius: '50%',
                  background: '#f59e0b',
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* General */}
      {tab === 'general' && (
        <>
          <div style={gs.section}>
            <div style={gs.sectionTitle}>
              <span>오케스트레이터</span>
              {hasBase && (isFieldOverridden('maxPlanSteps', config, baseConfig) || isFieldOverridden('maxChainDepth', config, baseConfig)) && (
                <span style={{ display: 'flex', gap: 4 }}>
                  <span style={{ ...gs.inheritBadge, background: 'rgba(245,158,11,0.1)', color: '#d97706' }}>변경됨</span>
                </span>
              )}
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: '0.76rem', color: '#5d6698' }}>
                  Max Plan Steps
                  {hasBase && isFieldOverridden('maxPlanSteps', config, baseConfig) && (
                    <span style={{ fontSize: '0.65rem', color: '#8f97c2', marginLeft: 6 }}>
                      (base: {baseConfig!.maxPlanSteps ?? defaults.maxPlanSteps})
                    </span>
                  )}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <strong style={{ fontSize: '0.76rem', color: '#636bff' }}>{config.maxPlanSteps ?? defaults.maxPlanSteps}</strong>
                  {hasBase && isFieldOverridden('maxPlanSteps', config, baseConfig) && (
                    <button onClick={() => revertField('maxPlanSteps')} style={gs.revertBtn}>되돌리기</button>
                  )}
                </span>
              </div>
              <input
                type="range" min={1} max={10}
                value={config.maxPlanSteps ?? defaults.maxPlanSteps}
                onChange={e => onChange({ ...config, maxPlanSteps: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#636bff' }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: '0.76rem', color: '#5d6698' }}>
                  Max Chain Depth
                  {hasBase && isFieldOverridden('maxChainDepth', config, baseConfig) && (
                    <span style={{ fontSize: '0.65rem', color: '#8f97c2', marginLeft: 6 }}>
                      (base: {baseConfig!.maxChainDepth ?? defaults.maxChainDepth})
                    </span>
                  )}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <strong style={{ fontSize: '0.76rem', color: '#8b5cf6' }}>{config.maxChainDepth ?? defaults.maxChainDepth}</strong>
                  {hasBase && isFieldOverridden('maxChainDepth', config, baseConfig) && (
                    <button onClick={() => revertField('maxChainDepth')} style={gs.revertBtn}>되돌리기</button>
                  )}
                </span>
              </div>
              <input
                type="range" min={1} max={10}
                value={config.maxChainDepth ?? defaults.maxChainDepth}
                onChange={e => onChange({ ...config, maxChainDepth: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#8b5cf6' }}
              />
            </div>
          </div>

          <div style={gs.section}>
            <div style={gs.sectionTitle}>
              <span>테마</span>
              <OverrideIndicator field="theme" config={config} baseConfig={baseConfig} onRevert={revertField} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem' }}>
              {[
                { id: 'light', label: 'Light', c: ['#fafafa', '#6366f1', '#8b5cf6'] },
                { id: 'assiworks', label: 'AssiWorks', c: ['#f5f3ff', '#4f46e5', '#7c3aed'] },
                { id: 'aifactory', label: 'AIFactory', c: ['#fffbf0', '#f59e0b', '#f97316'] },
                { id: 'dark', label: 'Dark', c: ['#0f172a', '#818cf8', '#a78bfa'] },
              ].map(t => {
                const active = (config.theme || 'light') === t.id;
                const isBaseTheme = hasBase && (baseConfig!.theme || 'light') === t.id && !active;
                return (
                  <button
                    key={t.id}
                    onClick={() => onChange({ ...config, theme: t.id })}
                    style={{
                      border: active ? `2px solid ${t.c[1]}` : isBaseTheme ? '2px dashed rgba(16,185,129,0.4)' : '2px solid rgba(17,21,50,0.08)',
                      borderRadius: 8, padding: '0.35rem', cursor: 'pointer',
                      background: active ? 'rgba(99,107,255,0.05)' : '#fff', textAlign: 'center',
                      position: 'relative',
                    }}
                  >
                    <div style={{
                      height: 18, borderRadius: 5, marginBottom: 3,
                      background: t.c[0], border: '1px solid rgba(17,21,50,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2,
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.c[1] }} />
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.c[2] }} />
                    </div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: active ? t.c[1] : '#5d6698' }}>{t.label}</span>
                    {isBaseTheme && (
                      <span style={{ display: 'block', fontSize: '0.5rem', color: '#059669' }}>base</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Skills */}
      {tab === 'skills' && (
        <div style={gs.section}>
          <div style={gs.sectionTitle}>
            <span>스킬 관리</span>
            <span style={gs.count}>{activeSkills.length}/{availableSkills.length} 활성</span>
          </div>
          {renderList(availableSkills, activeSkills, 'activeSkills', 'skill', 'skill_id', customSkills)}
        </div>
      )}

      {/* Workflows */}
      {tab === 'workflows' && (
        <div style={gs.section}>
          <div style={gs.sectionTitle}>
            <span>워크플로우 관리</span>
            <span style={gs.count}>{activeWorkflows.length}/{availableWorkflows.length} 활성</span>
          </div>
          {renderList(availableWorkflows, activeWorkflows, 'activeWorkflows', 'workflow', 'name', customWorkflows)}
        </div>
      )}

      {/* Tools */}
      {tab === 'tools' && (
        <div style={gs.section}>
          <div style={gs.sectionTitle}>
            <span>도구 관리</span>
            <span style={gs.count}>{activeTools.length}/{availableTools.length} 활성</span>
          </div>
          {renderList(availableTools, activeTools, 'activeTools', 'tool', 'id', customTools)}
        </div>
      )}

      {/* Prompts (admin only) */}
      {tab === 'prompts' && mode === 'admin' && (
        <>
          <div style={gs.section}>
            <div style={gs.sectionTitle}>
              <span>시스템 프롬프트 (Orchestrator)</span>
              <OverrideIndicator field="systemPrompt" config={config} baseConfig={baseConfig} onRevert={revertField} />
            </div>
            {hasBase && isFieldOverridden('systemPrompt', config, baseConfig) && baseConfig!.systemPrompt && (
              <div style={{
                fontSize: '0.7rem', color: '#8f97c2', marginBottom: 4,
                padding: '0.3rem 0.5rem', background: 'rgba(16,185,129,0.04)',
                borderRadius: 6, border: '1px dashed rgba(16,185,129,0.2)',
              }}>
                base: {(baseConfig!.systemPrompt as string).slice(0, 100)}{(baseConfig!.systemPrompt as string).length > 100 ? '...' : ''}
              </div>
            )}
            <textarea
              value={config.systemPrompt ?? ''}
              onChange={e => onChange({ ...config, systemPrompt: e.target.value })}
              placeholder="커스텀 오케스트레이터 프롬프트 (비어있으면 기본값 사용)"
              style={gs.textarea}
            />
          </div>
          <div style={gs.section}>
            <div style={gs.sectionTitle}>
              <span>실행기 프롬프트 (Executor)</span>
              <OverrideIndicator field="executorPrompt" config={config} baseConfig={baseConfig} onRevert={revertField} />
            </div>
            {hasBase && isFieldOverridden('executorPrompt', config, baseConfig) && baseConfig!.executorPrompt && (
              <div style={{
                fontSize: '0.7rem', color: '#8f97c2', marginBottom: 4,
                padding: '0.3rem 0.5rem', background: 'rgba(16,185,129,0.04)',
                borderRadius: 6, border: '1px dashed rgba(16,185,129,0.2)',
              }}>
                base: {(baseConfig!.executorPrompt as string).slice(0, 100)}{(baseConfig!.executorPrompt as string).length > 100 ? '...' : ''}
              </div>
            )}
            <textarea
              value={config.executorPrompt ?? ''}
              onChange={e => onChange({ ...config, executorPrompt: e.target.value })}
              placeholder="커스텀 실행기 프롬프트 (비어있으면 기본값 사용)"
              style={gs.textarea}
            />
          </div>
        </>
      )}

      {/* Triggers (admin only) */}
      {tab === 'triggers' && mode === 'admin' && (
        <div style={gs.section}>
          <div style={gs.sectionTitle}>
            <span>트리거 설정</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={gs.count}>{triggers.filter((t: AnyConfig) => t.enabled).length}/{triggers.length} 활성</span>
              <OverrideIndicator field="triggers" config={config} baseConfig={baseConfig} onRevert={revertField} />
            </span>
          </div>
          {triggers.map((trigger: AnyConfig, idx: number) => {
            // Check if this trigger differs from base
            const baseTrigger = hasBase ? (baseConfig!.triggers as AnyConfig[] ?? []).find((bt: AnyConfig) => bt.id === trigger.id) : null;
            const triggerDiff = baseTrigger ? trigger.enabled !== baseTrigger.enabled : false;
            return (
              <div key={trigger.id || idx} style={{
                ...gs.toggleRow,
                background: triggerDiff ? 'rgba(245,158,11,0.04)' : undefined,
              }}>
                <Toggle
                  on={!!trigger.enabled}
                  onToggle={() => {
                    const updated = triggers.map((t: AnyConfig, i: number) =>
                      i === idx ? { ...t, enabled: !t.enabled } : t
                    );
                    onChange({ ...config, triggers: updated });
                  }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '0.82rem', color: '#23284f', display: 'block' }}>
                    {trigger.label || trigger.id}
                    {triggerDiff && (
                      <span style={{ ...gs.inheritBadge, marginLeft: 6, background: 'rgba(245,158,11,0.1)', color: '#d97706' }}>
                        변경됨 (base: {baseTrigger!.enabled ? 'ON' : 'OFF'})
                      </span>
                    )}
                  </span>
                  {trigger.description && (
                    <span style={{ fontSize: '0.7rem', color: '#8f97c2' }}>{trigger.description}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
