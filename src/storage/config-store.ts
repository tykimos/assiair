import type { WidgetConfig } from '@/types';
import eventInfoData from '@/data/event-info.json';

const CONFIG_KEY = 'assiair-config';

const DEFAULT_CONFIG: WidgetConfig = {
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
      description: 'URL 파라미터에서 app(홈페이지)과 user(사용자) 토큰을 캡처',
      enabled: true,
      captureKeys: ['app', 'user'],
      keyMapping: {},
    },
  ],
  serviceEndpoints: [],
  customAllowedDomains: [],
};

/** IDs of context providers that ship with the app and must always be present. */
const DEFAULT_PROVIDER_IDS = new Set(DEFAULT_CONFIG.contextProviders.map(p => p.id));

export function loadConfig(): WidgetConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_CONFIG };
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<WidgetConfig>;

      // Merge contextProviders: ensure default providers are always present
      const storedProviders = parsed.contextProviders ?? [];
      const storedProviderIds = new Set(storedProviders.map(p => p.id));
      const mergedProviders = [
        ...DEFAULT_CONFIG.contextProviders.filter(dp => !storedProviderIds.has(dp.id)),
        ...storedProviders,
      ];

      return { ...DEFAULT_CONFIG, ...parsed, contextProviders: mergedProviders };
    }
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: WidgetConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    console.warn('[ConfigStore] Failed to save config');
  }
}

export function getDefaultConfig(): WidgetConfig {
  return { ...DEFAULT_CONFIG };
}
