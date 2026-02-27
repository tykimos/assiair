import type { ServiceEndpointConfig } from '@/types/service-endpoint';
import { callServiceEndpoint, getNestedValue } from './service-caller';

/**
 * Resolve user identity by calling a configured service endpoint with a token.
 * Uses responseMappings to extract fields from the API response.
 * e.g., responseMappings: { "userName": "data.user.name", "email": "data.user.email" }
 */
export async function resolveIdentity(
  token: string,
  endpoint: ServiceEndpointConfig,
  responseMappings: Record<string, string>
): Promise<Record<string, unknown>> {
  try {
    const response = await callServiceEndpoint(endpoint, { token }, { userToken: token });

    const result: Record<string, unknown> = {};
    for (const [targetKey, sourcePath] of Object.entries(responseMappings)) {
      const value = getNestedValue(response, sourcePath);
      if (value !== undefined) {
        result[targetKey] = value;
      }
    }

    return result;
  } catch (error) {
    console.warn('[IdentityResolver] Failed to resolve identity:', error);
    return {};
  }
}
