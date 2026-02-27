import type { Trigger } from '@/types';

let sessionCounter = 0;

export function createUserMessageTrigger(message: string, sessionId?: string): Trigger {
  return {
    type: 'user_message',
    source: 'chat_input',
    payload: { message },
    timestamp: Date.now(),
    session_id: sessionId || `session_${Date.now()}_${++sessionCounter}`,
  };
}

export function createButtonClickTrigger(label: string, sessionId: string): Trigger {
  return {
    type: 'button_click',
    source: 'prompt_button',
    payload: { message: label },
    timestamp: Date.now(),
    session_id: sessionId,
  };
}

export function createSystemEventTrigger(eventKind: string, data?: Record<string, unknown>): Trigger {
  return {
    type: 'system_event',
    source: 'system',
    payload: { event_kind: eventKind, data },
    timestamp: Date.now(),
    session_id: `system_${Date.now()}`,
  };
}
