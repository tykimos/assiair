import { createClient } from '@supabase/supabase-js';
import { getContextProviderRegistry } from '@/context/context-registry';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Dedicated user lookup tool: takes a chat_token and returns user info
 * from the registrations table. Encapsulates the query logic so the LLM
 * doesn't need to construct the supabase_query call itself.
 */
export async function userLookupTool(
  token: string
): Promise<{ ok: boolean; found: boolean; data?: Record<string, unknown>; error?: string }> {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    return { ok: true, found: false, error: 'No token provided' };
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { ok: false, found: false, error: 'Supabase URL or Key is not configured' };
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data, error } = await supabase
      .from('registrations')
      .select('*')
      .eq('chat_token', token.trim())
      .limit(1);

    if (error) {
      return { ok: false, found: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { ok: true, found: false };
    }

    // Persist user info in session context so subsequent pipelines
    // (e.g. document-request) can retrieve it via context_lookup(key: "user_info")
    try {
      const registry = getContextProviderRegistry();
      registry.setSessionValue('user_info', data[0]);
    } catch {
      // Non-critical: context save failure should not break lookup
    }

    return { ok: true, found: true, data: data[0] };
  } catch (error) {
    return {
      ok: false,
      found: false,
      error: error instanceof Error ? error.message : 'User lookup failed',
    };
  }
}
