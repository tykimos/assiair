import type { ChatMessage } from './message';
import type { Plan } from './plan';
import type { LogEntry } from './log';
import type { AnyContextProviderConfig } from './context-provider';
import type { ServiceEndpointConfig } from './service-endpoint';

export interface AssiAirWidgetProps {
  apiEndpoint?: string;
  theme?: 'light' | 'assiworks' | 'aifactory' | 'dark';
  defaultTab?: 'chat' | 'settings' | 'logs';
  onEvent?: (event: WidgetEvent) => void;
  onMessage?: (message: ChatMessage) => void;
  width?: string;
  height?: string;
  className?: string;
  userToken?: string;
  initialContext?: Record<string, unknown>;
  captureUrlParams?: boolean;
  initialConfig?: Partial<WidgetConfig>;
}

export interface TriggerConfig {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface CustomSkillRecord {
  skill_id: string;
  description: string;
  tools: string[];
  requires: string[];
  prompt: string;
  budget_context_tokens: number;
  budget_history_turns: number;
}

export interface CustomWorkflowRecord {
  name: string;
  description: string;
  trigger_patterns: string[];
  /** Natural-language step flow, e.g. "code-review 후 이슈 있으면 code-fix 실행" */
  steps_natural: string;
  completion_message?: string;
}

export interface CustomToolRecord {
  id: string;
  description: string;
  parameters: { name: string; type: string; description: string; required: boolean }[];
}

// User preferences only - NO secrets, NO apiKey
export interface WidgetConfig {
  maxPlanSteps: number;
  maxChainDepth: number;
  activeSkills: string[];
  theme: 'light' | 'assiworks' | 'aifactory' | 'dark';
  triggers: TriggerConfig[];
  systemPrompt: string;
  executorPrompt: string;
  activeTools: string[];
  activeWorkflows: string[];
  customSkills: CustomSkillRecord[];
  customWorkflows: CustomWorkflowRecord[];
  customTools: CustomToolRecord[];
  contextProviders: AnyContextProviderConfig[];
  serviceEndpoints: ServiceEndpointConfig[];
  customAllowedDomains: string[];
}

// Read-only from GET /api/config
export interface ServerConfig {
  provider: string;
  orchModel: string;
  execModel: string;
  availableModels: {
    orch: string[];
    exec: string[];
  };
  featureFlags: Record<string, boolean>;
  version: string;
}

export interface WidgetState {
  activeTab: 'chat' | 'settings' | 'logs';
  messages: ChatMessage[];
  currentPlan: Plan | null;
  isStreaming: boolean;
  config: WidgetConfig;
  serverConfig: ServerConfig | null;
  logs: LogEntry[];
}

export type WidgetEvent = {
  type: 'message_sent' | 'plan_started' | 'plan_completed' | 'skill_executed' | 'error';
  data: unknown;
};
