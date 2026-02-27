import OpenAI from 'openai';
import type { ToolDefinition } from '@/types';
import { LIMITS } from '../../config/limits';
import { executeTool } from '@/tools/index';
import { getOpenAIClient, getExecModel } from '@/lib/openai-client';

const MAX_TOOL_ROUNDS = 5;

interface ExecuteParams {
  systemPrompt: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  tools?: ToolDefinition[];
  stream?: boolean;
  runtimeContext?: Record<string, unknown>;
}

/** Assembled tool call built from streaming deltas */
interface AssembledToolCall {
  id: string;
  name: string;
  arguments: string;
}

export async function executeStream(params: ExecuteParams): Promise<ReadableStream<Uint8Array>> {
  const { systemPrompt, messages, tools, runtimeContext } = params;
  const model = getExecModel();
  const encoder = new TextEncoder();

  const startTime = Date.now();
  let firstTokenTime: number | null = null;

  const conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  // Build OpenAI tools format if provided
  const openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] | undefined =
    tools && tools.length > 0
      ? tools.map(t => ({
          type: 'function' as const,
          function: {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
          },
        }))
      : undefined;

  return new ReadableStream({
    async start(controller) {
      try {
        const openai = getOpenAIClient();
        let toolCallCount = 0;

        // Tool-calling loop: repeat until LLM stops calling tools or max rounds reached
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const response = await openai.chat.completions.create({
            model,
            messages: conversationMessages,
            max_completion_tokens: LIMITS.EXEC_MAX_TOKENS,
            stream: true,
            tools: openaiTools,
          });

          // Assemble tool calls from streaming deltas (indexed by tool call index)
          const pendingToolCalls: Record<number, AssembledToolCall> = {};
          let finishReason: string | null = null;
          let assistantContent = '';

          for await (const chunk of response) {
            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            // Track TTFT (only on first round)
            if (firstTokenTime === null && delta.content) {
              firstTokenTime = Date.now();
              const ttft = firstTokenTime - startTime;
              if (ttft > LIMITS.EXEC_TTFT_TARGET_MS) {
                console.warn(`[EXEC] TTFT ${ttft}ms exceeds target ${LIMITS.EXEC_TTFT_TARGET_MS}ms`);
              }
            }

            // Content chunk — stream to client immediately
            if (delta.content) {
              assistantContent += delta.content;
              const sseData = JSON.stringify({ type: 'content', data: delta.content });
              controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
            }

            // Accumulate tool call deltas by index
            if (delta.tool_calls) {
              for (const tcDelta of delta.tool_calls) {
                const idx = tcDelta.index ?? 0;
                if (!pendingToolCalls[idx]) {
                  pendingToolCalls[idx] = { id: '', name: '', arguments: '' };
                }
                const tc = pendingToolCalls[idx];
                if (tcDelta.id) tc.id = tcDelta.id;
                if (tcDelta.function?.name) tc.name += tcDelta.function.name;
                if (tcDelta.function?.arguments) tc.arguments += tcDelta.function.arguments;
              }
            }

            if (chunk.choices[0]?.finish_reason) {
              finishReason = chunk.choices[0].finish_reason;
            }
          }

          const assembledToolCalls = Object.values(pendingToolCalls).filter(tc => tc.name);

          // If the LLM returned tool calls, execute them and continue the loop
          if (finishReason === 'tool_calls' && assembledToolCalls.length > 0) {
            // Enforce per-step tool call limit
            if (toolCallCount + assembledToolCalls.length > LIMITS.MAX_TOOL_CALLS_PER_STEP) {
              const errorData = JSON.stringify({
                type: 'error',
                data: { message: `Max tool calls (${LIMITS.MAX_TOOL_CALLS_PER_STEP}) exceeded` },
              });
              controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
              break;
            }

            // Add assistant's tool_use message to conversation
            conversationMessages.push({
              role: 'assistant',
              content: assistantContent || null,
              tool_calls: assembledToolCalls.map(tc => ({
                id: tc.id,
                type: 'function' as const,
                function: { name: tc.name, arguments: tc.arguments },
              })),
            });

            // Execute each tool call and stream results
            const toolResultMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
            for (const tc of assembledToolCalls) {
              toolCallCount++;

              // Notify client of the tool call
              const toolCallData = JSON.stringify({
                type: 'tool_call',
                data: { id: tc.id, name: tc.name, args: tc.arguments },
              });
              controller.enqueue(encoder.encode(`data: ${toolCallData}\n\n`));

              // Parse args and execute
              let parsedArgs: Record<string, unknown> = {};
              try {
                parsedArgs = JSON.parse(tc.arguments || '{}');
              } catch {
                parsedArgs = {};
              }

              let toolResult: unknown;
              try {
                toolResult = await executeTool(tc.name, parsedArgs, runtimeContext);
              } catch (err) {
                toolResult = { ok: false, error: err instanceof Error ? err.message : String(err) };
              }

              // Notify client of the tool result
              const toolResultData = JSON.stringify({
                type: 'tool_result',
                data: { id: tc.id, name: tc.name, result: toolResult },
              });
              controller.enqueue(encoder.encode(`data: ${toolResultData}\n\n`));

              // Prepare the tool result message for the next LLM call
              toolResultMessages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify(toolResult),
              });
            }

            // Add tool results to conversation and loop
            conversationMessages.push(...toolResultMessages);
            continue;
          }

          // No more tool calls — emit done and exit loop
          const latencyMs = Date.now() - startTime;
          const doneData = JSON.stringify({
            type: 'done',
            data: {
              finish_reason: finishReason,
              latency_ms: latencyMs,
              ttft_ms: firstTokenTime ? firstTokenTime - startTime : null,
            },
          });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          break;
        }

        controller.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorData = JSON.stringify({ type: 'error', data: { message: errorMessage } });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        controller.close();
      }
    },
  });
}

// Non-streaming variant for simple cases
export async function executeSync(params: ExecuteParams): Promise<string> {
  const { systemPrompt, messages, tools } = params;
  const model = getExecModel();

  const allMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  const openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] | undefined =
    tools && tools.length > 0
      ? tools.map(t => ({
          type: 'function' as const,
          function: {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
          },
        }))
      : undefined;

  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model,
    messages: allMessages,
    max_completion_tokens: LIMITS.EXEC_MAX_TOKENS,
    tools: openaiTools,
  });

  return response.choices[0]?.message?.content || '';
}
