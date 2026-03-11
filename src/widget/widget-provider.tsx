'use client';

import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback, useState } from 'react';
import type { ChatMessage, BuildingStep, Plan, LogEntry, ExecutionSignals, Trigger } from '@/types';
import type { AssiAirWidgetProps, WidgetConfig, ServerConfig, WidgetEvent } from './widget-types';
import { AgentLogger } from '@/agent/logger';
import { AgentController, type StreamEvent } from '@/agent/controller';
import { getSkillRegistry } from '@/skills/registry';
import { getWorkflowRegistry } from '@/workflows/registry';
import { registerCustomTool } from '@/tools';
import { getCodeDefaults, saveConfigAsync, loadConfigAsync } from '@/storage/config-store';
import { saveSessionToDb, loadSessionFromDb } from '@/storage/session-store';
import { cleanContent } from '@/executor/parser';
import { getContextProviderRegistry } from '@/context/context-registry';
import { addAllowedDomain } from '../../config/http-allowlist';
import { getSupabaseClient } from '@/lib/supabase';

interface WidgetContextValue {
  messages: ChatMessage[];
  currentPlan: Plan | null;
  isStreaming: boolean;
  activeTab: 'chat' | 'settings' | 'logs';
  config: WidgetConfig;
  /** App default config (admin-managed). Used to determine which items are available to users. */
  appDefaultConfig: WidgetConfig;
  serverConfig: ServerConfig | null;
  logs: LogEntry[];
  sessionId: string;
  /** Whether a valid app_token (or user_token or app param) was provided */
  hasValidToken: boolean;
  /** Whether the app default config has been loaded from DB */
  appDefaultConfigLoaded: boolean;
  sendMessage: (text: string) => void;
  setActiveTab: (tab: 'chat' | 'settings' | 'logs') => void;
  updateConfig: (updates: Partial<WidgetConfig>) => void;
  clearLogs: () => void;
  clearMessages: () => void;
  restoreSession: (sessionId: string) => Promise<void>;
}

const WidgetContext = createContext<WidgetContextValue | null>(null);

type Action =
  | { type: 'ADD_MESSAGE'; message: ChatMessage }
  | { type: 'UPDATE_MESSAGE'; id: string; updates: Partial<ChatMessage> }
  | { type: 'UPDATE_LAST_EXECUTION_MESSAGE'; content: string }
  | { type: 'FINISH_STREAMING'; targetId: string; buttons?: string[]; signals?: ExecutionSignals }
  | { type: 'SET_PLAN'; plan: Plan | null }
  | { type: 'SET_STREAMING'; streaming: boolean }
  | { type: 'SET_TAB'; tab: 'chat' | 'settings' | 'logs' }
  | { type: 'SET_CONFIG'; config: WidgetConfig }
  | { type: 'SET_SERVER_CONFIG'; serverConfig: ServerConfig }
  | { type: 'ADD_LOG'; log: LogEntry }
  | { type: 'CLEAR_LOGS' }
  | { type: 'CLEAR_MESSAGES' };

interface ConversationState {
  summary: string;
  turn_count: number;
  open_questions: string[];
  last_workflow_id?: string;
  last_skill_id?: string;
}

