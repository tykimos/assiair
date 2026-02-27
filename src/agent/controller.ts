import type {
  Trigger,
  Plan,
  PlanStep,
  OrchestratorOutput,
  ExecutionSignals,
  PostOrchOutput,
  SkillMeta,
  WorkflowDefinition,
  StreamChunk,
  TurnTrace,
  ToolDefinition,
} from '@/types';
import { buildOrchestratorPrompt } from '@/orchestrator/orchestrator-prompt';
import { EXECUTOR_BASE_PROMPT, buildExecutorSystemPrompt } from '@/executor/executor-prompt';
import { buildContextPack } from '@/executor/composer';
import { parseExecutorResponse } from '@/executor/parser';
import { postOrchestrate, type PostOrchDecision } from '@/post-orch/post-orch';
import {
  getNextPendingStep,
  markStepInProgress,
  markStepCompleted,
  markStepSkipped,
  isPlanComplete,
} from '@/orchestrator/plan';
import { getToolDefinitions } from '@/tools/index';
import { AgentLogger } from './logger';
import { LIMITS } from '../../config/limits';

export interface StreamEvent {
  type: 'content' | 'plan_update' | 'thinking' | 'buttons' | 'signals' | 'tool_call' | 'tool_result' | 'step_start' | 'done' | 'error';
  data: unknown;
}

export interface AgentControllerConfig {
  apiEndpoint: string;
  bearerToken?: string;
  logger: AgentLogger;
  getSkillMetas: () => SkillMeta[];
  getSkillPrompt: (skillId: string) => string | undefined;
  getWorkflows: () => WorkflowDefinition[];
  maxPlanSteps?: number;
  maxChainDepth?: number;
  systemPrompt?: string;
  executorPrompt?: string;
  activeTools?: string[];
  getRuntimeContext?: () => Record<string, unknown>;
}

export class AgentController {
  private config: AgentControllerConfig;
  private logger: AgentLogger;

  constructor(config: AgentControllerConfig) {
    this.config = config;
    this.logger = config.logger;
  }

