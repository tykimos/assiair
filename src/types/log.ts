import type { ExecutionSignals } from './skill';

export type LogCategory = 'ORCH' | 'EXEC' | 'TOOL' | 'SIGNAL' | 'POST';
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  id: string;
  timestamp: Date;
  category: LogCategory;
  level: LogLevel;
  message: string;
  data?: unknown;
}

export interface TurnTrace {
  trigger_type: string;
  workflow_id: string | null;
  skill_id: string;
  tool_count: number;
  signals: ExecutionSignals;
  latency_ms: number;
  orch_latency_ms: number;
  exec_latency_ms: number;
  exec_ttft_ms: number;
  timestamp: Date;
}