interface State {
  messages: ChatMessage[];
  currentPlan: Plan | null;
  isStreaming: boolean;
  activeTab: 'chat' | 'settings' | 'logs';
  config: WidgetConfig;
  serverConfig: ServerConfig | null;
  logs: LogEntry[];
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };

    case 'UPDATE_MESSAGE': {
      const msgs = state.messages.map(m =>
        m.id === action.id ? { ...m, ...action.updates } : m
      );
      return { ...state, messages: msgs };
    }

    case 'UPDATE_LAST_EXECUTION_MESSAGE': {
      const msgs = [...state.messages];
      // Find last execution message
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].messageType === 'execution') {
          msgs[i] = { ...msgs[i], content: msgs[i].content + action.content };
          break;
        }
      }
      return { ...state, messages: msgs };
    }

    case 'FINISH_STREAMING': {
      const msgs = state.messages.map(m => {
        if (m.id === action.targetId) {
          return {
            ...m,
            content: cleanContent(m.content),
            isStreaming: false,
            promptButtons: action.buttons,
            signals: action.signals,
            buildingSteps: m.buildingSteps?.map(s => ({ ...s, status: 'done' as const })),
          };
        }
        return m;
      });
      return { ...state, messages: msgs, isStreaming: false };
    }

    case 'SET_PLAN':
      return { ...state, currentPlan: action.plan };
    case 'SET_STREAMING':
      return { ...state, isStreaming: action.streaming };
    case 'SET_TAB':
      return { ...state, activeTab: action.tab };
    case 'SET_CONFIG':
      return { ...state, config: action.config };
    case 'SET_SERVER_CONFIG':
      return { ...state, serverConfig: action.serverConfig };
    case 'ADD_LOG':
      return { ...state, logs: [...state.logs.slice(-999), action.log] };
    case 'CLEAR_LOGS':
      return { ...state, logs: [] };
    case 'CLEAR_MESSAGES':
      return { ...state, messages: [], currentPlan: null };
    default:
      return state;
  }
}

const TOOL_LABELS: Record<string, string> = {
  context_lookup: 'Context Lookup',
  kb_search: 'KB Search',
  generate_document: 'Generate Document',
  send_email: 'Send Email',
  fetch_data: 'Fetch Data',
  http_request: 'HTTP Request',
  vfs_read: 'File Read',
  vfs_write: 'File Write',
  vfs_list: 'File List',
  vfs_delete: 'File Delete',
  js_sandbox: 'Run JavaScript',
  python_sandbox: 'Run Python',
  user_lookup: 'User Lookup',
};

function getToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] || toolName;
}

interface ToolStepState {
  id: string;
  label: string;
  done: boolean;
  ok?: boolean;
}

function buildStepsFromToolState(toolSteps: ToolStepState[], phase: 'init' | 'tools' | 'writing'): BuildingStep[] {
  const steps: BuildingStep[] = toolSteps.map(t => ({
    step: t.label,
    status: t.done ? 'done' as const : 'running' as const,
    ok: t.done ? t.ok : undefined,
  }));
  steps.push({ step: 'Write response', status: phase === 'writing' ? 'running' : 'pending' });
  return steps;
}

function getInitialBuildingSteps(skillId?: string): BuildingStep[] {
  if (skillId === 'greeting') {
    return [
      { step: 'Preparing greeting', status: 'running' },
      { step: 'Write response', status: 'pending' },
    ];
  }
  if (skillId?.includes('code')) {
    return [
      { step: 'Analyzing code', status: 'running' },
      { step: 'Processing', status: 'pending' },
      { step: 'Write response', status: 'pending' },
    ];
  }
  return [
    { step: 'Preparing', status: 'running' },
    { step: 'Write response', status: 'pending' },
  ];
}

function getUrlParam(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(key);
}

