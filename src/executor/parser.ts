import type { ExecutionSignals, PostOrchOutput } from '@/types';

const SIGNALS_REGEX = /<signals>\s*([\s\S]*?)\s*<\/signals>/;
const BUTTONS_REGEX = /<prompt_buttons>\s*([\s\S]*?)\s*<\/prompt_buttons>/;
const POST_ORCH_REGEX = /<post_orch>\s*([\s\S]*?)\s*<\/post_orch>/;

const DEFAULT_SIGNALS: ExecutionSignals = {
  coverage: 'enough',
  confidence: 'medium',
  next_action_hint: 'stop',
};

const DEFAULT_POST_ORCH: PostOrchOutput = {
  current_step_completed: false,
  step_result: {},
  action: 'stop',
  reason: 'No post_orch tag found',
};

export function parseSignals(response: string): ExecutionSignals {
  const match = response.match(SIGNALS_REGEX);
  if (!match) return { ...DEFAULT_SIGNALS };
  try {
    const parsed = JSON.parse(match[1]);
    return { ...DEFAULT_SIGNALS, ...parsed };
  } catch {
    return { ...DEFAULT_SIGNALS };
  }
}

export function parsePromptButtons(response: string): string[] | undefined {
  const match = response.match(BUTTONS_REGEX);
  if (!match) return undefined;
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed) && parsed.every(b => typeof b === 'string')) {
      return parsed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function parsePostOrch(response: string): PostOrchOutput {
  const match = response.match(POST_ORCH_REGEX);
  if (!match) return { ...DEFAULT_POST_ORCH };
  try {
    const parsed = JSON.parse(match[1]);
    return {
      current_step_completed: parsed.current_step_completed ?? false,
      step_result: parsed.step_result ?? {},
      action: parsed.action ?? 'stop',
      reason: parsed.reason ?? '',
    };
  } catch {
    return { ...DEFAULT_POST_ORCH };
  }
}

export function cleanContent(response: string): string {
  return response
    .replace(SIGNALS_REGEX, '')
    .replace(BUTTONS_REGEX, '')
    .replace(POST_ORCH_REGEX, '')
    .trim();
}

export function parseExecutorResponse(response: string): {
  content: string;
  signals: ExecutionSignals;
  promptButtons?: string[];
  postOrch: PostOrchOutput;
} {
  return {
    content: cleanContent(response),
    signals: parseSignals(response),
    promptButtons: parsePromptButtons(response),
    postOrch: parsePostOrch(response),
  };
}