  async *handleTrigger(
    trigger: Trigger,
    conversationState?: { summary: string; turn_count: number; open_questions: string[]; last_workflow_id?: string; last_skill_id?: string }
  ): AsyncGenerator<StreamEvent> {
    const turnStart = Date.now();
    let orchLatency = 0;
    let execLatency = 0;
    let execTtft = 0;
    let toolCount = 0;
    let currentSkillId = '';

    try {
      // 1. Build orchestrator prompt (client-side)
      const workflows = this.config.getWorkflows();
      const skillMetas = this.config.getSkillMetas();
      const orchestratorPrompt = buildOrchestratorPrompt(
        workflows, skillMetas,
        this.config.systemPrompt || undefined
      );

      this.logger.orch('Orchestrator call start', { trigger: trigger.type });

      // 2. Call orchestrator API
      const orchStart = Date.now();
      const orchOutput = await this.callOrchestrator(
        orchestratorPrompt,
        JSON.stringify(trigger),
        conversationState ? JSON.stringify(conversationState) : undefined
      );
      orchLatency = Date.now() - orchStart;
      this.logger.warnIfSlow('ORCH', orchLatency);
      this.logger.orch(`Plan created: ${orchOutput.plan.goal}`, {
        workflow_id: orchOutput.workflow_id,
        steps: orchOutput.plan.steps.map(s => s.skill_id),
        latency_ms: orchLatency,
      });
      // Log each step's condition for debugging
      for (const step of orchOutput.plan.steps) {
        this.logger.orch(`Step ${step.step_index}: ${step.skill_id} | condition: ${step.condition ?? '(none)'}`, {});
      }

      // Yield thinking (LLM-generated natural self-talk)
      if (orchOutput.thinking) {
        yield { type: 'thinking', data: orchOutput.thinking };
      }

      // Yield plan update
      yield { type: 'plan_update', data: orchOutput.plan };

      // 3. Execute plan steps
      let plan = orchOutput.plan;
      let chainDepth = 0;

      while (chainDepth < (this.config.maxChainDepth ?? LIMITS.MAX_CHAIN_DEPTH)) {
        const nextStep = getNextPendingStep(plan);
        if (!nextStep) {
          this.logger.post('All steps completed');
          break;
        }

        currentSkillId = nextStep.skill_id;
        plan = markStepInProgress(plan, nextStep.step_index);
        yield { type: 'plan_update', data: plan };

        // Build executor prompt
        const skillPrompt = this.config.getSkillPrompt(nextStep.skill_id);
        if (!skillPrompt) {
          this.logger.exec(`Skill not found: ${nextStep.skill_id}, falling back to greeting`);
          plan = markStepCompleted(plan, nextStep.step_index);
          yield { type: 'plan_update', data: plan };
          continue;
        }

        const basePrompt = this.config.executorPrompt || EXECUTOR_BASE_PROMPT;
        const systemPrompt = buildExecutorSystemPrompt(basePrompt, skillPrompt);

        // Build CONTEXT_PACK
        const skill = skillMetas.find(s => s.skill_id === nextStep.skill_id);
        if (!skill) continue;

        const contextPack = buildContextPack({
          trigger,
          plan,
          currentStep: nextStep,
          userMessage: trigger.payload.message || '',
          skill,
          allSkillMetas: skillMetas,
          contextModules: this.config.getRuntimeContext?.(),
          conversationState,
        });

        // Resolve tool definitions: skill-required tools are always included,
        // plus any additional tools from the global activeTools list
        const activeToolIds = new Set(this.config.activeTools || []);
        const skillToolIds = skill.tools || [];
        // Skill's own tools are always available (not filtered by activeTools)
        const toolDefs = skillToolIds.length > 0 ? getToolDefinitions(skillToolIds) : undefined;

        // Emit step_start so the widget can create a new message bubble per step
        yield { type: 'step_start', data: { skill_id: nextStep.skill_id, step_index: nextStep.step_index } };

        this.logger.exec(`Executor call: ${nextStep.skill_id}`, { step_index: nextStep.step_index, tools: skillToolIds });

        // Call executor API (SSE)
        const execStart = Date.now();
        let accumulatedContent = '';
        let stepToolCount = 0;

        const runtimeCtx = this.config.getRuntimeContext?.();
        for await (const chunk of this.callExecutor(systemPrompt, contextPack, trigger.payload.message || '', toolDefs, runtimeCtx)) {
          if (chunk.type === 'content') {
            if (execTtft === 0) {
              execTtft = Date.now() - execStart;
              this.logger.warnIfSlow('EXEC', execTtft);
            }
            accumulatedContent += chunk.data as string;
            yield chunk;
          } else if (chunk.type === 'tool_call') {
            stepToolCount++;
            toolCount++;
            this.logger.tool(`Tool call: ${(chunk.data as Record<string, unknown>).name}`, chunk.data);
            yield chunk;
          } else if (chunk.type === 'tool_result') {
            this.logger.tool(`Tool result`, chunk.data);
            yield chunk;
          } else if (chunk.type === 'error') {
            this.logger.log('EXEC', 'error', 'Executor error', chunk.data);
            yield chunk;
            break;
          }
        }

        execLatency = Date.now() - execStart;

        // Parse accumulated response (client-side)
        const parsed = parseExecutorResponse(accumulatedContent);

        this.logger.signal(`Signals: ${JSON.stringify(parsed.signals)}`);
        if (parsed.promptButtons) {
          yield { type: 'buttons', data: parsed.promptButtons };
        }
        yield { type: 'signals', data: parsed.signals };

        // Run Post-Orch (client-side) — pass runtimeContext so conditions can reference URL params
        const decision = postOrchestrate(
          parsed.postOrch,
          parsed.signals,
          plan,
          chainDepth,
          runtimeCtx
        );

        this.logger.post(`Post-Orch decision: ${decision.action} | ${decision.reason}`, {
          next_skill_id: decision.next_skill_id,
          skippedStepIndex: decision.skippedStepIndex,
        });

        // Apply plan mutations via immutable utilities based on post-orch decision
        if (decision.action === 'skip_and_continue') {
          // Mark current step completed if the decision recorded it
          if (decision.completedStepIndex !== undefined) {
            plan = markStepCompleted(plan, decision.completedStepIndex, decision.stepResult);
          }
          // Skip the step whose condition was not met
          if (decision.skippedStepIndex !== undefined) {
            plan = markStepSkipped(plan, decision.skippedStepIndex);
          }
          yield { type: 'plan_update', data: plan };
          chainDepth++;
          continue;
        }

        if (parsed.postOrch.current_step_completed) {
          plan = markStepCompleted(plan, nextStep.step_index, parsed.postOrch.step_result);
        }
        yield { type: 'plan_update', data: plan };

        if (decision.action === 'stop') {
          break;
        } else if (decision.action === 'ask_user') {
          yield { type: 'done', data: { action: 'ask_user', reason: decision.reason } };
          // Emit trace before returning
          this.emitTurnTrace(trigger, orchOutput, currentSkillId, toolCount, parsed.signals, turnStart, orchLatency, execLatency, execTtft);
          return;
        }

        // Continue with next step
        chainDepth++;
      }

      // Emit final trace
      const finalParsed = { signals: { coverage: 'enough' as const, confidence: 'high' as const, next_action_hint: 'stop' as const } };
      this.emitTurnTrace(trigger, orchOutput, currentSkillId, toolCount, finalParsed.signals, turnStart, orchLatency, execLatency, execTtft);

      yield { type: 'done', data: { action: 'stop', plan } };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.log('ORCH', 'error', `Pipeline error: ${message}`);
      yield { type: 'error', data: { message } };
    }
  }

