import { NextRequest, NextResponse } from 'next/server';
import type { Trigger } from '@/types';
import { createHmac } from 'crypto';
import { withMiddleware } from '@/proxy/middleware';

async function handler(request: NextRequest) {
  try {
    const body = await request.text();
    const webhookSecret = process.env.ASSIAIR_WEBHOOK_SECRET;

    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const signature = request.headers.get('x-webhook-signature') || request.headers.get('x-hub-signature-256');
      if (signature) {
        const expected = 'sha256=' + createHmac('sha256', webhookSecret).update(body).digest('hex');
        if (signature !== expected) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' } },
            { status: 401 }
          );
        }
      }
    }

    const payload = JSON.parse(body);

    // Convert to Trigger format
    const trigger: Trigger = {
      type: 'webhook',
      source: request.headers.get('x-webhook-source') || 'external',
      payload: {
        event_kind: payload.event || payload.action || 'unknown',
        data: payload,
      },
      timestamp: Date.now(),
      session_id: `webhook_${Date.now()}`,
    };

    return NextResponse.json({
      success: true,
      trigger_id: trigger.session_id,
      trigger,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid webhook payload';
    return NextResponse.json(
      { success: false, error: { code: 'WEBHOOK_ERROR', message } },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  return withMiddleware(request, handler);
}
