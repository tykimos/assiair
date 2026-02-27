import { NextRequest } from 'next/server';

export interface AuthResult {
  authenticated: boolean;
  error?: string;
}

export function verifyBearerToken(request: NextRequest): AuthResult {
  const expectedToken = process.env.ASSIAIR_BEARER_TOKEN;

  // If no token is configured, auth is disabled (development mode)
  if (!expectedToken) {
    return { authenticated: true };
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return { authenticated: false, error: 'Missing Authorization header' };
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return { authenticated: false, error: 'Invalid Authorization header format. Expected: Bearer <token>' };
  }

  if (token !== expectedToken) {
    return { authenticated: false, error: 'Invalid bearer token' };
  }

  return { authenticated: true };
}
