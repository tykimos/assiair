import type { Trigger, Plan, PlanStep, SkillMeta } from '@/types';
import { LIMITS } from '../../config/limits';

export function estimateTokens(text: string): number {
  // Korean-aware estimation: ~1.5 chars per token for Korean, ~4 chars for English
  const koreanChars = (text.match(/[\u3131-\u318E\uAC00-\uD7A3]/g) || []).length;
  const otherChars = text.length - koreanChars;
  return Math.ceil(koreanChars / 1.5 + otherChars / 4);
}

export function truncateToTokenBudget(text: string, maxTokens: number): string {
  const estimated = estimateTokens(text);
  if (estimated <= maxTokens) return text;
  // Approximate character limit
  const ratio = maxTokens / estimated;
  const charLimit = Math.floor(text.length * ratio);
  return text.slice(0, charLimit) + '\n... (truncated)';
}

export function buildContextPack(params: {
  trigger: Trigger;
  plan: Plan;
  currentStep: PlanStep;
  userMessage: string;
  skill: SkillMeta;
  allSkillMetas?: SkillMeta[];
  contextModules?: Record<string, unknown>;
  conversationState?: {
    summary: string;
    turn_count: number;
    open_questions: string[];
    last_workflow_id?: string;
    last_skill_id?: string;
  };
}): string {
  const { trigger, plan, currentStep, userMessage, skill, allSkillMetas, contextModules, conversationState } = params;

  // Build previous results from completed steps
  const previousResults: Record<string, unknown> = {};
  for (const step of plan.steps) {
    if (step.status === 'completed' && plan.context[`step_${step.step_index}_result`]) {
      previousResults[step.skill_id] = plan.context[`step_${step.step_index}_result`];
    }
  }

  const sections: string[] = [
    '[CONTEXT_PACK v2]',
    '',
    '[Trigger] (required)',
    `- type: ${trigger.type}`,
    `- source: ${trigger.source}`,
    `- message: "${trigger.payload.message || ''}"`,
    `- timestamp: ${trigger.timestamp}`,
    ...(trigger.payload.data && Object.keys(trigger.payload.data).length > 0
      ? [`- data: ${truncateToTokenBudget(JSON.stringify(trigger.payload.data), 1000)}`]
      : []),
    '',
    '[Plan] (required)',
    `- goal: "${plan.goal}"`,
    `- current_step: { index: ${currentStep.step_index}, skill_id: "${currentStep.skill_id}" }`,
    `- total_steps: ${plan.steps.length}`,
    `- previous_results: ${JSON.stringify(previousResults)}`,
    '',
    '[User Input] (required)',
    `- user_text: "${userMessage}"`,
  ];

  if (conversationState) {
    sections.push(
      '',
      '[Conversation State]',
      `- short_summary: "${conversationState.summary}"`,
      `- open_questions: ${JSON.stringify(conversationState.open_questions)}`,
      `- turn_count: ${conversationState.turn_count}`,
      `- last_workflow_id: "${conversationState.last_workflow_id || ''}"`,
      `- last_skill_id: "${conversationState.last_skill_id || ''}"`,
    );
  }

  // Load context modules per skill's requires
  if (contextModules && skill.requires.length > 0) {
    const moduleEntries: string[] = [];
    for (const moduleId of skill.requires) {
      if (contextModules[moduleId] !== undefined) {
        const moduleData = JSON.stringify(contextModules[moduleId]);
        const module = skill.requires.find(r => r === moduleId);
        if (module) {
          moduleEntries.push(`- ${moduleId}: ${truncateToTokenBudget(moduleData, skill.budget.context_tokens / skill.requires.length)}`);
        }
      }
    }
    if (moduleEntries.length > 0) {
      sections.push('', '[Context Modules]', ...moduleEntries);
    }
  }

  // Inject runtime context (independent of skill.requires)
  if (contextModules) {
    const runtimeKeys = Object.keys(contextModules).filter(k => !skill.requires.includes(k));
    if (runtimeKeys.length > 0) {
      sections.push('', '[Runtime Context]');
      for (const key of runtimeKeys) {
        const value = JSON.stringify(contextModules[key]);
        sections.push(`- ${key}: ${truncateToTokenBudget(value, 500)}`);
      }
    }
  }

  // Available skills (so skills like greeting can reference active capabilities)
  if (allSkillMetas && allSkillMetas.length > 0) {
    const otherSkills = allSkillMetas.filter(s => s.skill_id !== currentStep.skill_id);
    if (otherSkills.length > 0) {
      sections.push('', '[Available Skills]');
      for (const s of otherSkills) {
        sections.push(`- ${s.skill_id}: ${s.description}`);
      }
    }
  }

  sections.push(
    '',
    '[Constraints]',
    `- budget: { context_tokens: ${skill.budget.context_tokens} }`,
    `- max_tool_calls: ${LIMITS.MAX_TOOL_CALLS_PER_STEP}`,
    `- policies: ["CONTEXT_PACK 밖 추측 금지"]`,
    '',
    '[/CONTEXT_PACK]',
  );

  const result = sections.join('\n');

  // Ensure total doesn't exceed budget
  return truncateToTokenBudget(result, LIMITS.CONTEXT_PACK_MAX_TOKENS);
}