export function WidgetProvider({ children, props }: { children: React.ReactNode; props: AssiAirWidgetProps }) {
  const loggerRef = useRef<AgentLogger | null>(null);
  const controllerRef = useRef<AgentController | null>(null);
  const conversationStateRef = useRef<ConversationState | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  // Session & identity tracking — use URL param if provided, otherwise generate
  const sessionIdRef = useRef<string>(getUrlParam('session_id') || `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const appTokenRef = useRef<string | null>(getUrlParam('app_token'));
  const userTokenRef = useRef<string | null>(getUrlParam('user_token'));
  const appRef = useRef<string>(getUrlParam('app') || 'default');
  const userRef = useRef<string>(getUrlParam('user') || 'anonymous');
  // Start with empty active lists so Settings UI shows nothing until DB loads
  const [appDefaultConfig, setAppDefaultConfig] = useState<WidgetConfig>({
    ...getCodeDefaults(),
    activeSkills: [],
    activeWorkflows: [],
    activeTools: [],
  });
  // Start true to avoid SSR/CSR mismatch; set correctly after mount
  const [hasValidToken, setHasValidToken] = useState(true);
  const [appDefaultConfigLoaded, setAppDefaultConfigLoaded] = useState(false);

  const [state, dispatch] = useReducer(reducer, {
    messages: [],
    currentPlan: null,
    isStreaming: false,
    activeTab: props.defaultTab || 'chat',
    config: { maxPlanSteps: 5, maxChainDepth: 5, activeSkills: [], theme: 'light', triggers: [], systemPrompt: '', executorPrompt: '', activeTools: ['vfs_read', 'vfs_write', 'vfs_list', 'vfs_delete', 'js_sandbox', 'python_sandbox', 'http_request'], activeWorkflows: ['greeting', 'code-review-and-fix', 'explain-and-improve'], customSkills: [], customWorkflows: [], customTools: [], contextProviders: [], serviceEndpoints: [], customAllowedDomains: [], toolConfigs: {}, ...props.initialConfig },
    serverConfig: null,
    logs: [],
  });

  // Keep messages ref in sync for conversation state tracking
  useEffect(() => {
    messagesRef.current = state.messages;
  }, [state.messages]);

  // Load config from Supabase (hierarchy: user → app default → code defaults)
  useEffect(() => {
    // Check URL for restore session id
    const restoreId = getUrlParam('restore_session');
    if (restoreId) {
      loadSessionFromDb(restoreId).then(session => {
        if (session) {
          sessionIdRef.current = session.session_id;
          const msgs = (session.messages as ChatMessage[]).map(m => ({
            ...m,
            timestamp: new Date(m.timestamp),
          }));
          dispatch({ type: 'CLEAR_MESSAGES' });
          for (const msg of msgs) {
            dispatch({ type: 'ADD_MESSAGE', message: msg });
          }
          if (session.config_snapshot && Object.keys(session.config_snapshot as object).length > 0) {
            dispatch({ type: 'SET_CONFIG', config: session.config_snapshot as WidgetConfig });
          }
        }
      });
    }

    // Resolve app_token / user_token → app + user, then load config
    const loadFromDb = async () => {
      // Check if any token or app identifier is provided
      const hasAnyToken = !!(appTokenRef.current || userTokenRef.current || getUrlParam('app'));
      setHasValidToken(hasAnyToken);
      if (!hasAnyToken) return;

      // 1. Resolve app_token first (determines which app)
      if (appTokenRef.current) {
        try {
          const res = await fetch(`/api/settings?app_token=${encodeURIComponent(appTokenRef.current)}`);
          if (res.ok) {
            const { data } = await res.json();
            if (data?.app) appRef.current = data.app;
          }
        } catch { /* fall through */ }
      }
      // 2. Resolve user_token (determines which user; also sets app if no app_token)
      if (userTokenRef.current) {
        try {
          const res = await fetch(`/api/settings?user_token=${encodeURIComponent(userTokenRef.current)}`);
          if (res.ok) {
            const { data } = await res.json();
            if (!appTokenRef.current && data?.app) appRef.current = data.app;
            if (data?.user) userRef.current = data.user;
          }
        } catch { /* fall through */ }
      }
      // Load app default config (admin-managed baseline)
      const appDefConfig = await loadConfigAsync(appRef.current, 'default');
      setAppDefaultConfig(appDefConfig);
      setAppDefaultConfigLoaded(true);

      const dbConfig = await loadConfigAsync(appRef.current, userRef.current);
      if (props.initialConfig) Object.assign(dbConfig, props.initialConfig);
      dispatch({ type: 'SET_CONFIG', config: dbConfig });

      // Re-initialize context registry with DB config (may have different providers/endpoints)
      const contextRegistry = getContextProviderRegistry();
      await contextRegistry.initialize(
        dbConfig.contextProviders || [],
        dbConfig.serviceEndpoints || [],
        { captureUrlParams: true }
      );

      // Update controller config with DB values
      if (controllerRef.current) {
        const ctrl = controllerRef.current as unknown as Record<string, unknown>;
        const cfg = ctrl.config as Record<string, unknown> | undefined;
        if (cfg) {
          cfg.activeTools = dbConfig.activeTools;
          cfg.systemPrompt = dbConfig.systemPrompt || '';
          cfg.executorPrompt = dbConfig.executorPrompt || '';
        }
        // Update getRuntimeContext to use fresh context
        cfg!.getRuntimeContext = () => ({
          ...contextRegistry.getResolvedContext(),
          __tool_configs: dbConfig.toolConfigs || {},
        });
      }
    };
    loadFromDb();
  }, []);

  // Initialize logger and controller
  useEffect(() => {
    const logger = new AgentLogger();
    loggerRef.current = logger;

    const registry = getSkillRegistry();
    const workflowRegistry = getWorkflowRegistry();

    // Sync active states from persisted config to registries
    const stored = getCodeDefaults();
    if (stored.activeSkills) {
      const allDefs = registry.getAllSkillDefinitions();
      for (const def of allDefs) {
        registry.setSkillActive(def.meta.skill_id, stored.activeSkills.includes(def.meta.skill_id));
      }
    }
    if (stored.activeWorkflows) {
      const allWfs = workflowRegistry.getAllDefinitions();
      for (const wf of allWfs) {
        workflowRegistry.setActive(wf.name, stored.activeWorkflows.includes(wf.name));
      }
    }

    // Sync custom skills from persisted config
    if (stored.customSkills) {
      for (const cs of stored.customSkills) {
        registry.registerSkill(cs.skill_id, {
          meta: {
            skill_id: cs.skill_id,
            description: cs.description,
            tools: cs.tools,
            requires: cs.requires,
            budget: { context_tokens: cs.budget_context_tokens, history_turns: cs.budget_history_turns },
            signals_schema: {},
          },
          prompt: cs.prompt,
        });
      }
    }
    // Sync custom workflows from persisted config
    if (stored.customWorkflows) {
      for (const cw of stored.customWorkflows) {
        workflowRegistry.register({
          name: cw.name,
          description: cw.description,
          trigger_patterns: cw.trigger_patterns,
          steps: [],
          steps_natural: cw.steps_natural,
          completion_message: cw.completion_message,
        });
      }
    }
    // Sync custom tools from persisted config
    if (stored.customTools) {
      for (const ct of stored.customTools) {
        registerCustomTool(ct.id, ct.description, ct.parameters);
      }
    }

    // Initialize context provider registry (resolve static data, url params, etc.)
    const contextRegistry = getContextProviderRegistry();
    contextRegistry.initialize(
      stored.contextProviders || [],
      stored.serviceEndpoints || [],
      { userToken: props.userToken, captureUrlParams: props.captureUrlParams ?? true, initialContext: props.initialContext }
    );
    // Add custom allowed domains
    if (stored.customAllowedDomains) {
      for (const domain of stored.customAllowedDomains) {
        addAllowedDomain(domain);
      }
    }
    // Add service endpoint domains to allowlist
    if (stored.serviceEndpoints) {
      for (const ep of stored.serviceEndpoints) {
        try {
          const url = new URL(ep.baseUrl.replace(/\{\{.*?\}\}/g, 'placeholder'));
          addAllowedDomain(url.hostname);
        } catch { /* ignore invalid URLs */ }
      }
    }

    const controller = new AgentController({
      apiEndpoint: props.apiEndpoint || '/api',
      logger,
      getSkillMetas: () => registry.getAllSkillMetas(),
      getSkillPrompt: (id) => registry.getSkillPrompt(id),
      getWorkflows: () => workflowRegistry.getAll(),
      maxPlanSteps: state.config.maxPlanSteps,
      maxChainDepth: state.config.maxChainDepth,
      systemPrompt: stored.systemPrompt || '',
      executorPrompt: stored.executorPrompt || '',
      activeTools: stored.activeTools,
      getRuntimeContext: () => ({
        ...contextRegistry.getResolvedContext(),
        __tool_configs: stored.toolConfigs || {},
      }),
    });
    controllerRef.current = controller;

    // Subscribe to log events
    const unsubLog = logger.subscribe((entry) => {
      dispatch({ type: 'ADD_LOG', log: entry });
    });

    // Fetch server config
    fetch(`${props.apiEndpoint || '/api'}/config`)
      .then(res => res.json())
      .then(data => dispatch({ type: 'SET_SERVER_CONFIG', serverConfig: data }))
      .catch(err => console.warn('[Widget] Failed to fetch server config:', err));

    return () => {
      unsubLog();
    };
  }, [props.apiEndpoint]);

  // Core pipeline: runs orchestrator → executor flow for any trigger
  const runPipeline = useCallback(async (trigger: Trigger, hookLabel?: string) => {
    if (!controllerRef.current || state.isStreaming) return;

    dispatch({ type: 'SET_STREAMING', streaming: true });

    // Add hook message if label provided (e.g. "site_enter")
    if (hookLabel) {
      dispatch({
        type: 'ADD_MESSAGE',
        message: {
          id: `msg_${Date.now()}_hook`,
          role: 'assistant',
          content: hookLabel,
          messageType: 'hook',
          timestamp: new Date(),
        },
      });
    }

    // Add orchestrator message (thinking)
    const orchId = `msg_${Date.now()}_orch`;
    dispatch({
      type: 'ADD_MESSAGE',
      message: {
        id: orchId,
        role: 'assistant',
        content: '',
        messageType: 'orchestrator',
        thinking: 'Thinking...',
        timestamp: new Date(),
        isStreaming: true,
      },
    });

    try {
      let buttons: string[] | undefined;
      let signals: ExecutionSignals | undefined;
      let executionId = '';
      let skillSelected = '';
      let executionAdded = false;

      let orchThinking = '';
      let pipelineWorkflowId = '';
      let pipelineSkillId = '';
      let pipelineAction = '';

      // Track tool call steps for building step display
      const toolSteps: ToolStepState[] = [];

      // Build conversation state from previous turns
      const convState = conversationStateRef.current || undefined;

      for await (const event of controllerRef.current.handleTrigger(trigger, convState)) {
        switch (event.type) {
          case 'thinking': {
            orchThinking = event.data as string;
            dispatch({
              type: 'UPDATE_MESSAGE',
              id: orchId,
              updates: {
                thinking: undefined,
                content: orchThinking,
                isStreaming: false,
              },
            });
            break;
          }

          case 'plan_update': {
            const plan = event.data as Plan;
            dispatch({ type: 'SET_PLAN', plan });

            const firstStep = plan.steps.find(s => s.status === 'pending' || s.status === 'in_progress');
            if (!executionAdded) {
              skillSelected = firstStep?.skill_id || '';
            }
            // Track workflow/skill for conversation state
            if (firstStep?.skill_id) pipelineSkillId = firstStep.skill_id;

            if (!executionAdded) {
              executionId = `msg_${Date.now()}_exec`;
              dispatch({
                type: 'ADD_MESSAGE',
                message: {
                  id: executionId,
                  role: 'assistant',
                  content: '',
                  messageType: 'execution',
                  skillId: skillSelected,
                  buildingSteps: getInitialBuildingSteps(skillSelected),
                  timestamp: new Date(),
                  isStreaming: true,
                },
              });
              executionAdded = true;
            }
            break;
          }

          case 'tool_call': {
            const tcData = event.data as { id: string; name: string; args: string };
            toolSteps.push({ id: tcData.id, label: getToolLabel(tcData.name), done: false });
            if (executionId) {
              dispatch({
                type: 'UPDATE_MESSAGE',
                id: executionId,
                updates: {
                  buildingSteps: buildStepsFromToolState(toolSteps, 'tools'),
                },
              });
            }
            break;
          }

          case 'tool_result': {
            const trData = event.data as { id: string; name: string; result: unknown };
            const step = toolSteps.find(s => s.id === trData.id);
            if (step) {
              step.done = true;
              const res = trData.result as Record<string, unknown> | null;
              step.ok = res?.ok !== false;
            }
            if (executionId) {
              dispatch({
                type: 'UPDATE_MESSAGE',
                id: executionId,
                updates: {
                  buildingSteps: buildStepsFromToolState(toolSteps, 'tools'),
                },
              });
            }
            break;
          }

          case 'step_start': {
            const stepData = event.data as { skill_id: string; step_index: number };

            // For steps after the first, finalize current execution bubble and create a new one
            if (executionAdded && stepData.step_index > 0) {
              // Finish the previous execution message
              if (executionId) {
                dispatch({ type: 'FINISH_STREAMING', targetId: executionId, buttons, signals });
                buttons = undefined;
                signals = undefined;
              }
              // Reset tool steps for the new step
              toolSteps.length = 0;
              // Create a new execution message bubble for this step
              executionId = `msg_${Date.now()}_exec_step${stepData.step_index}`;
              skillSelected = stepData.skill_id;
              dispatch({
                type: 'ADD_MESSAGE',
                message: {
                  id: executionId,
                  role: 'assistant',
                  content: '',
                  messageType: 'execution',
                  skillId: skillSelected,
                  buildingSteps: getInitialBuildingSteps(skillSelected),
                  timestamp: new Date(),
                  isStreaming: true,
                },
              });
              dispatch({ type: 'SET_STREAMING', streaming: true });
            }
            break;
          }

          case 'content': {
            const chunk = event.data as string;
            if (!executionAdded) {
              dispatch({
                type: 'UPDATE_MESSAGE',
                id: orchId,
                updates: { thinking: undefined, content: orchThinking || '...', isStreaming: false },
              });
              executionId = `msg_${Date.now()}_exec`;
              dispatch({
                type: 'ADD_MESSAGE',
                message: {
                  id: executionId,
                  role: 'assistant',
                  content: '',
                  messageType: 'execution',
                  buildingSteps: getInitialBuildingSteps(),
                  timestamp: new Date(),
                  isStreaming: true,
                },
              });
              executionAdded = true;
            }

            dispatch({
              type: 'UPDATE_MESSAGE',
              id: executionId,
              updates: {
                buildingSteps: toolSteps.length > 0
                  ? buildStepsFromToolState(toolSteps, 'writing')
                  : [
                      { step: 'Preparing', status: 'done' },
                      { step: 'Write response', status: 'running' },
                    ],
              },
            });

            dispatch({ type: 'UPDATE_LAST_EXECUTION_MESSAGE', content: chunk });
            break;
          }

          case 'buttons':
            buttons = event.data as string[];
            break;

          case 'signals':
            signals = event.data as ExecutionSignals;
            break;

          case 'error':
            if (executionId) {
              dispatch({
                type: 'UPDATE_MESSAGE',
                id: executionId,
                updates: { content: `Error: ${(event.data as { message: string }).message}` },
              });
            }
            break;

          case 'done': {
            const doneData = event.data as { action?: string; plan?: Plan } | undefined;
            pipelineAction = doneData?.action || 'stop';
            break;
          }
        }
      }

      if (executionId) {
        dispatch({ type: 'FINISH_STREAMING', targetId: executionId, buttons, signals });
      } else {
        dispatch({ type: 'SET_STREAMING', streaming: false });
      }

      dispatch({
        type: 'UPDATE_MESSAGE',
        id: orchId,
        updates: { isStreaming: false },
      });

      // Update conversation state for next turn
      const recentMsgs = messagesRef.current.slice(-6);
      const summary = recentMsgs
        .filter(m => m.messageType === 'execution' || m.role === 'user')
        .map(m => `${m.role === 'user' ? '사용자' : '어시스턴트'}: ${m.content.slice(0, 150)}`)
        .join('\n');
      const turnCount = messagesRef.current.filter(m => m.role === 'user').length;

      conversationStateRef.current = {
        summary,
        turn_count: turnCount,
        open_questions: buttons || [],
        last_workflow_id: pipelineWorkflowId || pipelineSkillId,
        last_skill_id: pipelineSkillId,
      };

      // Auto-save session to Supabase
      saveSessionToDb({
        session_id: sessionIdRef.current,
        app: appRef.current,
        user: userRef.current,
        messages: messagesRef.current,
        config_snapshot: state.config,
        logs: state.logs.slice(-200),
        turn_count: turnCount,
      }).catch(() => { /* silent fail */ });
    } catch (error) {
      dispatch({ type: 'SET_STREAMING', streaming: false });
      dispatch({
        type: 'UPDATE_MESSAGE',
        id: orchId,
        updates: { thinking: undefined, content: 'An error occurred', isStreaming: false },
      });
      console.error('[Widget] Pipeline error:', error);
    }
  }, [state.isStreaming]);

  const sendMessage = useCallback(async (text: string) => {
    // Add user message first
    dispatch({
      type: 'ADD_MESSAGE',
      message: {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: text,
        messageType: 'user',
        timestamp: new Date(),
      },
    });

    const trigger: Trigger = {
      type: 'user_message',
      source: 'chat_input',
      payload: { message: text },
      timestamp: Date.now(),
      session_id: `session_${Date.now()}`,
    };

    await runPipeline(trigger);
    props.onEvent?.({ type: 'message_sent', data: { text } });
  }, [runPipeline, props]);

  // Fire site_enter trigger on mount if enabled
  const siteEnterFiredRef = useRef(false);
  useEffect(() => {
    if (siteEnterFiredRef.current) return;
    if (!controllerRef.current) return;
    if (!state.config.triggers || state.config.triggers.length === 0) return;

    const siteEnterTrigger = state.config.triggers.find(t => t.id === 'site_enter');
    if (!siteEnterTrigger?.enabled) return;

    siteEnterFiredRef.current = true;

    // Context providers already initialized in main useEffect; fire site_enter trigger
    const ctxReg = getContextProviderRegistry();
    const trigger: Trigger = {
      type: 'system_event',
      source: 'site_enter',
      payload: {
        event_kind: 'site_enter',
        data: ctxReg.getResolvedContext(),
      },
      timestamp: Date.now(),
      session_id: `session_${Date.now()}`,
    };
    const hookLabel = siteEnterTrigger.label || siteEnterTrigger.id;
    setTimeout(() => {
      runPipeline(trigger, hookLabel);
    }, 300);
  }, [state.config.triggers, runPipeline]);

  // Supabase Realtime: subscribe to webhook_messages inserts for this session
  const webhookQueueRef = useRef<Array<{ message_id: string; message: string; context: Record<string, unknown> }>>([]);
  const processingWebhookRef = useRef(false);

  const processWebhookQueue = useCallback(async () => {
    if (processingWebhookRef.current || webhookQueueRef.current.length === 0) return;
    if (state.isStreaming || !controllerRef.current) return;

    processingWebhookRef.current = true;
    const whMsg = webhookQueueRef.current.shift()!;

    // Add user message to chat
    dispatch({
      type: 'ADD_MESSAGE',
      message: {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: whMsg.message,
        messageType: 'user',
        timestamp: new Date(),
      },
    });

    // Build trigger with context
    const trigger: Trigger = {
      type: 'webhook',
      source: 'webhook_message',
      payload: {
        message: whMsg.message,
        event_kind: 'webhook_message',
        data: whMsg.context || {},
      },
      timestamp: Date.now(),
      session_id: sessionIdRef.current,
    };

    const contextSummary = whMsg.context
      ? Object.entries(whMsg.context)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
          .join(', ')
      : '';
    const hookLabel = contextSummary
      ? `웹훅 수신 — ${contextSummary.slice(0, 100)}`
      : '웹훅 수신';

    try {
      await runPipeline(trigger, hookLabel);
    } finally {
      processingWebhookRef.current = false;
      // Process next queued message if any
      if (webhookQueueRef.current.length > 0) {
        processWebhookQueue();
      }
    }
  }, [state.isStreaming, runPipeline]);

  useEffect(() => {
    const webhookTriggerConfig = state.config.triggers?.find(t => t.id === 'webhook');
    if (!webhookTriggerConfig?.enabled) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channelName = `webhook_messages_${sessionIdRef.current}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webhook_messages',
          filter: `session_id=eq.${sessionIdRef.current}`,
        },
        (payload) => {
          const row = payload.new as {
            message_id: string;
            message: string;
            context: Record<string, unknown>;
            status: string;
          };
          if (row.status !== 'pending') return;

          // Mark as consumed immediately
          supabase
            .from('webhook_messages')
            .update({ status: 'consumed', consumed_at: new Date().toISOString() })
            .eq('message_id', row.message_id)
            .then(() => { /* silent */ });

          // Queue and process
          webhookQueueRef.current.push({
            message_id: row.message_id,
            message: row.message,
            context: row.context,
          });
          processWebhookQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [state.config.triggers, processWebhookQueue]);

  const setActiveTab = useCallback((tab: 'chat' | 'settings' | 'logs') => {
    dispatch({ type: 'SET_TAB', tab });
  }, []);

  const updateConfig = useCallback((updates: Partial<WidgetConfig>) => {
    const newConfig = { ...state.config, ...updates };
    dispatch({ type: 'SET_CONFIG', config: newConfig });
    saveConfigAsync(newConfig, appRef.current, userRef.current).catch(() => { /* silent */ });

    // Sync skill registry activeSkills
    if (updates.activeSkills) {
      const registry = getSkillRegistry();
      const allDefs = registry.getAllSkillDefinitions();
      for (const def of allDefs) {
        registry.setSkillActive(def.meta.skill_id, newConfig.activeSkills.includes(def.meta.skill_id));
      }
    }

    // Sync workflow registry activeWorkflows
    if (updates.activeWorkflows) {
      const wfRegistry = getWorkflowRegistry();
      const allWfs = wfRegistry.getAllDefinitions();
      for (const wf of allWfs) {
        wfRegistry.setActive(wf.name, newConfig.activeWorkflows.includes(wf.name));
      }
    }

    // Sync controller prompts/activeTools if they changed
    if (controllerRef.current) {
      const ctrl = controllerRef.current as unknown as Record<string, unknown>;
      const cfg = ctrl.config as Record<string, unknown> | undefined;
      if (cfg) {
        if (updates.systemPrompt !== undefined) cfg.systemPrompt = updates.systemPrompt;
        if (updates.executorPrompt !== undefined) cfg.executorPrompt = updates.executorPrompt;
        if (updates.activeTools !== undefined) cfg.activeTools = updates.activeTools;
      }
    }
  }, [state.config]);

  const clearLogs = useCallback(() => {
    dispatch({ type: 'CLEAR_LOGS' });
    loggerRef.current?.clear();
  }, []);

  const clearMessages = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' });
  }, []);

  const restoreSession = useCallback(async (targetSessionId: string) => {
    const session = await loadSessionFromDb(targetSessionId);
    if (!session) return;
    sessionIdRef.current = session.session_id;
    const msgs = (session.messages as ChatMessage[]).map(m => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
    dispatch({ type: 'CLEAR_MESSAGES' });
    for (const msg of msgs) {
      dispatch({ type: 'ADD_MESSAGE', message: msg });
    }
    if (session.config_snapshot && Object.keys(session.config_snapshot as object).length > 0) {
      const restored = session.config_snapshot as WidgetConfig;
      dispatch({ type: 'SET_CONFIG', config: restored });
    }
  }, []);

  const contextValue: WidgetContextValue = {
    ...state,
    appDefaultConfig,
    appDefaultConfigLoaded,
    sessionId: sessionIdRef.current,
    hasValidToken,
    sendMessage,
    setActiveTab,
    updateConfig,
    clearLogs,
    clearMessages,
    restoreSession,
  };

  return (
    <WidgetContext.Provider value={contextValue}>
      {children}
    </WidgetContext.Provider>
  );
}

export function useWidget(): WidgetContextValue {
  const ctx = useContext(WidgetContext);
  if (!ctx) throw new Error('useWidget must be used within WidgetProvider');
  return ctx;
}
