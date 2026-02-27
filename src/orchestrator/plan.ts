import type { Plan, PlanStep } from '@/types';

export function getNextPendingStep(plan: Plan): PlanStep | undefined {
  return plan.steps.find(s => s.status === 'pending');
}

export function getCurrentStep(plan: Plan): PlanStep | undefined {
  return plan.steps.find(s => s.status === 'in_progress');
}

export function markStepInProgress(plan: Plan, stepIndex: number): Plan {
  return {
    ...plan,
    steps: plan.steps.map(s =>
      s.step_index === stepIndex ? { ...s, status: 'in_progress' as const } : s
    ),
  };
}

export function markStepCompleted(plan: Plan, stepIndex: number, result?: Record<string, unknown>): Plan {
  const newContext = result
    ? { ...plan.context, [`step_${stepIndex}_result`]: result, ...result }
    : plan.context;
  return {
    ...plan,
    steps: plan.steps.map(s =>
      s.step_index === stepIndex ? { ...s, status: 'completed' as const } : s
    ),
    context: newContext,
  };
}

export function markStepSkipped(plan: Plan, stepIndex: number): Plan {
  return {
    ...plan,
    steps: plan.steps.map(s =>
      s.step_index === stepIndex ? { ...s, status: 'skipped' as const } : s
    ),
  };
}

export function updatePlanContext(plan: Plan, updates: Record<string, unknown>): Plan {
  return { ...plan, context: { ...plan.context, ...updates } };
}

export function isPlanComplete(plan: Plan): boolean {
  return plan.steps.every(s => s.status === 'completed' || s.status === 'skipped');
}
