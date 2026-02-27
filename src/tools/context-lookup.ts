import { getContextProviderRegistry } from '@/context/context-registry';

export async function contextLookupTool(
  key: string
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const registry = getContextProviderRegistry();
    const resolved = registry.getResolvedContext();
    const value = resolved[key];

    if (value === undefined) {
      return { ok: false, error: `Context key "${key}" not found` };
    }

    return { ok: true, data: value };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Context lookup failed' };
  }
}
