import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export async function supabaseQueryTool(
  table: string,
  select: string = '*',
  eq?: Record<string, string>,
  limit: number = 10
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { ok: false, error: 'Supabase URL or Key is not configured' };
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    let query = supabase.from(table).select(select);

    if (eq) {
      for (const [key, value] of Object.entries(eq)) {
        query = query.eq(key, value);
      }
    }

    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Supabase query failed',
    };
  }
}
