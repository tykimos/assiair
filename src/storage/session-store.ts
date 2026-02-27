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
