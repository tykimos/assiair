import type {
  AnyContextProviderConfig,
  UrlParamsProviderConfig,
  IdentityProviderConfig,
  KnowledgeBaseProviderConfig,
  KnowledgeBaseDocument,
  StaticDataProviderConfig,
} from '@/types/context-provider';
import type { ServiceEndpointConfig } from '@/types/service-endpoint';
import { captureUrlParams } from './url-params';
import { resolveIdentity } from './identity-resolver';
import { searchKnowledgeBase } from './kb-search';
import { callServiceEndpoint } from './service-caller';

interface SearchResult extends KnowledgeBaseDocument {
  relevance: number;
}

class ContextProviderRegistry {
  private providers = new Map<string, AnyContextProviderConfig>();
  private endpoints = new Map<string, ServiceEndpointConfig>();
  private resolvedContext: Record<string, unknown> = {};
  private initialized = false;

  /**
   * Initialize all context providers. Runs init-timing providers immediately.
   */
  async initialize(
    providerConfigs: AnyContextProviderConfig[],
    endpointConfigs: ServiceEndpointConfig[],
    widgetProps: {
      userToken?: string;
      captureUrlParams?: boolean;
      initialContext?: Record<string, unknown>;
    }
  ): Promise<void> {
    // Store configs
    this.providers.clear();
    this.endpoints.clear();
    this.resolvedContext = {};

    for (const p of providerConfigs) {
      this.providers.set(p.id, p);
    }
    for (const e of endpointConfigs) {
      this.endpoints.set(e.id, e);
    }

    // Inject initial context from widget props
    if (widgetProps.initialContext) {
      Object.assign(this.resolvedContext, widgetProps.initialContext);
    }

    // Inject userToken from widget props
    if (widgetProps.userToken) {
      this.resolvedContext.userToken = widgetProps.userToken;
    }

    // Step 1: URL params capture
    for (const [, config] of this.providers) {
      if (!config.enabled || config.type !== 'url_params') continue;
      const urlConfig = config as UrlParamsProviderConfig;
      const captured = captureUrlParams(urlConfig.captureKeys, urlConfig.keyMapping);
      Object.assign(this.resolvedContext, captured);
    }

    // Step 2: Static data injection
    for (const [, config] of this.providers) {
      if (!config.enabled || config.type !== 'static_data') continue;
      const staticConfig = config as StaticDataProviderConfig;
      Object.assign(this.resolvedContext, staticConfig.data);
    }

    // Step 3: Identity resolution (async)
    for (const [, config] of this.providers) {
      if (!config.enabled || config.type !== 'identity') continue;
      const idConfig = config as IdentityProviderConfig;
      const token = this.resolvedContext[idConfig.tokenContextKey];
      if (!token || typeof token !== 'string') continue;

      const endpoint = this.endpoints.get(idConfig.endpointId);
      if (!endpoint) {
        console.warn(`[ContextRegistry] Endpoint ${idConfig.endpointId} not found for identity provider ${config.id}`);
        continue;
      }

      const userInfo = await resolveIdentity(token, endpoint, idConfig.responseMappings);
      Object.assign(this.resolvedContext, userInfo);
    }

    this.initialized = true;
  }

  /**
   * Update configs without re-running init providers.
   */
  updateConfigs(
    providerConfigs: AnyContextProviderConfig[],
    endpointConfigs: ServiceEndpointConfig[]
  ): void {
    this.providers.clear();
    this.endpoints.clear();
    for (const p of providerConfigs) {
      this.providers.set(p.id, p);
    }
    for (const e of endpointConfigs) {
      this.endpoints.set(e.id, e);
    }
  }

  /**
   * Set resolved context from server-side (hydrated from client request).
   * Used by the executor API to make context_lookup tool work server-side.
   */
  setServerContext(context: Record<string, unknown>): void {
    this.resolvedContext = { ...context };
  }

  /**
   * Store a value in the session-scoped resolved context.
   * Persists across pipelines within the same server process lifetime,
   * so that e.g. user-lookup results survive across orchestrator runs.
   */
  setSessionValue(key: string, value: unknown): void {
    this.resolvedContext[key] = value;
  }

  /**
   * Get all resolved context data (from init-timing providers).
   */
  getResolvedContext(): Record<string, unknown> {
    return { ...this.resolvedContext };
  }

  /**
   * Search knowledge bases (on-demand).
   */
  async searchKnowledgeBase(query: string, kbId?: string): Promise<SearchResult[]> {
    const kbProviders = Array.from(this.providers.values())
      .filter((p): p is KnowledgeBaseProviderConfig =>
        p.type === 'knowledge_base' && p.enabled
      );

    if (kbId) {
      const kb = kbProviders.find(p => p.kbId === kbId);
      if (!kb) return [];
      const endpoint = kb.endpointId ? this.endpoints.get(kb.endpointId) : undefined;
      return searchKnowledgeBase(query, kb, endpoint);
    }

    // Search all enabled KBs
    const allResults: SearchResult[] = [];
    for (const kb of kbProviders) {
      const endpoint = kb.endpointId ? this.endpoints.get(kb.endpointId) : undefined;
      const results = await searchKnowledgeBase(query, kb, endpoint);
      allResults.push(...results);
    }

    return allResults.sort((a, b) => b.relevance - a.relevance).slice(0, 10);
  }

  /**
   * Call a configured service endpoint by ID.
   */
  async callEndpoint(
    endpointId: string,
    params: Record<string, unknown> = {}
  ): Promise<unknown> {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      throw new Error(`Service endpoint "${endpointId}" not found`);
    }
    return callServiceEndpoint(endpoint, params, this.resolvedContext);
  }

  /**
   * Get a service endpoint config by ID.
   */
  getEndpoint(endpointId: string): ServiceEndpointConfig | undefined {
    return this.endpoints.get(endpointId);
  }

  /**
   * Get all enabled knowledge base providers.
   */
  getKnowledgeBases(): KnowledgeBaseProviderConfig[] {
    return Array.from(this.providers.values())
      .filter((p): p is KnowledgeBaseProviderConfig =>
        p.type === 'knowledge_base' && p.enabled
      );
  }

  /**
   * Get all service endpoints.
   */
  getAllEndpoints(): ServiceEndpointConfig[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Check if initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton
let registryInstance: ContextProviderRegistry | null = null;

export function getContextProviderRegistry(): ContextProviderRegistry {
  if (!registryInstance) {
    registryInstance = new ContextProviderRegistry();
  }
  return registryInstance;
}
