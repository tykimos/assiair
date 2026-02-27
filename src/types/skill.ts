export interface ContextModule {
  id: string;
  description: string;
  max_tokens: number;
}

export interface SkillMeta {
  skill_id: string;
  description: string;
  tools: string[];
  requires: string[];
  budget: {
    context_tokens: number;
    history_turns: number;
  };
  signals_schema: Record<string, {
    type: string;
    values?: string[];
    required: boolean;
  }>;
}

// NOTE: Skills do NOT have trigger_patterns.
// Intent matching is done at the Workflow level only.

export interface SkillDefinition {
  meta: SkillMeta;
  prompt: string;
}

export interface ExecutionSignals {
  coverage: 'enough' | 'partial' | 'none';
  confidence: 'high' | 'medium' | 'low';
  next_action_hint: 'stop' | 'reroute';
  suggested_skill_id?: string;
  // intent_clarify specific
  intent_clarified?: boolean;
  clarified_intent?: string;
  [key: string]: unknown;
}

export interface PostOrchOutput {
  current_step_completed: boolean;
  step_result: Record<string, unknown>;
  action: 'continue' | 'stop' | 'ask_user';
  reason: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}
