'use client';

import React, { useState } from 'react';
import { useWidget } from '@/widget/widget-provider';
import { Globe, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import type { ServiceEndpointConfig } from '@/types/service-endpoint';

// ─── Label / badge maps ────────────────────────────────────────────────────────

type EndpointCategory = ServiceEndpointConfig['category'];
type EndpointMethod = ServiceEndpointConfig['method'];

const CATEGORY_LABELS: Record<EndpointCategory, string> = {
  identity: 'Auth',
  knowledge_base: 'Knowledge Base',
  document: 'Document',
  email: 'Email',
  data: 'Data',
  general: 'General',
};

const CATEGORY_BADGE: Record<EndpointCategory, string> = {
  identity: 'bg-amber-50 text-amber-600',
  knowledge_base: 'bg-emerald-50 text-emerald-600',
  document: 'bg-blue-50 text-blue-600',
  email: 'bg-pink-50 text-pink-600',
  data: 'bg-violet-50 text-violet-600',
  general: 'bg-slate-100 text-slate-500',
};

const METHOD_BADGE: Record<EndpointMethod, string> = {
  GET: 'bg-green-50 text-green-600',
  POST: 'bg-blue-50 text-blue-600',
  PUT: 'bg-amber-50 text-amber-600',
  DELETE: 'bg-red-50 text-red-500',
};

// ─── Form shape ───────────────────────────────────────────────────────────────

interface EndpointFormData {
  id: string;
  label: string;
  description: string;
  baseUrl: string;
  method: EndpointMethod;
  headers: string;      // "key=value" per line
  bodyTemplate: string;
  timeoutMs: number;
  category: EndpointCategory;
}

const EMPTY_FORM: EndpointFormData = {
  id: '',
  label: '',
  description: '',
  baseUrl: '',
  method: 'GET',
  headers: '',
  bodyTemplate: '',
  timeoutMs: 10000,
  category: 'general',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseKV(text: string): Record<string, string> {
  return Object.fromEntries(
    text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const eq = line.indexOf('=');
        if (eq === -1) return [line, ''];
        return [line.slice(0, eq).trim(), line.slice(eq + 1).trim()];
      })
  );
}

function formatKV(obj: Record<string, string> | undefined): string {
  if (!obj) return '';
  return Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('\n');
}

function formToConfig(form: EndpointFormData): ServiceEndpointConfig {
  return {
    id: form.id.trim(),
    label: form.label.trim(),
    description: form.description.trim(),
    baseUrl: form.baseUrl.trim(),
    method: form.method,
    headers: parseKV(form.headers),
    bodyTemplate: form.bodyTemplate.trim() || undefined,
    timeoutMs: form.timeoutMs,
    category: form.category,
  };
}

function configToForm(cfg: ServiceEndpointConfig): EndpointFormData {
  return {
    id: cfg.id,
    label: cfg.label,
    description: cfg.description,
    baseUrl: cfg.baseUrl,
    method: cfg.method,
    headers: formatKV(cfg.headers),
    bodyTemplate: cfg.bodyTemplate ?? '',
    timeoutMs: cfg.timeoutMs,
    category: cfg.category,
  };
}

// ─── Expanded detail view ─────────────────────────────────────────────────────

