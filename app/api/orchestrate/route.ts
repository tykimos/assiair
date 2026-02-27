import { NextRequest, NextResponse } from 'next/server';
import { orchestrate } from '@/orchestrator/orchestrator';
import { withMiddleware } from '@/proxy/middleware';

async function handler(request: NextRequest) {
  try {
    const body = await request.json();
    const { system_prompt, trigger_info, conversation_state } = body;

    if (!system_prompt || !trigger_info) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Missing system_prompt or trigger_info' } },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const data = await orchestrate(system_prompt, trigger_info, conversation_state);
    const latency_ms = Date.now() - startTime;

    return NextResponse.json({ success: true, data, latency_ms });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[API /orchestrate]', message);
    return NextResponse.json(
      { success: false, error: { code: 'ORCHESTRATOR_ERROR', message } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return withMiddleware(request, handler);
}
