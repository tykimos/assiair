import type { LogCategory, LogLevel, LogEntry, TurnTrace } from '@/types';
import { LIMITS } from '../../config/limits';

type LogCallback = (entry: LogEntry) => void;
type TraceCallback = (trace: TurnTrace) => void;

let entryIdCounter = 0;

function generateId(): string {
  return `log_${Date.now()}_${++entryIdCounter}`;
}

export class AgentLogger {
  private listeners = new Set<LogCallback>();
  private traceListeners = new Set<TraceCallback>();
  private entries: LogEntry[] = [];
  private maxEntries = 1000;

  subscribe(callback: LogCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  subscribeTrace(callback: TraceCallback): () => void {
    this.traceListeners.add(callback);
    return () => {
      this.traceListeners.delete(callback);
    };
  }

  log(category: LogCategory, level: LogLevel, message: string, data?: unknown): void {
    const entry: LogEntry = {
      id: generateId(),
      timestamp: new Date(),
      category,
      level,
      message,
      data,
    };

    this.entries.push(entry);

    // Trim old entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch (e) {
        console.error('[AgentLogger] Listener error:', e);
      }
    }
  }

  emitTrace(trace: TurnTrace): void {
    for (const listener of this.traceListeners) {
      try {
        listener(trace);
      } catch (e) {
        console.error('[AgentLogger] Trace listener error:', e);
      }
    }

    // Also log as a regular entry
    this.log('SIGNAL', 'info', `TurnTrace: ${trace.skill_id}`, {
      latency_ms: trace.latency_ms,
      orch_latency_ms: trace.orch_latency_ms,
      exec_latency_ms: trace.exec_latency_ms,
      tool_count: trace.tool_count,
    });
  }

  // Convenience methods
  orch(message: string, data?: unknown): void {
    this.log('ORCH', 'info', message, data);
  }

  exec(message: string, data?: unknown): void {
    this.log('EXEC', 'info', message, data);
  }

  tool(message: string, data?: unknown): void {
    this.log('TOOL', 'info', message, data);
  }

  signal(message: string, data?: unknown): void {
    this.log('SIGNAL', 'info', message, data);
  }

  post(message: string, data?: unknown): void {
    this.log('POST', 'info', message, data);
  }

  // Latency monitoring
  warnIfSlow(category: 'ORCH' | 'EXEC', latencyMs: number): void {
    if (category === 'ORCH' && latencyMs > LIMITS.ORCH_LATENCY_TARGET_MS) {
      this.log('ORCH', 'warn',
        `Orchestrator latency ${latencyMs}ms exceeds target ${LIMITS.ORCH_LATENCY_TARGET_MS}ms`,
        { latency_ms: latencyMs, target_ms: LIMITS.ORCH_LATENCY_TARGET_MS }
      );
    }
    if (category === 'EXEC' && latencyMs > LIMITS.EXEC_TTFT_TARGET_MS) {
      this.log('EXEC', 'warn',
        `Executor TTFT ${latencyMs}ms exceeds target ${LIMITS.EXEC_TTFT_TARGET_MS}ms`,
        { latency_ms: latencyMs, target_ms: LIMITS.EXEC_TTFT_TARGET_MS }
      );
    }
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  getEntriesByCategory(category: LogCategory): LogEntry[] {
    return this.entries.filter(e => e.category === category);
  }

  clear(): void {
    this.entries = [];
  }
}
