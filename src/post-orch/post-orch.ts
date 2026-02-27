import type { PostOrchOutput, ExecutionSignals, Plan } from '@/types';
import { LIMITS } from '../../config/limits';

export interface PostOrchDecision {
  action: 'continue' | 'stop' | 'ask_user' | 'skip_and_continue';
  next_skill_id?: string;
  reason: string;
  /** Index of the step that should be marked completed by the caller */
  completedStepIndex?: number;
  /** Index of the step that should be marked skipped by the caller */
  skippedStepIndex?: number;
  /** Result to merge into plan context when marking a step completed */
  stepResult?: Record<string, unknown>;
}

export function evaluateCondition(
  condition: string,
  context: Record<string, unknown>
): boolean {
  try {
    // Handle simple expressions like "issues_found > 0", "fix_result != null"
    const parts = condition.trim().split(/\s+/);

    // If not a valid "key operator value" expression (3 parts),
    // default to true — natural language conditions should not block execution
    if (parts.length !== 3) return true;

    const [key, operator, rawValue] = parts;

    // Verify this looks like a structured expression (operator must be valid)
    const validOps = ['>', '<', '>=', '<=', '==', '!='];
    if (!validOps.includes(operator)) return true;

    const actualValue = context[key];

    // Parse the comparison value
    let compareValue: unknown;
    if (rawValue === 'null') compareValue = null;
    else if (rawValue === 'true') compareValue = true;
    else if (rawValue === 'false') compareValue = false;
    else if (!isNaN(Number(rawValue))) compareValue = Number(rawValue);
    else compareValue = rawValue;

    // Normalize string booleans for comparison (signals emit "true"/"false" as strings)
    const normalize = (v: unknown): unknown => {
      if (v === 'true') return true;
      if (v === 'false') return false;
      return v;
    };

    // If the key doesn't exist in context, treat it as null for comparison.
    // This allows conditions like "token != null" to correctly skip a step
    // when the prerequisite data is not present.
    if (actualValue === undefined) {
      const normCompare = normalize(compareValue);
      switch (operator) {
        case '==': return normCompare == null;
        case '!=': return normCompare != null;
        default: return false;
      }
    }
    const normActual = normalize(actualValue);
    const normCompare = normalize(compareValue);

    switch (operator) {
      case '>': return Number(normActual) > Number(normCompare);
      case '<': return Number(normActual) < Number(normCompare);
      case '>=': return Number(normActual) >= Number(normCompare);
      case '<=': return Number(normActual) <= Number(normCompare);
      case '==': return normActual == normCompare;
      case '!=': return normActual != normCompare;
      default: return true;
    }
  } catch {
    return true;
  }
}

export function postOrchestrate(
  postOrchOutput: PostOrchOutput,
  signals: ExecutionSignals,
  plan: Plan,
  chainDepth: number,
  runtimeContext?: Record<string, unknown>
): PostOrchDecision {
  // 1. Chain depth check
  if (chainDepth >= LIMITS.MAX_CHAIN_DEPTH) {
    return { action: 'stop', reason: 'max_chain_depth 도달' };
  }

  // 2. ask_user request — but only if there are no more pending steps in the plan.
  //    If the orchestrator built a multi-step plan, we should continue to the next
  //    step even if the current step suggests ask_user.
  if (postOrchOutput.action === 'ask_user') {
    const hasPendingSteps = plan.steps.some(s => s.status === 'pending');
    if (!hasPendingSteps) {
      return {
        action: 'ask_user',
        reason: postOrchOutput.reason,
      };
    }
    // Fall through to continue with next pending step
  }

  // 3. Determine effective context (with step_result + signals applied) for condition evaluation
  // Runtime context (e.g. URL params) is included so conditions like "token != null" work.
  // Signals are merged so that conditions like "user_found == true" can be evaluated.
  const effectiveContext: Record<string, unknown> = {
    ...(runtimeContext || {}),
    ...plan.context,
    ...signals,
    ...(postOrchOutput.current_step_completed && postOrchOutput.step_result
      ? postOrchOutput.step_result
      : {}),
  };

  // 4. Find index of current in_progress step (for caller to mark completed)
  const currentStepIndex = plan.steps.findIndex(s => s.status === 'in_progress');

  // 5. Find next pending step
  const nextStep = plan.steps.find(s => s.status === 'pending');

  if (!nextStep) {
    return { action: 'stop', reason: '모든 step 완료' };
  }

  // 6. Evaluate condition (use effective context so step_result values are visible)
  console.log(`[POST_ORCH] Next step ${nextStep.step_index} (${nextStep.skill_id}) condition: "${nextStep.condition}", context keys: ${JSON.stringify(Object.keys(effectiveContext))}, user_found=${effectiveContext['user_found']}`);
  if (nextStep.condition) {
    const evalResult = evaluateCondition(nextStep.condition, effectiveContext);
    console.log(`[POST_ORCH] Condition "${nextStep.condition}" evaluated to: ${evalResult}`);
  }
  if (nextStep.condition && !evaluateCondition(nextStep.condition, effectiveContext)) {
    // Return a decision that tells the caller to skip this step, then re-evaluate
    return {
      action: 'skip_and_continue',
      skippedStepIndex: nextStep.step_index,
      completedStepIndex: postOrchOutput.current_step_completed && currentStepIndex >= 0
        ? plan.steps[currentStepIndex].step_index
        : undefined,
      stepResult: postOrchOutput.current_step_completed ? postOrchOutput.step_result : undefined,
      reason: `Step ${nextStep.step_index} 조건 불충족, skip`,
    };
  }

  // 7. Signals-based reroute
  if (signals.next_action_hint === 'reroute' && signals.suggested_skill_id) {
    return {
      action: 'continue',
      next_skill_id: signals.suggested_skill_id,
      reason: `시그널 기반 재라우팅: ${signals.suggested_skill_id}`,
    };
  }

  // 8. Continue with next step
  return {
    action: 'continue',
    next_skill_id: nextStep.skill_id,
    reason: `Plan step ${nextStep.step_index} 실행`,
  };
}
