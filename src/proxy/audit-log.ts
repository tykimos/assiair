interface AuditEntry {
  timestamp: Date;
  ip: string;
  method: string;
  path: string;
  statusCode: number;
  latencyMs: number;
  userId?: string;
}

const auditLog: AuditEntry[] = [];
const MAX_ENTRIES = 10000;

export function logAuditEntry(entry: AuditEntry): void {
  auditLog.push(entry);
  if (auditLog.length > MAX_ENTRIES) {
    auditLog.splice(0, auditLog.length - MAX_ENTRIES);
  }
}

export function getAuditLog(limit: number = 100): AuditEntry[] {
  return auditLog.slice(-limit);
}

export function clearAuditLog(): void {
  auditLog.length = 0;
}
