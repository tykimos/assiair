import type { ChatMessage, Plan, ConversationMessage } from '@/types';

interface SessionState {
  sessionId: string;
  messages: ChatMessage[];
  conversationHistory: ConversationMessage[];
  currentPlan: Plan | null;
  turnCount: number;
  createdAt: Date;
  lastActiveAt: Date;
}

const sessions = new Map<string, SessionState>();

export function createSession(sessionId?: string): SessionState {
  const id = sessionId || `session_${Date.now()}`;
  const session: SessionState = {
    sessionId: id,
    messages: [],
    conversationHistory: [],
    currentPlan: null,
    turnCount: 0,
    createdAt: new Date(),
    lastActiveAt: new Date(),
  };
  sessions.set(id, session);
  return session;
}

export function getSession(sessionId: string): SessionState | undefined {
  return sessions.get(sessionId);
}

export function updateSession(sessionId: string, updates: Partial<SessionState>): SessionState | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  const updated = { ...session, ...updates, lastActiveAt: new Date() };
  sessions.set(sessionId, updated);
  return updated;
}

export function getConversationSummary(sessionId: string): { summary: string; turn_count: number; open_questions: string[] } | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;

  const recentMessages = session.messages.slice(-6);
  const summary = recentMessages
    .map(m => `${m.role}: ${m.content.slice(0, 100)}`)
    .join('\n');

  return {
    summary,
    turn_count: session.turnCount,
    open_questions: [],
  };
}

export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

// ---------------------------------------------------------------------------
// Supabase-backed session persistence (client-side via API routes)
// ---------------------------------------------------------------------------

export interface SessionSavePayload {
  session_id: string;
  app?: string;
  user?: string;
  messages: unknown[];
  config_snapshot: unknown;
  logs: unknown[];
  turn_count: number;
}

export interface SessionListItem {
  id: string;
  session_id: string;
  app: string;
  user: string;
  turn_count: number;
  created_at: string;
  updated_at: string;
}

export interface SessionDetail {
  id: string;
  session_id: string;
  app: string;
  user: string;
  messages: unknown[];
  config_snapshot: unknown;
  logs: unknown[];
  turn_count: number;
  created_at: string;
  updated_at: string;
}

/** Save or update session to Supabase */
export async function saveSessionToDb(payload: SessionSavePayload): Promise<boolean> {
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    console.warn('[SessionStore] Failed to save session to DB');
    return false;
  }
}

/** List sessions for app/user */
export async function listSessionsFromDb(app: string = 'default', user: string = 'anonymous'): Promise<SessionListItem[]> {
  try {
    const res = await fetch(`/api/sessions?app=${encodeURIComponent(app)}&user=${encodeURIComponent(user)}`);
    if (!res.ok) return [];
    const { data } = await res.json();
    return data || [];
  } catch {
    console.warn('[SessionStore] Failed to list sessions from DB');
    return [];
  }
}

/** Load a specific session from Supabase */
export async function loadSessionFromDb(sessionId: string): Promise<SessionDetail | null> {
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`);
    if (!res.ok) return null;
    const { data } = await res.json();
    return data || null;
  } catch {
    console.warn('[SessionStore] Failed to load session from DB');
    return null;
  }
}

/** Delete a session from Supabase */
export async function deleteSessionFromDb(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    console.warn('[SessionStore] Failed to delete session from DB');
    return false;
  }
}
