import type { WidgetConfig } from '@/types';
import eventInfoData from '@/data/event-info.json';

/** Hard-coded fallback – used only when Supabase has no data at all. */
const CODE_DEFAULT_CONFIG: WidgetConfig = {
  maxPlanSteps: 5,
  maxChainDepth: 5,
  activeSkills: ['greeting', 'intent-clarify', 'code-review', 'code-fix', 'test-writer', 'explain-code', 'refactor', 'event-qa', 'document-request', 'user-lookup'],
  theme: 'light',
  triggers: [
    { id: 'user_message', label: '메시지 입력', description: '사용자가 채팅 메시지를 입력했을 때', enabled: true },
    { id: 'button_click', label: '버튼 클릭', description: '프롬프트 버튼을 클릭했을 때', enabled: true },
    { id: 'site_enter', label: '사이트 접속', description: '사용자가 사이트에 처음 접속했을 때', enabled: false },
    { id: 'page_view', label: '페이지 이동', description: '사용자가 다른 페이지로 이동했을 때', enabled: false },
    { id: 'idle_timeout', label: '비활성 감지', description: '일정 시간 동안 활동이 없을 때', enabled: false },
    { id: 'webhook', label: '웹훅 수신', description: '외부 시스템에서 웹훅 요청이 들어왔을 때', enabled: false },
    { id: 'schedule', label: '스케줄 실행', description: '예약된 시간에 자동으로 실행할 때', enabled: false },
  ],
  systemPrompt: '',
  executorPrompt: '',
  activeTools: ['vfs_read', 'vfs_write', 'vfs_list', 'vfs_delete', 'js_sandbox', 'python_sandbox', 'http_request', 'kb_search', 'generate_document', 'send_email', 'fetch_data', 'context_lookup', 'supabase_query', 'user_lookup'],
  activeWorkflows: ['greeting', 'code-review-and-fix', 'explain-and-improve', 'event-qa', 'document-request'],
  customSkills: [],
  customWorkflows: [],
  customTools: [],
  contextProviders: [
    {
      id: 'event-info',
      type: 'static_data' as const,
      label: '행사 정보',
      description: 'AssiWorks 오프닝 이벤트 기본 정보',
      enabled: true,
      data: {
        'event-info': eventInfoData,
      },
    },
    {
      id: 'url-token',
      type: 'url_params' as const,
      label: 'URL 토큰',
      description: 'URL 파라미터에서 app_token, user_token, app, user를 캡처',
      enabled: true,
      captureKeys: ['app_token', 'user_token', 'app', 'user'],
      keyMapping: {},
    },
  ],
  serviceEndpoints: [],
  customAllowedDomains: [],
  toolConfigs: {},
};

/** Built-in context provider IDs that must always be present. */
const BUILTIN_PROVIDER_IDS = new Set(CODE_DEFAULT_CONFIG.contextProviders.map(p => p.id));

function mergeConfig(base: WidgetConfig, overrides: Partial<WidgetConfig>): WidgetConfig {
  const merged = { ...base, ...overrides };
  // Ensure built-in context providers are always present
  const overrideProviders = overrides.contextProviders ?? [];
  const overrideProviderIds = new Set(overrideProviders.map(p => p.id));
  merged.contextProviders = [
    ...CODE_DEFAULT_CONFIG.contextProviders.filter(dp => !overrideProviderIds.has(dp.id)),
    ...overrideProviders,
  ];
  return merged;
}

// ---------------------------------------------------------------------------
// Supabase API helpers
// ---------------------------------------------------------------------------

async function fetchSettingsFromApi(app: string, user: string): Promise<Partial<WidgetConfig> | null> {
  try {
    const res = await fetch(`/api/settings?app=${encodeURIComponent(app)}&user=${encodeURIComponent(user)}`);
    if (!res.ok) return null;
    const { data } = await res.json();
    return (data?.config as Partial<WidgetConfig>) ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Synchronous load – returns code defaults only.
 * Used for SSR and initial render before async load completes.
 */
export function getCodeDefaults(): WidgetConfig {
  return { ...CODE_DEFAULT_CONFIG };
}

/** @deprecated kept only for backward-compatible call-sites that haven't migrated. */
export function loadConfig(): WidgetConfig {
  return getCodeDefaults();
}

/**
 * Async load with hierarchy:
 *   1. User-specific setting  (app=X, user=Y)
 *   2. App default setting    (app=X, user='default')
 *   3. Code defaults
 *
 * User config is merged ON TOP OF app default, so admin-set defaults
 * are always the base and users only override what they change.
 */
export async function loadConfigAsync(app: string = 'default', user: string = 'anonymous'): Promise<WidgetConfig> {
  // 1. Load app default (admin-managed)
  const appDefault = await fetchSettingsFromApi(app, 'default');
  const base = appDefault ? mergeConfig(CODE_DEFAULT_CONFIG, appDefault) : { ...CODE_DEFAULT_CONFIG };

  // 2. If this IS the default user query, we're done
  if (user === 'default') return base;

  // 3. Load user-specific overrides
  const userOverrides = await fetchSettingsFromApi(app, user);
  if (!userOverrides) return base;

  return mergeConfig(base, userOverrides);
}

/**
 * Save user-specific config to Supabase.
 */
export async function saveConfigAsync(config: WidgetConfig, app: string = 'default', user: string = 'anonymous'): Promise<void> {
  try {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app, user, config }),
    });
  } catch {
    console.warn('[ConfigStore] Failed to save config to Supabase');
  }
}

/**
 * Save app-level default config (admin use).
 */
export async function saveDefaultConfigAsync(config: WidgetConfig, app: string = 'default'): Promise<void> {
  return saveConfigAsync(config, app, 'default');
}

export function getDefaultConfig(): WidgetConfig {
  return { ...CODE_DEFAULT_CONFIG };
}

// Suppress unused lint
void BUILTIN_PROVIDER_IDS;