  private async callOrchestrator(
    systemPrompt: string,
    triggerInfo: string,
    conversationState?: string
  ): Promise<OrchestratorOutput> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.bearerToken) {
      headers['Authorization'] = `Bearer ${this.config.bearerToken}`;
    }
    const response = await fetch(`${this.config.apiEndpoint}/orchestrate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ system_prompt: systemPrompt, trigger_info: triggerInfo, conversation_state: conversationState }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(error.error?.message || `Orchestrator API error: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error?.message || 'Orchestrator failed');
    }
    return result.data;
  }

  private async *callExecutor(
    systemPrompt: string,
    contextPack: string,
    userMessage: string,
    tools?: ToolDefinition[],
    runtimeContext?: Record<string, unknown>
  ): AsyncGenerator<StreamEvent> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.bearerToken) {
      headers['Authorization'] = `Bearer ${this.config.bearerToken}`;
    }
    const response = await fetch(`${this.config.apiEndpoint}/execute`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        system_prompt: systemPrompt,
        messages: [{ role: 'user', content: `${contextPack}\n\n${userMessage}` }],
        tools,
        stream: true,
        runtime_context: runtimeContext,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Executor API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const chunk: StreamChunk = JSON.parse(line.slice(6));
            yield { type: chunk.type as StreamEvent['type'], data: chunk.data };
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    }
  }

  private emitTurnTrace(
    trigger: Trigger,
    orchOutput: OrchestratorOutput,
    skillId: string,
    toolCount: number,
    signals: ExecutionSignals,
    turnStart: number,
    orchLatency: number,
    execLatency: number,
    execTtft: number
  ): void {
    const trace: TurnTrace = {
      trigger_type: trigger.type,
      workflow_id: orchOutput.workflow_id,
      skill_id: skillId,
      tool_count: toolCount,
      signals,
      latency_ms: Date.now() - turnStart,
      orch_latency_ms: orchLatency,
      exec_latency_ms: execLatency,
      exec_ttft_ms: execTtft,
      timestamp: new Date(),
    };
    this.logger.emitTrace(trace);
  }
}
