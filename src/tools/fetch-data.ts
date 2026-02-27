import { getContextProviderRegistry } from '@/context/context-registry';

export async function fetchDataTool(
  endpointId: string,
  params?: Record<string, unknown>
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const registry = getContextProviderRegistry();
    const data = await registry.callEndpoint(endpointId, params || {});
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Data fetch failed' };
  }
}
