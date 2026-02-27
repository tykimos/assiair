export type ContextProviderTiming = 'init' | 'on_demand';

export interface ContextProviderConfig {
  id: string;
  type: 'url_params' | 'identity' | 'knowledge_base' | 'api_data' | 'static_data';
  label: string;
  description: string;
  enabled: boolean;
}

export interface UrlParamsProviderConfig extends ContextProviderConfig {
  type: 'url_params';
  captureKeys: string[];
  keyMapping: Record<string, string>;
}

export interface IdentityProviderConfig extends ContextProviderConfig {
  type: 'identity';
  tokenContextKey: string;
  endpointId: string;
  responseMappings: Record<string, string>;
}

export interface KnowledgeBaseDocument {
  id: string;
  title: string;
  content: string;
  tags?: string[];
}

export interface KnowledgeBaseProviderConfig extends ContextProviderConfig {
  type: 'knowledge_base';
  kbId: string;
  sourceType: 'api' | 'inline';
  endpointId?: string;
  inlineDocuments?: KnowledgeBaseDocument[];
}

export interface ApiDataProviderConfig extends ContextProviderConfig {
  type: 'api_data';
  endpointId: string;
  defaultParams?: Record<string, string>;
}

export interface StaticDataProviderConfig extends ContextProviderConfig {
  type: 'static_data';
  data: Record<string, unknown>;
}

export type AnyContextProviderConfig =
  | UrlParamsProviderConfig
  | IdentityProviderConfig
  | KnowledgeBaseProviderConfig
  | ApiDataProviderConfig
  | StaticDataProviderConfig;
