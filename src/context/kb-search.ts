import type { KnowledgeBaseDocument, KnowledgeBaseProviderConfig } from '@/types/context-provider';
import type { ServiceEndpointConfig } from '@/types/service-endpoint';
import { callServiceEndpoint } from './service-caller';

interface SearchResult extends KnowledgeBaseDocument {
  relevance: number;
}

/**
 * Search inline documents using keyword matching.
 * Returns documents sorted by relevance score.
 */
export function searchInlineDocuments(
  query: string,
  documents: KnowledgeBaseDocument[]
): SearchResult[] {
  if (!query.trim() || documents.length === 0) return [];

  const queryTokens = query.toLowerCase().split(/\s+/).filter(Boolean);

  const scored = documents.map(doc => {
    const text = `${doc.title} ${doc.content} ${(doc.tags || []).join(' ')}`.toLowerCase();
    let score = 0;

    for (const token of queryTokens) {
      // Title match (higher weight)
      if (doc.title.toLowerCase().includes(token)) score += 3;
      // Content match
      if (doc.content.toLowerCase().includes(token)) score += 1;
      // Tag match
      if (doc.tags?.some(t => t.toLowerCase().includes(token))) score += 2;
    }

    // Exact phrase match bonus
    if (text.includes(query.toLowerCase())) score += 5;

    return { ...doc, relevance: score };
  });

  return scored
    .filter(r => r.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 5);
}

/**
 * Search a knowledge base via external API endpoint.
 */
export async function searchKnowledgeBaseApi(
  query: string,
  endpoint: ServiceEndpointConfig
): Promise<SearchResult[]> {
  try {
    const response = await callServiceEndpoint(endpoint, { query }, { query });

    // Expect response to be an array of documents or have a results field
    const results = Array.isArray(response)
      ? response
      : (response as Record<string, unknown>)?.results;

    if (!Array.isArray(results)) return [];

    return results.map((r: Record<string, unknown>, i: number) => ({
      id: (r.id as string) || `result_${i}`,
      title: (r.title as string) || '',
      content: (r.content as string) || (r.text as string) || '',
      tags: r.tags as string[] | undefined,
      relevance: (r.relevance as number) || (r.score as number) || 1,
    }));
  } catch (error) {
    console.warn('[KBSearch] API search failed:', error);
    return [];
  }
}

/**
 * Search a knowledge base (inline or API) based on provider config.
 */
export async function searchKnowledgeBase(
  query: string,
  config: KnowledgeBaseProviderConfig,
  endpoint?: ServiceEndpointConfig
): Promise<SearchResult[]> {
  if (config.sourceType === 'inline' && config.inlineDocuments) {
    return searchInlineDocuments(query, config.inlineDocuments);
  }

  if (config.sourceType === 'api' && endpoint) {
    return searchKnowledgeBaseApi(query, endpoint);
  }

  return [];
}
