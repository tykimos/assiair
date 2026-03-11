import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { handleOptions, withCors } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

/**
 * POST /api/webhook/message
 *
 * External webhook that stores a pending trigger for the widget to pick up.
 * The widget polls GET /api/webhook/message and runs the orchestration pipeline.
 *
 * Request:
 * {
 *   "app_token": "Q4fmsk",
 *   "session_id": "채팅_세션_ID",
 *   "message": "이 보고서를 요약해주세요.",
 *   "context": { paper_id, title, tags, status, abstract, file_url, ... }
 * }
 *
 * Response:
 * { "success": true, "message_id": "wh_msg_..." }
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return withCors(
      NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 503 })
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return withCors(
      NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    );
  }

  const { app_token, session_id, message, context } = body as {
    app_token?: string;
    session_id?: string;
    message?: string;
    context?: Record<string, unknown>;
  };

  // --- Validation ---
  if (!app_token) {
    return withCors(
      NextResponse.json({ success: false, error: 'app_token is required' }, { status: 400 })
    );
  }
  if (!session_id) {
    return withCors(
      NextResponse.json({ success: false, error: 'session_id is required' }, { status: 400 })
    );
  }
  if (!message || typeof message !== 'string') {
    return withCors(
      NextResponse.json({ success: false, error: 'message is required and must be a string' }, { status: 400 })
    );
  }

  // --- Resolve app_token → app name ---
  const { data: settingsRow, error: tokenErr } = await supabase
    .from('settings')
    .select('app')
    .eq('token', app_token)
    .eq('user', 'default')
    .single();

  if (tokenErr || !settingsRow) {
    return withCors(
      NextResponse.json({ success: false, error: 'Invalid app_token' }, { status: 401 })
    );
  }

  const appName = settingsRow.app as string;
  const messageId = `wh_msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // --- Store as pending webhook trigger ---
  const { error: insertErr } = await supabase.from('webhook_messages').insert({
    message_id: messageId,
    app: appName,
    session_id,
    message,
    context: context || {},
    status: 'pending',
  });

  if (insertErr) {
    console.error('[webhook/message] Insert failed:', insertErr.message);
    return withCors(
      NextResponse.json({ success: false, error: 'Failed to store webhook message' }, { status: 500 })
    );
  }

  return withCors(
    NextResponse.json({ success: true, message_id: messageId })
  );
}

/**
 * GET /api/webhook/message?session_id=xxx
 *
 * Widget polls this endpoint to pick up pending webhook triggers.
 * Returns pending messages and marks them as 'consumed'.
 */
export async function GET(req: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return withCors(
      NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 503 })
    );
  }

  const sessionId = req.nextUrl.searchParams.get('session_id');
  if (!sessionId) {
    return withCors(
      NextResponse.json({ success: false, error: 'session_id is required' }, { status: 400 })
    );
  }

  // Fetch pending messages for this session
  const { data: pending, error: fetchErr } = await supabase
    .from('webhook_messages')
    .select('*')
    .eq('session_id', sessionId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (fetchErr) {
    return withCors(
      NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 })
    );
  }

  if (!pending || pending.length === 0) {
    return withCors(
      NextResponse.json({ success: true, messages: [] })
    );
  }

  // Mark as consumed
  const ids = pending.map((m: Record<string, unknown>) => m.id);
  await supabase
    .from('webhook_messages')
    .update({ status: 'consumed', consumed_at: new Date().toISOString() })
    .in('id', ids);

  return withCors(
    NextResponse.json({ success: true, messages: pending })
  );
}
