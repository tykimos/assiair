import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/proxy/rate-limit';
import { LIMITS } from '../../../config/limits';
import { getOrchModel, getExecModel } from '@/lib/openai-client';

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
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

  const provider = process.env.AZURE_OPENAI_ENDPOINT ? 'azure' : 'openai';

  const config = {
    provider,
    orchModel: getOrchModel(),
    execModel: getExecModel(),
    availableModels: {
      orch: ['gpt-4o-mini', 'gpt-3.5-turbo'],
      exec: ['gpt-4o', 'gpt-4o-mini'],
    },
    featureFlags: {
      webhooks: !!process.env.ASSIAIR_WEBHOOK_SECRET,
      pythonSandbox: true,
      jsSandbox: true,
    },
    version: '1.0.0',
  };

  // Never expose API keys or secrets
  return NextResponse.json(config);
}
