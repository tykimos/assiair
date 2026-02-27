'use client';

import React, { useState } from 'react';
import { useWidget } from '@/widget/widget-provider';
import { Database, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import type {
  AnyContextProviderConfig,
  UrlParamsProviderConfig,
  IdentityProviderConfig,
  KnowledgeBaseProviderConfig,
  ApiDataProviderConfig,
  StaticDataProviderConfig,
  KnowledgeBaseDocument,
} from '@/types/context-provider';

// ─── Label / badge maps ────────────────────────────────────────────────────────

const TYPE_LABELS: Record<AnyContextProviderConfig['type'], string> = {
  url_params: 'URL Parameters',
  identity: 'User Auth',
  knowledge_base: 'Knowledge Base',
  api_data: 'API Data',
  static_data: 'Static Data',
};

const TYPE_BADGE: Record<AnyContextProviderConfig['type'], string> = {
  url_params: 'bg-cyan-50 text-cyan-600',
  identity: 'bg-amber-50 text-amber-600',
  knowledge_base: 'bg-emerald-50 text-emerald-600',
  api_data: 'bg-violet-50 text-violet-600',
  static_data: 'bg-slate-100 text-slate-500',
};

// ─── Form shape ───────────────────────────────────────────────────────────────

type ProviderType = AnyContextProviderConfig['type'];

interface BaseFormData {
  id: string;
  label: string;
  description: string;
  type: ProviderType;
  enabled: boolean;
}

interface UrlParamsForm extends BaseFormData {
  type: 'url_params';
  captureKeys: string; // comma-separated
  keyMapping: string;  // "key=value" per line
}

interface IdentityForm extends BaseFormData {
  type: 'identity';
  tokenContextKey: string;
  endpointId: string;
  responseMappings: string; // "key=path" per line
}

interface KnowledgeBaseForm extends BaseFormData {
  type: 'knowledge_base';
  kbId: string;
  sourceType: 'api' | 'inline';
  endpointId: string;
  inlineDocuments: { id: string; title: string; content: string }[];
}

interface ApiDataForm extends BaseFormData {
  type: 'api_data';
  endpointId: string;
  defaultParams: string; // "key=value" per line
}

interface StaticDataForm extends BaseFormData {
  type: 'static_data';
  data: string; // "key=value" per line
}

type AnyForm =
  | UrlParamsForm
  | IdentityForm
  | KnowledgeBaseForm
  | ApiDataForm
  | StaticDataForm;

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

function formatKV(obj: Record<string, string | unknown> | undefined): string {
  if (!obj) return '';
  return Object.entries(obj)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n');
}

function emptyFormForType(type: ProviderType): AnyForm {
  const base: BaseFormData = { id: '', label: '', description: '', type, enabled: true };
  switch (type) {
    case 'url_params':
      return { ...base, type: 'url_params', captureKeys: '', keyMapping: '' };
    case 'identity':
      return { ...base, type: 'identity', tokenContextKey: '', endpointId: '', responseMappings: '' };
    case 'knowledge_base':
      return { ...base, type: 'knowledge_base', kbId: '', sourceType: 'api', endpointId: '', inlineDocuments: [{ id: 'doc1', title: '', content: '' }] };
    case 'api_data':
      return { ...base, type: 'api_data', endpointId: '', defaultParams: '' };
    case 'static_data':
      return { ...base, type: 'static_data', data: '' };
  }
}

function formToConfig(form: AnyForm): AnyContextProviderConfig {
  const base = { id: form.id.trim(), label: form.label.trim(), description: form.description.trim(), enabled: form.enabled };
  switch (form.type) {
    case 'url_params':
      return {
        ...base,
        type: 'url_params',
        captureKeys: form.captureKeys.split(',').map(k => k.trim()).filter(Boolean),
        keyMapping: parseKV(form.keyMapping),
      } as UrlParamsProviderConfig;
    case 'identity':
      return {
        ...base,
        type: 'identity',
        tokenContextKey: form.tokenContextKey.trim(),
        endpointId: form.endpointId.trim(),
        responseMappings: parseKV(form.responseMappings),
      } as IdentityProviderConfig;
    case 'knowledge_base': {
      const cfg: KnowledgeBaseProviderConfig = {
        ...base,
        type: 'knowledge_base',
        kbId: form.kbId.trim(),
        sourceType: form.sourceType,
      };
      if (form.sourceType === 'api') cfg.endpointId = form.endpointId.trim();
      else cfg.inlineDocuments = form.inlineDocuments.filter(d => d.title.trim()) as KnowledgeBaseDocument[];
      return cfg;
    }
    case 'api_data':
      return {
        ...base,
        type: 'api_data',
        endpointId: form.endpointId.trim(),
        defaultParams: parseKV(form.defaultParams),
      } as ApiDataProviderConfig;
    case 'static_data':
      return {
        ...base,
        type: 'static_data',
        data: Object.fromEntries(
          form.data
            .split('\n')
            .map(l => l.trim())
            .filter(Boolean)
            .map(l => {
              const eq = l.indexOf('=');
              if (eq === -1) return [l, l];
              const key = l.slice(0, eq).trim();
              const raw = l.slice(eq + 1).trim();
              try { return [key, JSON.parse(raw)]; } catch { return [key, raw]; }
            })
        ),
      } as StaticDataProviderConfig;
  }
}

function configToForm(cfg: AnyContextProviderConfig): AnyForm {
  const base: BaseFormData = { id: cfg.id, label: cfg.label, description: cfg.description, type: cfg.type, enabled: cfg.enabled };
  switch (cfg.type) {
    case 'url_params':
      return {
        ...base, type: 'url_params',
        captureKeys: cfg.captureKeys.join(', '),
        keyMapping: formatKV(cfg.keyMapping),
      };
    case 'identity':
      return {
        ...base, type: 'identity',
        tokenContextKey: cfg.tokenContextKey,
        endpointId: cfg.endpointId,
        responseMappings: formatKV(cfg.responseMappings),
      };
    case 'knowledge_base':
      return {
        ...base, type: 'knowledge_base',
        kbId: cfg.kbId,
        sourceType: cfg.sourceType,
        endpointId: cfg.endpointId || '',
        inlineDocuments: cfg.inlineDocuments?.map(d => ({ id: d.id, title: d.title, content: d.content })) ?? [{ id: 'doc1', title: '', content: '' }],
      };
    case 'api_data':
      return {
        ...base, type: 'api_data',
        endpointId: cfg.endpointId,
        defaultParams: formatKV(cfg.defaultParams),
      };
    case 'static_data':
      return {
        ...base, type: 'static_data',
        data: formatKV(cfg.data as Record<string, string>),
      };
  }
}

// ─── Type-specific fields ─────────────────────────────────────────────────────

function TypeFields({ form, setForm }: { form: AnyForm; setForm: React.Dispatch<React.SetStateAction<AnyForm>> }) {
  const inputCls = 'w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary';
  const textareaCls = `${inputCls} resize-y min-h-[64px] font-mono`;
  const labelCls = 'block text-[10px] font-medium text-text-muted mb-1';

  switch (form.type) {
    case 'url_params':
      return (
        <>
          <div>
            <label className={labelCls}>Capture Keys (comma-separated)</label>
            <input
              className={inputCls}
              placeholder="e.g. token, userId, lang"
              value={form.captureKeys}
              onChange={e => setForm(f => ({ ...f, captureKeys: e.target.value } as AnyForm))}
            />
          </div>
          <div>
            <label className={labelCls}>Key Mapping (key=value, one per line)</label>
            <textarea
              className={textareaCls}
              placeholder={'token=userToken\nuserId=uid'}
              value={form.keyMapping}
              onChange={e => setForm(f => ({ ...f, keyMapping: e.target.value } as AnyForm))}
            />
          </div>
        </>
      );
    case 'identity':
      return (
        <>
          <div>
            <label className={labelCls}>Token Context Key</label>
            <input
              className={inputCls}
              placeholder="e.g. userToken"
              value={form.tokenContextKey}
              onChange={e => setForm(f => ({ ...f, tokenContextKey: e.target.value } as AnyForm))}
            />
          </div>
          <div>
            <label className={labelCls}>Endpoint ID</label>
            <input
              className={`${inputCls} font-mono`}
              placeholder="e.g. identity-api"
              value={form.endpointId}
              onChange={e => setForm(f => ({ ...f, endpointId: e.target.value } as AnyForm))}
            />
          </div>
          <div>
            <label className={labelCls}>Response Mappings (key=path, one per line)</label>
            <textarea
              className={textareaCls}
              placeholder={'userName=data.name\nuserEmail=data.email'}
              value={form.responseMappings}
              onChange={e => setForm(f => ({ ...f, responseMappings: e.target.value } as AnyForm))}
            />
          </div>
        </>
      );
    case 'knowledge_base': {
      const kbForm = form as KnowledgeBaseForm;
      return (
        <>
          <div>
            <label className={labelCls}>KB ID</label>
            <input
              className={`${inputCls} font-mono`}
              placeholder="e.g. kb-main"
              value={kbForm.kbId}
              onChange={e => setForm(f => ({ ...f, kbId: e.target.value } as AnyForm))}
            />
          </div>
          <div>
            <label className={labelCls}>Source Type</label>
            <select
              className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none"
              value={kbForm.sourceType}
              onChange={e => setForm(f => ({ ...f, sourceType: e.target.value as 'api' | 'inline' } as AnyForm))}
            >
              <option value="api">API</option>
              <option value="inline">Inline Documents</option>
            </select>
          </div>
          {kbForm.sourceType === 'api' && (
            <div>
              <label className={labelCls}>Endpoint ID</label>
              <input
                className={`${inputCls} font-mono`}
                placeholder="e.g. kb-api"
                value={kbForm.endpointId}
                onChange={e => setForm(f => ({ ...f, endpointId: e.target.value } as AnyForm))}
              />
            </div>
          )}
          {kbForm.sourceType === 'inline' && (
            <div className="space-y-2">
              <label className={labelCls}>Inline Documents</label>
              {kbForm.inlineDocuments.map((doc, i) => (
                <div key={i} className="p-2 rounded-lg bg-slate-50 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      className="flex-1 px-2 py-1 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Title"
                      value={doc.title}
                      onChange={e => {
                        const docs = kbForm.inlineDocuments.map((d, j) => j === i ? { ...d, title: e.target.value } : d);
                        setForm(f => ({ ...f, inlineDocuments: docs } as AnyForm));
                      }}
                    />
                    {kbForm.inlineDocuments.length > 1 && (
                      <button
                        className="p-0.5 rounded hover:bg-red-50 text-red-400"
                        onClick={() => {
                          const docs = kbForm.inlineDocuments.filter((_, j) => j !== i);
                          setForm(f => ({ ...f, inlineDocuments: docs } as AnyForm));
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <textarea
                    className="w-full px-2 py-1 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y min-h-[56px]"
                    placeholder="Document content"
                    value={doc.content}
                    onChange={e => {
                      const docs = kbForm.inlineDocuments.map((d, j) => j === i ? { ...d, content: e.target.value } : d);
                      setForm(f => ({ ...f, inlineDocuments: docs } as AnyForm));
                    }}
                  />
                </div>
              ))}
              <button
                className="text-[10px] text-primary hover:opacity-80"
                onClick={() => {
                  const docs = [...kbForm.inlineDocuments, { id: `doc${Date.now()}`, title: '', content: '' }];
                  setForm(f => ({ ...f, inlineDocuments: docs } as AnyForm));
                }}
              >
                + Add Document
              </button>
            </div>
          )}
        </>
      );
    }
    case 'api_data':
      return (
        <>
          <div>
            <label className={labelCls}>Endpoint ID</label>
            <input
              className={`${inputCls} font-mono`}
              placeholder="e.g. user-data-api"
              value={form.endpointId}
              onChange={e => setForm(f => ({ ...f, endpointId: e.target.value } as AnyForm))}
            />
          </div>
          <div>
            <label className={labelCls}>Default Params (key=value, one per line)</label>
            <textarea
              className={textareaCls}
              placeholder={'format=json\nversion=v2'}
              value={form.defaultParams}
              onChange={e => setForm(f => ({ ...f, defaultParams: e.target.value } as AnyForm))}
            />
          </div>
        </>
      );
    case 'static_data':
      return (
        <div>
          <label className={labelCls}>Static Data (key=value or key=JSON, one per line)</label>
          <textarea
            className={textareaCls}
            placeholder={'appName=MyApp\nversion="2.0"\nfeatures=["a","b"]'}
            value={form.data}
            onChange={e => setForm(f => ({ ...f, data: e.target.value } as AnyForm))}
          />
        </div>
      );
  }
}

// ─── Expanded detail view ─────────────────────────────────────────────────────

function ProviderDetail({ provider }: { provider: AnyContextProviderConfig }) {
  const labelCls = 'font-medium text-text-muted block mb-1';
  const blockCls = 'p-2 rounded-lg';
  const secondary = { background: 'var(--secondary)' };

  switch (provider.type) {
    case 'url_params':
      return (
        <div className="space-y-2">
          <div className={blockCls} style={secondary}>
            <span className={labelCls}>Capture Keys</span>
            {provider.captureKeys.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {provider.captureKeys.map(k => (
                  <span key={k} className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>{k}</span>
                ))}
              </div>
            ) : <span className="text-text-muted text-[10px]">None</span>}
          </div>
          {Object.keys(provider.keyMapping).length > 0 && (
            <div className={blockCls} style={secondary}>
              <span className={labelCls}>Key Mapping</span>
              {Object.entries(provider.keyMapping).map(([k, v]) => (
                <div key={k} className="text-[10px] font-mono text-foreground">{k} → {v}</div>
              ))}
            </div>
          )}
        </div>
      );
    case 'identity':
      return (
        <div className="space-y-2">
          <div className={blockCls} style={secondary}>
            <span className={labelCls}>Token Context Key</span>
            <span className="text-[11px] font-mono text-foreground">{provider.tokenContextKey}</span>
          </div>
          <div className={blockCls} style={secondary}>
            <span className={labelCls}>Endpoint ID</span>
            <span className="text-[11px] font-mono text-foreground">{provider.endpointId}</span>
          </div>
          {Object.keys(provider.responseMappings).length > 0 && (
            <div className={blockCls} style={secondary}>
              <span className={labelCls}>Response Mappings</span>
              {Object.entries(provider.responseMappings).map(([k, v]) => (
                <div key={k} className="text-[10px] font-mono text-foreground">{k} → {v}</div>
              ))}
            </div>
          )}
        </div>
      );
    case 'knowledge_base':
      return (
        <div className="space-y-2">
          <div className={blockCls} style={secondary}>
            <span className={labelCls}>KB ID</span>
            <span className="text-[11px] font-mono text-foreground">{provider.kbId}</span>
          </div>
          <div className={blockCls} style={secondary}>
            <span className={labelCls}>Source Type</span>
            <span className="text-[11px] text-foreground">{provider.sourceType === 'api' ? 'API' : 'Inline Documents'}</span>
          </div>
          {provider.sourceType === 'api' && provider.endpointId && (
            <div className={blockCls} style={secondary}>
              <span className={labelCls}>Endpoint ID</span>
              <span className="text-[11px] font-mono text-foreground">{provider.endpointId}</span>
            </div>
          )}
          {provider.sourceType === 'inline' && provider.inlineDocuments && provider.inlineDocuments.length > 0 && (
            <div className={blockCls} style={secondary}>
              <span className={labelCls}>Inline Documents ({provider.inlineDocuments.length})</span>
              <div className="space-y-1">
                {provider.inlineDocuments.map(doc => (
                  <div key={doc.id} className="text-[10px] text-foreground">{doc.title || doc.id}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    case 'api_data':
      return (
        <div className="space-y-2">
          <div className={blockCls} style={secondary}>
            <span className={labelCls}>Endpoint ID</span>
            <span className="text-[11px] font-mono text-foreground">{provider.endpointId}</span>
          </div>
          {provider.defaultParams && Object.keys(provider.defaultParams).length > 0 && (
            <div className={blockCls} style={secondary}>
              <span className={labelCls}>Default Params</span>
              {Object.entries(provider.defaultParams).map(([k, v]) => (
                <div key={k} className="text-[10px] font-mono text-foreground">{k}={v}</div>
              ))}
            </div>
          )}
        </div>
      );
    case 'static_data':
      return (
        <div className={blockCls} style={secondary}>
          <span className={labelCls}>Static Data</span>
          {Object.entries(provider.data as Record<string, unknown>).map(([k, v]) => (
            <div key={k} className="text-[10px] font-mono text-foreground">{k}={typeof v === 'string' ? v : JSON.stringify(v)}</div>
          ))}
        </div>
      );
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ContextConfig() {
  const { config, updateConfig } = useWidget();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AnyForm>(emptyFormForType('url_params'));

  const providers = config.contextProviders ?? [];
  const activeCount = providers.filter(p => p.enabled).length;

  const toggleProvider = (id: string) => {
    updateConfig({
      contextProviders: providers.map(p =>
        p.id === id ? { ...p, enabled: !p.enabled } : p
      ),
    });
  };

  const handleEdit = (provider: AnyContextProviderConfig) => {
    setForm(configToForm(provider));
    setEditingId(provider.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    updateConfig({ contextProviders: providers.filter(p => p.id !== id) });
  };

  const handleSave = () => {
    if (!form.id.trim() || !form.label.trim()) return;
    const cfg = formToConfig(form);
    let updated: AnyContextProviderConfig[];
    if (editingId) {
      updated = providers.map(p => p.id === editingId ? cfg : p);
    } else {
      updated = [...providers, cfg];
    }
    updateConfig({ contextProviders: updated });
    setShowForm(false);
    setEditingId(null);
    setForm(emptyFormForType('url_params'));
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyFormForType('url_params'));
  };

  const handleTypeChange = (type: ProviderType) => {
    setForm(f => {
      const base: BaseFormData = { id: f.id, label: f.label, description: f.description, type, enabled: f.enabled };
      return { ...emptyFormForType(type), ...base } as AnyForm;
    });
  };

  const inputCls = 'w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary';
  const labelCls = 'block text-[10px] font-medium text-text-muted mb-1';

  return (
    <div className="p-4 bg-card-bg border border-border rounded-xl space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}
        >
          <Database size={12} className="text-white" />
        </div>
        <span className="text-sm font-medium text-foreground">Context Providers</span>
        <span className="ml-auto text-xs text-text-muted">
          {activeCount}/{providers.length} active
        </span>
      </div>

      {/* Provider list */}
      <div className="space-y-1">
        {providers.map(provider => {
          const isExpanded = expandedId === provider.id;
          return (
            <div key={provider.id} className="rounded-lg overflow-hidden">
              <div
                className="flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer transition-colors"
                style={{ background: isExpanded ? 'var(--secondary)' : 'transparent' }}
              >
                {/* Toggle switch */}
                <div
                  className="relative w-8 h-4 rounded-full flex-shrink-0 transition-colors cursor-pointer"
                  style={{ background: provider.enabled ? 'var(--primary)' : 'var(--border)' }}
                  onClick={e => { e.stopPropagation(); toggleProvider(provider.id); }}
                >
                  <div
                    className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform"
                    style={{ transform: provider.enabled ? 'translateX(16px)' : 'translateX(2px)' }}
                  />
                </div>

                {/* Name + type badge */}
                <div
                  className="flex-1 flex items-center gap-2 min-w-0"
                  onClick={() => setExpandedId(isExpanded ? null : provider.id)}
                >
                  <span className="text-sm font-mono text-foreground truncate">{provider.id}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${TYPE_BADGE[provider.type]}`}>
                    {TYPE_LABELS[provider.type]}
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
                    onClick={e => { e.stopPropagation(); handleEdit(provider); }}
                  >
                    <span className="text-[10px]">Edit</span>
                  </button>
                  <button
                    className="p-1 rounded hover:bg-red-50 text-red-400"
                    onClick={e => { e.stopPropagation(); handleDelete(provider.id); }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 space-y-2 text-xs" style={{ animation: 'slideUp 0.2s ease-out' }}>
                  {provider.description && (
                    <p className="text-text-muted leading-relaxed">{provider.description}</p>
                  )}
                  <ProviderDetail provider={provider} />
                </div>
              )}
            </div>
          );
        })}

        {providers.length === 0 && (
          <p className="text-xs text-text-muted py-1">No providers registered.</p>
        )}
      </div>

      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-xs text-primary hover:opacity-80 transition-opacity"
        >
          <Plus size={14} />
          <span>Add Provider</span>
        </button>
      )}

      {/* Add / edit form */}
      {showForm && (
        <div className="p-3 border border-dashed border-border rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">
              {editingId ? 'Edit Provider' : 'New Provider'}
            </span>
            <button onClick={handleCancel} className="p-1 rounded hover:bg-slate-100 text-text-muted">
              <X size={14} />
            </button>
          </div>

          {/* Type selector */}
          <div>
            <label className={labelCls}>Type</label>
            <select
              className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none"
              value={form.type}
              onChange={e => handleTypeChange(e.target.value as ProviderType)}
              disabled={!!editingId}
            >
              {(Object.keys(TYPE_LABELS) as ProviderType[]).map(t => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {/* Common fields */}
          <div>
            <label className={labelCls}>ID</label>
            <input
              className={`${inputCls} font-mono`}
              placeholder="e.g. url-params-main"
              value={form.id}
              onChange={e => setForm(f => ({ ...f, id: e.target.value } as AnyForm))}
              disabled={!!editingId}
            />
          </div>
          <div>
            <label className={labelCls}>Name (Label)</label>
            <input
              className={inputCls}
              placeholder="e.g. Collect URL Parameters"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value } as AnyForm))}
            />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input
              className={inputCls}
              placeholder="Describe what this provider does"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value } as AnyForm))}
            />
          </div>

          {/* Type-specific fields */}
          <TypeFields form={form} setForm={setForm} />

          <button
            onClick={handleSave}
            disabled={!form.id.trim() || !form.label.trim()}
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
