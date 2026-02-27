export interface WorkflowStep {
  skill_id: string;
  description: string;
  required: boolean;
  condition?: string;
  inputs?: string[];
  outputs?: string[];
}

export interface WorkflowDefinition {
  name: string;
  description: string;
  trigger_patterns: string[];
  steps: WorkflowStep[];
  /** Natural-language description of the step flow — interpreted by LLM */
  steps_natural?: string;
  completion_message?: string;
  max_chain_depth?: number; // default 5
}
