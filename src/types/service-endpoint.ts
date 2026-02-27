export interface ServiceEndpointConfig {
  id: string;
  label: string;
  description: string;
  baseUrl: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: Record<string, string>;
  bodyTemplate?: string;
  timeoutMs: number;
  category: 'identity' | 'knowledge_base' | 'document' | 'email' | 'data' | 'general';
}
