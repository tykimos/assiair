import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const app = req.nextUrl.searchParams.get('app') || 'default';
  const user = req.nextUrl.searchParams.get('user') || 'anonymous';

  let query = supabase
    .from('sessions')
    .select('id, session_id, app, user, turn_count, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (app !== 'all') query = query.eq('app', app);
  if (user !== 'all') query = query.eq('user', user);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const body = await req.json();
  const {
    session_id,
    app = 'default',
    user = 'anonymous',
    messages = [],
    config_snapshot = {},
    logs = [],
    turn_count = 0,
  } = body;

  if (!session_id) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('sessions')
    .upsert(
      {
        session_id,
        app,
        user,
        messages,
        config_snapshot,
        logs,
        turn_count,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'session_id' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
