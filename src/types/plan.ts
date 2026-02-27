export interface PlanStep {
  step_index: number;
  skill_id: string;
  description: string;
  inputs: Record<string, unknown>;
  condition: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

export interface Plan {
  goal: string;
  steps: PlanStep[];
  context: Record<string, unknown>;
}

export interface OrchestratorOutput {
  workflow_id: string | null;
  plan: Plan;
  reason: string;
  thinking: string;
}
