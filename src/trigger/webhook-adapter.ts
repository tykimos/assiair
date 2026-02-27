import type { Trigger } from '@/types';

export function adaptGitHubWebhook(payload: Record<string, unknown>): Trigger {
  const action = payload.action as string || 'unknown';
  const repoName = (payload.repository as Record<string, unknown>)?.full_name as string || 'unknown';

  return {
    type: 'webhook',
    source: `github:${action}`,
    payload: {
      event_kind: `github:${action}`,
      message: `GitHub event: ${action} on ${repoName}`,
      data: payload,
    },
    timestamp: Date.now(),
    session_id: `gh_${Date.now()}`,
  };
}

export function adaptGenericWebhook(payload: Record<string, unknown>, source: string): Trigger {
  return {
    type: 'webhook',
    source,
    payload: {
      event_kind: (payload.event as string) || 'generic',
      data: payload,
    },
    timestamp: Date.now(),
    session_id: `webhook_${Date.now()}`,
  };
}