function EndpointDetail({ endpoint }: { endpoint: ServiceEndpointConfig }) {
  const blockCls = 'p-2 rounded-lg';
  const secondary = { background: 'var(--secondary)' };
  const labelCls = 'font-medium text-text-muted block mb-1';

  return (
    <div className="space-y-2">
      <div className={blockCls} style={secondary}>
        <span className={labelCls}>Base URL</span>
        <span className="text-[11px] font-mono text-foreground break-all">{endpoint.baseUrl}</span>
      </div>

      {Object.keys(endpoint.headers).length > 0 && (
        <div className={blockCls} style={secondary}>
          <span className={labelCls}>Headers</span>
          {Object.entries(endpoint.headers).map(([k, v]) => (
            <div key={k} className="text-[10px] font-mono text-foreground">{k}: {v}</div>
          ))}
        </div>
      )}

      {endpoint.bodyTemplate && (
        <div className={blockCls} style={secondary}>
          <span className={labelCls}>Body Template</span>
          <pre className="text-[10px] font-mono text-foreground whitespace-pre-wrap break-all">{endpoint.bodyTemplate}</pre>
        </div>
      )}

      <div className={blockCls} style={secondary}>
        <span className={labelCls}>Timeout</span>
        <span className="text-[11px] text-foreground">{endpoint.timeoutMs.toLocaleString()} ms</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ServiceEndpoints() {
  const { config, updateConfig } = useWidget();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EndpointFormData>({ ...EMPTY_FORM });

  const endpoints = config.serviceEndpoints ?? [];

  const handleEdit = (endpoint: ServiceEndpointConfig) => {
    setForm(configToForm(endpoint));
    setEditingId(endpoint.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    updateConfig({ serviceEndpoints: endpoints.filter(e => e.id !== id) });
  };

  const handleSave = () => {
    if (!form.id.trim() || !form.label.trim() || !form.baseUrl.trim()) return;
    const cfg = formToConfig(form);
    let updated: ServiceEndpointConfig[];
    if (editingId) {
      updated = endpoints.map(e => e.id === editingId ? cfg : e);
    } else {
      updated = [...endpoints, cfg];
    }
    updateConfig({ serviceEndpoints: updated });
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  };

  const inputCls = 'w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary';
  const labelCls = 'block text-[10px] font-medium text-text-muted mb-1';

  return (
    <div className="p-4 bg-card-bg border border-border rounded-xl space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #0d9488, #06b6d4)' }}
        >
          <Globe size={12} className="text-white" />
        </div>
        <span className="text-sm font-medium text-foreground">Service Endpoints</span>
        <span className="ml-auto text-xs text-text-muted">
          {endpoints.length}
        </span>
      </div>

      {/* Endpoint list */}
      <div className="space-y-1">
        {endpoints.map(endpoint => {
          const isExpanded = expandedId === endpoint.id;
          return (
            <div key={endpoint.id} className="rounded-lg overflow-hidden">
              <div
                className="flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer transition-colors"
                style={{ background: isExpanded ? 'var(--secondary)' : 'transparent' }}
              >
                {/* Name + badges */}
                <div
                  className="flex-1 flex items-center gap-2 min-w-0"
                  onClick={() => setExpandedId(isExpanded ? null : endpoint.id)}
                >
                  <span className="text-sm text-foreground truncate">{endpoint.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${CATEGORY_BADGE[endpoint.category]}`}>
                    {CATEGORY_LABELS[endpoint.category]}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 font-mono ${METHOD_BADGE[endpoint.method]}`}>
                    {endpoint.method}
                  </span>
                  <ChevronDown
                    size={12}
                    className="text-text-muted transition-transform flex-shrink-0"
                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    className="p-1 rounded hover:bg-slate-100 text-text-muted"
                    onClick={e => { e.stopPropagation(); handleEdit(endpoint); }}
                  >
                    <span className="text-[10px]">Edit</span>
                  </button>
                  <button
                    className="p-1 rounded hover:bg-red-50 text-red-400"
                    onClick={e => { e.stopPropagation(); handleDelete(endpoint.id); }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 space-y-2 text-xs" style={{ animation: 'slideUp 0.2s ease-out' }}>
                  {endpoint.description && (
                    <p className="text-text-muted leading-relaxed">{endpoint.description}</p>
                  )}
                  <EndpointDetail endpoint={endpoint} />
                </div>
              )}
            </div>
          );
        })}

        {endpoints.length === 0 && (
          <p className="text-xs text-text-muted py-1">No endpoints registered.</p>
        )}
      </div>

      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-xs text-primary hover:opacity-80 transition-opacity"
        >
          <Plus size={14} />
          <span>Add Endpoint</span>
        </button>
      )}

      {/* Add / edit form */}
      {showForm && (
        <div className="p-3 border border-dashed border-border rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">
              {editingId ? 'Edit Endpoint' : 'New Endpoint'}
            </span>
            <button onClick={handleCancel} className="p-1 rounded hover:bg-slate-100 text-text-muted">
              <X size={14} />
            </button>
          </div>

          <div>
            <label className={labelCls}>ID</label>
            <input
              className={`${inputCls} font-mono`}
              placeholder="e.g. identity-api"
              value={form.id}
              onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
              disabled={!!editingId}
            />
          </div>

          <div>
            <label className={labelCls}>Name (Label)</label>
            <input
              className={inputCls}
              placeholder="e.g. User Auth API"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <input
              className={inputCls}
              placeholder="Describe what this endpoint does"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div>
            <label className={labelCls}>Base URL</label>
            <input
              className={`${inputCls} font-mono`}
              placeholder="https://api.example.com/users/{{userToken}}"
              value={form.baseUrl}
              onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelCls}>Method</label>
              <select
                className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none"
                value={form.method}
                onChange={e => setForm(f => ({ ...f, method: e.target.value as EndpointMethod }))}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div className="flex-1">
              <label className={labelCls}>Category</label>
              <select
                className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as EndpointCategory }))}
              >
                {(Object.keys(CATEGORY_LABELS) as EndpointCategory[]).map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Headers (key=value, one per line)</label>
            <textarea
              className={`${inputCls} resize-y min-h-[56px] font-mono`}
              placeholder={'Content-Type=application/json\nAuthorization=Bearer {{token}}'}
              value={form.headers}
              onChange={e => setForm(f => ({ ...f, headers: e.target.value }))}
            />
          </div>

          <div>
            <label className={labelCls}>Body Template</label>
            <textarea
              className={`${inputCls} resize-y min-h-[56px] font-mono`}
              placeholder={'{"userId": "{{userId}}"}'}
              value={form.bodyTemplate}
              onChange={e => setForm(f => ({ ...f, bodyTemplate: e.target.value }))}
            />
          </div>

          <div>
            <label className={labelCls}>Timeout (ms)</label>
            <input
              type="number"
              className={inputCls}
              value={form.timeoutMs}
              onChange={e => setForm(f => ({ ...f, timeoutMs: parseInt(e.target.value) || 10000 }))}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!form.id.trim() || !form.label.trim() || !form.baseUrl.trim()}
            className="px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50"
            style={{ background: 'var(--primary)' }}
          >
            {editingId ? 'Edit' : 'Add'}
          </button>
        </div>
      )}
    </div>
  );
}
