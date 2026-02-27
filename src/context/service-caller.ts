import type { ServiceEndpointConfig } from '@/types/service-endpoint';

/**
 * Replace {{variable}} placeholders in a template string with actual values.
 */
export function interpolateTemplate(
  template: string,
  variables: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path: string) => {
    const value = getNestedValue(variables, path);
    return value !== undefined ? String(value) : '';
  });
}

/**
 * Get a nested value from an object using dot-path notation.
 * e.g., getNestedValue({ a: { b: 1 } }, "a.b") => 1
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Call a configured service endpoint with template variable interpolation.
 */
export async function callServiceEndpoint(
  endpoint: ServiceEndpointConfig,
  params: Record<string, unknown> = {},
  context: Record<string, unknown> = {}
): Promise<unknown> {
  const allVars = { ...context, ...params };

  // Interpolate URL
  const url = interpolateTemplate(endpoint.baseUrl, allVars);

  // Interpolate headers
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(endpoint.headers)) {
    headers[key] = interpolateTemplate(value, allVars);
  }

  // Build request options
  const options: RequestInit = {
    method: endpoint.method,
    headers,
    signal: AbortSignal.timeout(endpoint.timeoutMs || 10000),
  };

  // Interpolate body for POST/PUT
  if (endpoint.bodyTemplate && (endpoint.method === 'POST' || endpoint.method === 'PUT')) {
    const bodyStr = interpolateTemplate(endpoint.bodyTemplate, allVars);
    options.body = bodyStr;
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Service endpoint ${endpoint.id} returned ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}
