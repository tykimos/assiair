import { NextRequest } from 'next/server';
import { executeStream, executeSync } from '@/executor/executor';
import { withMiddleware } from '@/proxy/middleware';

async function handler(request: NextRequest) {
  try {
    const body = await request.json();
    const { system_prompt, messages, tools, stream = true, runtime_context } = body;

    if (!system_prompt || !messages) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'INVALID_REQUEST', message: 'Missing system_prompt or messages' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (stream) {
      const readableStream = await executeStream({
        systemPrompt: system_prompt,
        messages,
        tools,
        stream: true,
        runtimeContext: runtime_context,
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      const result = await executeSync({
        systemPrompt: system_prompt,
        messages,
        tools,
        runtimeContext: runtime_context,
      });

      return new Response(
        JSON.stringify({ success: true, data: { content: result } }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[API /execute]', message);
    return new Response(
      JSON.stringify({ success: false, error: { code: 'EXECUTOR_ERROR', message } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function POST(request: NextRequest) {
  return withMiddleware(request, handler);
}
