import { LIMITS } from '../../config/limits';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateBodySize(body: string): ValidationResult {
  const size = new TextEncoder().encode(body).length;
  if (size > LIMITS.PROXY_MAX_BODY_BYTES) {
    return { valid: false, error: `Request body exceeds max size of ${LIMITS.PROXY_MAX_BODY_BYTES} bytes` };
  }
  return { valid: true };
}

export function validateOrchestrateRequest(body: Record<string, unknown>): ValidationResult {
  if (!body.system_prompt || typeof body.system_prompt !== 'string') {
    return { valid: false, error: 'Missing or invalid system_prompt' };
  }
  if (!body.trigger_info || typeof body.trigger_info !== 'string') {
    return { valid: false, error: 'Missing or invalid trigger_info' };
  }
  return { valid: true };
}

export function validateExecuteRequest(body: Record<string, unknown>): ValidationResult {
  if (!body.system_prompt || typeof body.system_prompt !== 'string') {
    return { valid: false, error: 'Missing or invalid system_prompt' };
  }
  if (!body.messages || !Array.isArray(body.messages)) {
    return { valid: false, error: 'Missing or invalid messages array' };
  }
  return { valid: true };
}
