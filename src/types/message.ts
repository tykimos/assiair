export type MessageType = 'user' | 'hook' | 'orchestrator' | 'execution';

export interface BuildingStep {
  step: string;
  status: 'pending' | 'running' | 'done';
  ok?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  messageType?: MessageType;
  promptButtons?: string[];
  signals?: import('./skill').ExecutionSignals;
  timestamp: Date;
  isStreaming?: boolean;
  skillId?: string;
  buildingSteps?: BuildingStep[];
  thinking?: string;
}

export interface StreamChunk {
  type: 'content' | 'tool_call' | 'tool_result' | 'done' | 'error';
  data: unknown;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}
