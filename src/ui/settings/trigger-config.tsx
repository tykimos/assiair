'use client';

import React, { useState } from 'react';
import { useWidget } from '@/widget/widget-provider';
import { Zap, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import type { TriggerConfig as TriggerConfigType } from '@/types/widget';

const BUILTIN_TRIGGER_IDS = new Set([
  'user_message', 'button_click', 'site_enter', 'page_view',
  'idle_timeout', 'webhook', 'schedule',
]);

interface TriggerFormData {
  id: string;
  label: string;
  description: string;
}

const EMPTY_FORM: TriggerFormData = { id: '', label: '', description: '' };

export function TriggerConfig() {
  const { config, updateConfig } = useWidget();
  const triggers = config.triggers || [];
  const [expandedTrigger, setExpandedTrigger] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<string | null>(null);
  const [editingBuiltin, setEditingBuiltin] = useState(false);
  const [form, setForm] = useState<TriggerFormData>({ ...EMPTY_FORM });

  const toggleTrigger = (id: string) => {
    const updated = triggers.map(t =>
      t.id === id ? { ...t, enabled: !t.enabled } : t
    );
    updateConfig({ triggers: updated });
  };

  const handleSave = () => {
    if (!form.id.trim() || !form.label.trim()) return;

    const existingTrigger = editingTrigger ? triggers.find(t => t.id === editingTrigger) : null;
    const record: TriggerConfigType = {
      id: form.id.trim(),
      label: form.label.trim(),
      description: form.description.trim(),
      enabled: existingTrigger?.enabled ?? true,
    };

    let updated: TriggerConfigType[];
    if (editingTrigger) {
      updated = triggers.map(t => t.id === editingTrigger ? record : t);
    } else {
      updated = [...triggers, record];
    }
    updateConfig({ triggers: updated });

    setShowForm(false);
    setEditingTrigger(null);
    setEditingBuiltin(false);
    setForm({ ...EMPTY_FORM });
  };

  const handleEdit = (id: string) => {
    const t = triggers.find(t => t.id === id);
    if (!t) return;
    setForm({ id: t.id, label: t.label, description: t.description });
    setEditingTrigger(id);
    setEditingBuiltin(BUILTIN_TRIGGER_IDS.has(id));
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    updateConfig({ triggers: triggers.filter(t => t.id !== id) });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingTrigger(null);
    setEditingBuiltin(false);
    setForm({ ...EMPTY_FORM });
  };

  return (
    <div className="p-4 bg-card-bg border border-border rounded-xl space-y-3">
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
        >
          <Zap size={12} className="text-white" />
        </div>
        <span className="text-sm font-medium text-foreground">Trigger Settings</span>
        <span className="ml-auto text-xs text-text-muted">
          {triggers.filter(t => t.enabled).length}/{triggers.length} active
        </span>
      </div>

      <div className="space-y-1">
        {triggers.map(trigger => {
          const isExpanded = expandedTrigger === trigger.id;
          const isBuiltin = BUILTIN_TRIGGER_IDS.has(trigger.id);

          return (
            <div key={trigger.id} className="rounded-lg overflow-hidden">
              <div
                className="flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer transition-colors"
                style={{ background: isExpanded ? 'var(--secondary)' : 'transparent' }}
              >
                {/* Toggle switch */}
                <div
                  className="relative w-8 h-4 rounded-full flex-shrink-0 transition-colors cursor-pointer"
                  style={{ background: trigger.enabled ? 'var(--primary)' : 'var(--border)' }}
                  onClick={(e) => { e.stopPropagation(); toggleTrigger(trigger.id); }}
                >
                  <div
                    className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform"
                    style={{ transform: trigger.enabled ? 'translateX(16px)' : 'translateX(2px)' }}
                  />
                </div>

                <div
                  className="flex-1 min-w-0"
                  onClick={() => setExpandedTrigger(isExpanded ? null : trigger.id)}
                >
                  <span className="text-sm text-foreground block truncate">
                    {trigger.label || trigger.id}
                  </span>
                  {trigger.label && trigger.label !== trigger.id && (
                    <span className="text-[10px] font-mono text-text-muted">{trigger.id}</span>
                  )}
                </div>

                {isBuiltin && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-500 flex-shrink-0">Built-in</span>
                )}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    className="p-1 rounded hover:bg-slate-100 text-text-muted"
                    onClick={(e) => { e.stopPropagation(); handleEdit(trigger.id); }}
                  >
                    <span className="text-[10px]">Edit</span>
                  </button>
                  {!isBuiltin && (
                    <button
                      className="p-1 rounded hover:bg-red-50 text-red-400"
                      onClick={(e) => { e.stopPropagation(); handleDelete(trigger.id); }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <ChevronDown
                  size={12}
                  className="text-text-muted transition-transform"
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  onClick={() => setExpandedTrigger(isExpanded ? null : trigger.id)}
                />
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 space-y-2 text-xs" style={{ animation: 'slideUp 0.2s ease-out' }}>
                  <p className="text-text-muted">{trigger.description}</p>
                  <div className="p-2 rounded-lg" style={{ background: 'var(--secondary)' }}>
                    <span className="font-medium text-text-muted block mb-1">Trigger ID</span>
                    <span className="text-[11px] font-mono text-foreground">{trigger.id}</span>
                  </div>
                  <div className="p-2 rounded-lg" style={{ background: 'var(--secondary)' }}>
                    <span className="font-medium text-text-muted block mb-1">Display Label</span>
                    <span className="text-[11px] text-foreground">{trigger.label || trigger.id}</span>
                  </div>
                  <div className="p-2 rounded-lg" style={{ background: 'var(--secondary)' }}>
                    <span className="font-medium text-text-muted block mb-1">Status</span>
                    <span className={`text-[11px] font-medium ${trigger.enabled ? 'text-green-600' : 'text-slate-400'}`}>
                      {trigger.enabled ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-xs text-primary hover:opacity-80 transition-opacity"
        >
          <Plus size={14} />
          <span>Add Trigger</span>
        </button>
      )}

      {/* Inline form */}
      {showForm && (
        <div className="p-3 border border-dashed border-border rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">
              {editingTrigger ? 'Edit Trigger' : 'New Trigger'}
            </span>
            <button onClick={handleCancel} className="p-1 rounded hover:bg-slate-100 text-text-muted">
              <X size={14} />
            </button>
          </div>

          {!editingBuiltin && (
            <div>
              <label className="block text-[10px] font-medium text-text-muted mb-1">Trigger ID</label>
              <input
                className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                placeholder="e.g. form_submit"
                value={form.id}
                onChange={(e) => setForm(f => ({ ...f, id: e.target.value }))}
                disabled={!!editingTrigger}
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-medium text-text-muted mb-1">Display Label</label>
            <input
              className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. Form Submit"
              value={form.label}
              onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-text-muted mb-1">Description</label>
            <input
              className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Describe when this trigger fires"
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!form.id.trim() || !form.label.trim()}
            className="px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50"
            style={{ background: 'var(--primary)' }}
          >
            {editingTrigger ? 'Edit' : 'Add'}
          </button>
        </div>
      )}
    </div>
  );
}
