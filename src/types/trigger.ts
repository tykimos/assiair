export interface Trigger {
  type: 'user_message' | 'button_click' | 'webhook' | 'system_event' | 'schedule';
  source: string;
  payload: {
    message?: string;
    event_kind?: string;
    data?: Record<string, unknown>;
  };
  timestamp: number;
  session_id: string;
}
