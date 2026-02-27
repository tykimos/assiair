import type { OrchestratorOutput } from '@/types';
import { LIMITS } from '../../config/limits';
import { getOpenAIClient, getOrchModel } from '@/lib/openai-client';

export async function orchestrate(
  systemPrompt: string,
  triggerInfo: string,
  conversationState?: string
): Promise<OrchestratorOutput> {
  const model = getOrchModel();

  const userContent = conversationState
    ? `[Trigger]\n${triggerInfo}\n\n[Conversation State]\n${conversationState}`
    : `[Trigger]\n${triggerInfo}`;

  const startTime = Date.now();

  let lastError: Error | null = null;

  // 1 retry on JSON parse failure
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const openai = getOpenAIClient();
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_completion_tokens: LIMITS.ORCH_MAX_TOKENS,
        response_format: { type: 'json_object' },
      });

      const latencyMs = Date.now() - startTime;

      // Log latency warning
      if (latencyMs > LIMITS.ORCH_LATENCY_TARGET_MS) {
        console.warn(`[ORCH] Latency ${latencyMs}ms exceeds target ${LIMITS.ORCH_LATENCY_TARGET_MS}ms`);
      }

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from Orchestrator LLM');
      }

      const parsed = JSON.parse(content) as OrchestratorOutput;

      // Validate plan structure
      if (!parsed.plan || !Array.isArray(parsed.plan.steps)) {
        throw new Error('Invalid Plan structure: missing plan.steps array');
      }

      // Enforce max steps
      if (parsed.plan.steps.length > LIMITS.MAX_PLAN_STEPS) {
        parsed.plan.steps = parsed.plan.steps.slice(0, LIMITS.MAX_PLAN_STEPS);
      }

      // Ensure all statuses are pending
      parsed.plan.steps = parsed.plan.steps.map((step, i) => ({
        ...step,
        step_index: i,
        status: 'pending' as const,
      }));

      // Initialize context if missing
      if (!parsed.plan.context) {
        parsed.plan.context = {};
      }

      // Ensure thinking has a fallback
      if (!parsed.thinking) {
        parsed.thinking = '';
      }

      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === 0) {
        console.warn(`[ORCH] Attempt ${attempt + 1} failed, retrying...`, lastError.message);
      }
    }
  }

  throw lastError || new Error('Orchestrator failed after retries');
}
