'use client';

import React, { useState, useMemo } from 'react';
import { useWidget } from '@/widget/widget-provider';
import { Wrench, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { getAllToolIds, getToolMeta, isBuiltinTool, registerCustomTool, removeCustomTool } from '@/tools';
import type { CustomToolRecord } from '@/types/widget';

const TOOL_DESCRIPTIONS: Record<string, string> = {
  vfs_read: 'Virtual File Read',
  vfs_write: 'Virtual File Write',
  vfs_list: 'Virtual File List',
  vfs_delete: 'Virtual File Delete',
  js_sandbox: 'Execute JavaScript',
  python_sandbox: 'Execute Python',
  http_request: 'HTTP Request',
};

interface ToolFormData {
  id: string;
  description: string;
  parameters: { name: string; type: string; description: string; required: boolean }[];
}

const EMPTY_FORM: ToolFormData = {
  id: '',
  description: '',
  parameters: [{ name: '', type: 'string', description: '', required: true }],
};

export function ToolManager() {
  const { config, updateConfig, appDefaultConfig } = useWidget();
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ToolFormData>({ ...EMPTY_FORM });

  // Only show tools that are active in the app default config
  const allowedToolIds = useMemo(() => new Set(appDefaultConfig.activeTools), [appDefaultConfig.activeTools]);
  const allToolIds = getAllToolIds().filter(id => allowedToolIds.has(id));

  const toggleTool = (toolId: string) => {
    const activeTools = config.activeTools.includes(toolId)
      ? config.activeTools.filter(t => t !== toolId)
      : [...config.activeTools, toolId];
    updateConfig({ activeTools });
  };

  const handleParamChange = (index: number, field: string, value: string | boolean) => {
    setForm(f => ({
      ...f,
      parameters: f.parameters.map((p, i) => i === index ? { ...p, [field]: value } : p),
    }));
  };

  const handleAddParam = () => {
    setForm(f => ({ ...f, parameters: [...f.parameters, { name: '', type: 'string', description: '', required: true }] }));
  };

  const handleRemoveParam = (index: number) => {
    setForm(f => ({ ...f, parameters: f.parameters.filter((_, i) => i !== index) }));
  };

  const handleSave = () => {
    if (!form.id.trim() || !form.description.trim()) return;

    const params = form.parameters.filter(p => p.name.trim());
    const record: CustomToolRecord = {
      id: form.id.trim(),
      description: form.description.trim(),
      parameters: params,
    };

    registerCustomTool(record.id, record.description, record.parameters);

    const customTools = [...config.customTools, record];
    const activeTools = config.activeTools.includes(record.id)
      ? config.activeTools
      : [...config.activeTools, record.id];
    updateConfig({ customTools, activeTools });

    setShowForm(false);
    setForm({ ...EMPTY_FORM });
  };

  const handleDelete = (toolId: string) => {
    removeCustomTool(toolId);
    updateConfig({
      customTools: config.customTools.filter(t => t.id !== toolId),
      activeTools: config.activeTools.filter(t => t !== toolId),
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setForm({ ...EMPTY_FORM });
  };

  return (
    <div className="p-4 bg-card-bg border border-border rounded-xl space-y-3">
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }}
        >
          <Wrench size={12} className="text-white" />
        </div>
        <span className="text-sm font-medium text-foreground">Tool Manager</span>
        <span className="ml-auto text-xs text-text-muted">
          {config.activeTools.length}/{allToolIds.length} active
        </span>
      </div>

      <div className="space-y-1">
        {allToolIds.map(toolId => {
          const meta = getToolMeta(toolId);
          const isActive = config.activeTools.includes(toolId);
          const builtin = isBuiltinTool(toolId);
          const label = TOOL_DESCRIPTIONS[toolId] || meta?.description || toolId;
          const isExpanded = expandedTool === toolId;
          const customRecord = config.customTools.find(t => t.id === toolId);

          return (
            <div key={toolId} className="rounded-lg overflow-hidden">
              <div
                className="flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer transition-colors"
                style={{ background: isExpanded ? 'var(--secondary)' : 'transparent' }}
              >
                {/* Toggle switch */}
                <div
                  className="relative w-8 h-4 rounded-full flex-shrink-0 transition-colors cursor-pointer"
                  style={{ background: isActive ? 'var(--primary)' : 'var(--border)' }}
                  onClick={(e) => { e.stopPropagation(); toggleTool(toolId); }}
                >
                  <div
                    className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform"
                    style={{ transform: isActive ? 'translateX(16px)' : 'translateX(2px)' }}
                  />
                </div>

                <span
                  className="text-sm text-foreground flex-1"
                  onClick={() => setExpandedTool(isExpanded ? null : toolId)}
                >
                  {toolId}
                </span>

                {builtin && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-500">Built-in</span>
                )}
                {!builtin && (
                  <button
                    className="p-1 rounded hover:bg-red-50 text-red-400"
                    onClick={(e) => { e.stopPropagation(); handleDelete(toolId); }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                <ChevronDown
                  size={12}
                  className="text-text-muted transition-transform"
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  onClick={() => setExpandedTool(isExpanded ? null : toolId)}
                />
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 space-y-2 text-xs" style={{ animation: 'slideUp 0.2s ease-out' }}>
                  <p className="text-text-muted">{label}</p>

                  <div className="p-2 rounded-lg" style={{ background: 'var(--secondary)' }}>
                    <span className="font-medium text-text-muted block mb-1">Tool ID</span>
                    <span className="text-[11px] font-mono text-foreground">{toolId}</span>
                  </div>

                  {/* Parameters for custom tools */}
                  {customRecord && customRecord.parameters.length > 0 && (
                    <div className="p-2 rounded-lg" style={{ background: 'var(--secondary)' }}>
                      <span className="font-medium text-text-muted block mb-1">Parameters</span>
                      <div className="space-y-1">
                        {customRecord.parameters.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 text-[11px]">
                            <span className="font-mono text-foreground">{p.name}</span>
                            <span className="text-text-muted">({p.type})</span>
                            {p.required && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-red-50 text-red-400">Required</span>
                            )}
                            {p.description && (
                              <span className="text-text-muted">— {p.description}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
          <span>Add Tool</span>
        </button>
      )}

      {/* Add form */}
      {showForm && (
        <div className="p-3 border border-dashed border-border rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">New Tool</span>
            <button onClick={handleCancel} className="p-1 rounded hover:bg-slate-100 text-text-muted">
              <X size={14} />
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-text-muted mb-1">Tool ID</label>
            <input
              className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              placeholder="e.g. weather_api"
              value={form.id}
              onChange={(e) => setForm(f => ({ ...f, id: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-text-muted mb-1">Description</label>
            <input
              className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Describe what this tool does"
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-medium text-text-muted">Parameters</label>
            {form.parameters.map((param, i) => (
              <div key={i} className="p-2 rounded-lg bg-slate-50 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    className="flex-1 px-2 py-1 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    placeholder="Name"
                    value={param.name}
                    onChange={(e) => handleParamChange(i, 'name', e.target.value)}
                  />
                  <select
                    className="px-1.5 py-1 text-xs border border-border rounded bg-background text-foreground focus:outline-none"
                    value={param.type}
                    onChange={(e) => handleParamChange(i, 'type', e.target.value)}
                  >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="object">object</option>
                  </select>
                  <label className="flex items-center gap-0.5 text-[10px] text-text-muted whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={param.required}
                      onChange={(e) => handleParamChange(i, 'required', e.target.checked)}
                    />
                    Required
                  </label>
                  {form.parameters.length > 1 && (
                    <button onClick={() => handleRemoveParam(i)} className="p-0.5 rounded hover:bg-red-50 text-red-400">
                      <X size={12} />
                    </button>
                  )}
                </div>
                <input
                  className="w-full px-2 py-1 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Description"
                  value={param.description}
                  onChange={(e) => handleParamChange(i, 'description', e.target.value)}
                />
              </div>
            ))}
            <button
              onClick={handleAddParam}
              className="text-[10px] text-primary hover:opacity-80"
            >
              + Add Parameter
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={!form.id.trim() || !form.description.trim()}
            className="px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50"
            style={{ background: 'var(--primary)' }}
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
