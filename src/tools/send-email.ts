import { getContextProviderRegistry } from '@/context/context-registry';

const SEND_MAIL_BASE_URL = 'https://send-mail.nicedune-dfc430a8.westus2.azurecontainerapps.io';
const SENDER_EMAIL = 'se@aifactory.page';
const PATH_CANDIDATES = ['/email/aws-send', '/emails/aws-send', '/api/v1/emails/aws-send'];

/**
 * Send an email via configured service endpoint, falling back to direct
 * AWS SES relay when no endpoint is configured.
 */
export async function sendEmailTool(
  to: string,
  subject: string,
  body: string,
  attachments?: string[]
): Promise<{ ok: boolean; message_id?: string; error?: string }> {
  // 1. Try configured service endpoint first
  try {
    const registry = getContextProviderRegistry();
    const endpoints = registry.getAllEndpoints();
    const emailEndpoint = endpoints.find(e => e.category === 'email');

    if (emailEndpoint) {
      const result = await registry.callEndpoint(emailEndpoint.id, {
        to, subject, body, attachments: attachments || [],
      });
      const data = result as Record<string, unknown>;
      return {
        ok: true,
        message_id: (data.message_id as string) || (data.id as string) || '',
      };
    }
  } catch (endpointError) {
    console.warn('[send-email] Service endpoint failed, trying AWS SES fallback:', endpointError);
  }

  // 2. Fallback: direct AWS SES relay (same pattern as ref/_mailer.js)
  try {
    const baseUrl = process.env.SEND_MAIL_BASE_URL || SEND_MAIL_BASE_URL;
    const senderEmail = process.env.SENDER_EMAIL || SENDER_EMAIL;

    const payload = {
      senderEmail,
      recipientEmails: [to],
      subject,
      body,
    };

    let lastError: Error | null = null;

    for (const path of PATH_CANDIDATES) {
      const endpoint = `${baseUrl.replace(/\/$/, '')}${path}`;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.status === 404) {
          continue; // Try next path
        }

        const responseBody = await response.text().catch(() => '');
        if (!response.ok) {
          lastError = new Error(`메일 API 호출 실패(${response.status}): ${responseBody || '응답 본문 없음'}`);
          break;
        }

        // Parse response to check for per-recipient failures
        let parsed: unknown = null;
        try {
          parsed = responseBody ? JSON.parse(responseBody) : null;
        } catch {
          parsed = null;
        }

        if (Array.isArray(parsed)) {
          const failed = parsed.filter(
            (item: Record<string, unknown>) => item && item.isSuccess === false
          );
          if (failed.length > 0) {
            const reason = failed
              .map((item: Record<string, unknown>) =>
                `${item.email || 'unknown'}:${item.errorMessage || 'unknown error'}`
              )
              .join(', ');
            return { ok: false, error: `메일 전송 실패: ${reason}` };
          }
        }

        return {
          ok: true,
          message_id: `ses-${Date.now()}`,
        };
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.message.includes('404')) {
          continue;
        }
        lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
        break;
      }
    }

    if (lastError) {
      return { ok: false, error: lastError.message };
    }
    return { ok: false, error: '메일 API 엔드포인트를 찾을 수 없습니다.' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Email sending failed' };
  }
}
