import { LIMITS } from '../../config/limits';
import { HTTP_ALLOWLIST } from '../../config/http-allowlist';

interface HttpResult {
  ok: boolean;
  status?: number;
  data?: string;
  error?: string;
}

export async function httpRequest(
  url: string,
  options?: { method?: string; headers?: Record<string, string>; body?: string }
): Promise<HttpResult> {
  try {
    // Parse URL to check domain
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname;

    // Check allowlist
    if (!HTTP_ALLOWLIST.some(allowed => domain === allowed || domain.endsWith('.' + allowed))) {
      return { ok: false, error: `Domain not allowed: ${domain}. Allowed: ${HTTP_ALLOWLIST.join(', ')}` };
    }

    // Only GET and POST allowed
    const method = (options?.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'POST') {
      return { ok: false, error: `Method not allowed: ${method}. Only GET and POST are supported.` };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(url, {
      method,
      headers: options?.headers,
      body: method === 'POST' ? options?.body : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const text = await response.text();

    // Truncate response if too large
    const truncated = text.length > LIMITS.HTTP_MAX_RESPONSE_BYTES
      ? text.slice(0, LIMITS.HTTP_MAX_RESPONSE_BYTES) + '\n... (truncated)'
      : text;

    return { ok: response.ok, status: response.status, data: truncated };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, error: 'Request timed out after 10s' };
    }
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
