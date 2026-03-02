import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { withCors, handleOptions } from '@/lib/cors';

export async function OPTIONS() { return handleOptions(); }

/** Generate a 6-char alphanumeric token (ambiguous chars excluded) */
function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 6; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const app = req.nextUrl.searchParams.get('app') || 'default';
  const user = req.nextUrl.searchParams.get('user') || 'anonymous';
  const list = req.nextUrl.searchParams.get('list') === 'true';
  const appToken = req.nextUrl.searchParams.get('app_token');
  const userToken = req.nextUrl.searchParams.get('user_token');

  // Resolve app_token → app name
  if (appToken) {
    const { data, error } = await supabase
      .from('settings')
      .select('app, token')
      .eq('token', appToken)
      .eq('user', 'default')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'app_token not found' }, { status: 404 });
    }
    return NextResponse.json({ data: { app: data.app, token: data.token } });
  }

  // Resolve user_token → app + user
  if (userToken) {
    const { data, error } = await supabase
      .from('settings')
      .select('app, user, token')
      .eq('token', userToken)
      .neq('user', 'default')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'user_token not found' }, { status: 404 });
    }
    return NextResponse.json({ data: { app: data.app, user: data.user, token: data.token } });
  }

  // List mode: return all settings rows (for admin page)
  if (list) {
    let query = supabase
      .from('settings')
      .select('*')
      .order('updated_at', { ascending: false });

    if (app !== 'all') query = query.eq('app', app);
    if (user !== 'all') query = query.eq('user', user);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: data || [] });
  }

  // Single mode: return one settings record
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('app', app)
    .eq('user', user)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data || null });
}

export async function PUT(req: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const body = await req.json();
  const { app = 'default', user = 'anonymous', config } = body;

  if (!config) {
    return NextResponse.json({ error: 'config is required' }, { status: 400 });
  }

  const record: Record<string, unknown> = {
    app, user, config, updated_at: new Date().toISOString(),
  };

  // Auto-generate token for ALL new settings rows (app defaults + user-specific)
  const { data: existing } = await supabase
    .from('settings')
    .select('token')
    .eq('app', app)
    .eq('user', user)
    .single();

  if (!existing?.token) {
    record.token = generateToken();
  }

  const { data, error } = await supabase
    .from('settings')
    .upsert(record, { onConflict: 'app,user' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
