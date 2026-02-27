import { NextRequest, NextResponse } from 'next/server';
import { verifyBearerToken } from './auth';
import { checkRateLimit } from './rate-limit';
import { LIMITS } from '../../config/limits';
import { logAuditEntry } from './audit-log';

export async function withMiddleware(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<Response>
): Promise<Response> {
  const startTime = Date.now();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  // 1. Auth check
  const authResult = verifyBearerToken(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: authResult.error } },
      { status: 401 }
    );
  }

  // 2. Rate limit check
  const rateResult = checkRateLimit(ip, LIMITS.PROXY_RATE_LIMIT);
  if (!rateResult.allowed) {
    return NextResponse.json(
      { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateResult.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': String(rateResult.remaining),
        },
      }
    );
  }

  // 3. Execute handler
  const response = await handler(request);

  // 4. Audit log
  logAuditEntry({
    timestamp: new Date(),
    ip,
    method: request.method,
    path: request.nextUrl.pathname,
    statusCode: response.status,
    latencyMs: Date.now() - startTime,
  });

  return response;
}
