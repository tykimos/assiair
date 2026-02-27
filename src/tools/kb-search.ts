import { getContextProviderRegistry } from '@/context/context-registry';

export async function kbSearchTool(
  query: string,
  kbId?: string
): Promise<{ ok: boolean; results?: { title: string; content: string; relevance: number }[]; error?: string }> {
  try {
    const registry = getContextProviderRegistry();
    const results = await registry.searchKnowledgeBase(query, kbId);
    return {
      ok: true,
      results: results.map(r => ({
        title: r.title,
        content: r.content,
        relevance: r.relevance,
      })),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'KB search failed' };
  }
}
