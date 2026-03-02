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
  config: AnyConfig;
  onChange: (config: AnyConfig) => void;
  mode: 'admin' | 'user';
  appConfig?: AnyConfig;
}

const defaults = getDefaultConfig();
const BUILTIN_SKILLS = [...defaults.activeSkills];
const BUILTIN_WORKFLOWS = [...defaults.activeWorkflows];
const BUILTIN_TOOLS = [...defaults.activeTools];

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
    background: type === 'custom' ? 'rgba(139,92,246,0.08)' : 'rgba(59,130,246,0.08)',
    color: type === 'custom' ? '#8b5cf6' : '#3b82f6',
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

/* ── Main component ─────────────────────────────────────────────────── */

export function ConfigGui({ config, onChange, mode, appConfig }: ConfigGuiProps) {
  const [tab, setTab] = useState<GuiTab>('general');
  const [addingType, setAddingType] = useState<string | null>(null);
  const [newItemId, setNewItemId] = useState('');

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

  // Derive all available items to display
  function deriveAvailable(
    builtins: string[],
    customList: AnyConfig[],
    idField: string,
    activeList: string[],
    srcConfig?: AnyConfig,
  ): string[] {
    if (mode === 'user' && srcConfig) {
      // User sees ONLY items that are active in the app default config
      const activeField = idField === 'skill_id' ? 'activeSkills' : idField === 'name' ? 'activeWorkflows' : 'activeTools';
      const appActive = (srcConfig[activeField] || builtins) as string[];
      return [...appActive];
    }
    // Admin sees builtins + current custom
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

  // Render a toggle list for skills/workflows/tools
  const renderList = (
    items: string[],
    activeList: string[],
    field: string,
    type: 'skill' | 'workflow' | 'tool',
    customIdField: string,
    customList: AnyConfig[],
  ) => {
    const customIds = new Set(customList.map((c: AnyConfig) => c[customIdField] as string));
    return (
      <>
        {items.map(item => (
          <div key={item} style={gs.toggleRow}>
            <Toggle on={activeList.includes(item)} onToggle={() => toggleItem(field, activeList, item)} />
            <span style={gs.label}>{item}</span>
            <span style={gs.badge(customIds.has(item) ? 'custom' : 'builtin')}>
              {customIds.has(item) ? 'Custom' : 'Built-in'}
            </span>
            {mode === 'admin' && customIds.has(item) && (
              <button onClick={() => deleteItem(type, item)} style={gs.deleteBtn}>삭제</button>
            )}
          </div>
        ))}
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
        {visibleTabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setAddingType(null); }} style={gs.tab(tab === t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* General */}
      {tab === 'general' && (
        <>
          <div style={gs.section}>
            <div style={gs.sectionTitle}>오케스트레이터</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: '0.76rem', color: '#5d6698' }}>Max Plan Steps</span>
                <strong style={{ fontSize: '0.76rem', color: '#636bff' }}>{config.maxPlanSteps ?? defaults.maxPlanSteps}</strong>
              </div>
              <input
                type="range" min={1} max={10}
                value={config.maxPlanSteps ?? defaults.maxPlanSteps}
                onChange={e => onChange({ ...config, maxPlanSteps: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#636bff' }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: '0.76rem', color: '#5d6698' }}>Max Chain Depth</span>
                <strong style={{ fontSize: '0.76rem', color: '#8b5cf6' }}>{config.maxChainDepth ?? defaults.maxChainDepth}</strong>
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
            <div style={gs.sectionTitle}>테마</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem' }}>
              {[
                { id: 'light', label: 'Light', c: ['#fafafa', '#6366f1', '#8b5cf6'] },
                { id: 'assiworks', label: 'AssiWorks', c: ['#f5f3ff', '#4f46e5', '#7c3aed'] },
                { id: 'aifactory', label: 'AIFactory', c: ['#fffbf0', '#f59e0b', '#f97316'] },
                { id: 'dark', label: 'Dark', c: ['#0f172a', '#818cf8', '#a78bfa'] },
              ].map(t => {
                const active = (config.theme || 'light') === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => onChange({ ...config, theme: t.id })}
                    style={{
                      border: active ? `2px solid ${t.c[1]}` : '2px solid rgba(17,21,50,0.08)',
                      borderRadius: 8, padding: '0.35rem', cursor: 'pointer',
                      background: active ? 'rgba(99,107,255,0.05)' : '#fff', textAlign: 'center',
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
            <div style={gs.sectionTitle}>시스템 프롬프트 (Orchestrator)</div>
            <textarea
              value={config.systemPrompt ?? ''}
              onChange={e => onChange({ ...config, systemPrompt: e.target.value })}
              placeholder="커스텀 오케스트레이터 프롬프트 (비어있으면 기본값 사용)"
              style={gs.textarea}
            />
          </div>
          <div style={gs.section}>
            <div style={gs.sectionTitle}>실행기 프롬프트 (Executor)</div>
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
            <span style={gs.count}>{triggers.filter((t: AnyConfig) => t.enabled).length}/{triggers.length} 활성</span>
          </div>
          {triggers.map((trigger: AnyConfig, idx: number) => (
            <div key={trigger.id || idx} style={gs.toggleRow}>
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
                </span>
                {trigger.description && (
                  <span style={{ fontSize: '0.7rem', color: '#8f97c2' }}>{trigger.description}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
