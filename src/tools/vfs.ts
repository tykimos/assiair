import { LIMITS } from '../../config/limits';

interface VfsResult {
  ok: boolean;
  data?: string | string[];
  error?: string;
}

const fileStore = new Map<string, string>();

function sanitizePath(path: string): string {
  // Prevent directory traversal
  return path.replace(/\.\./g, '').replace(/\/+/g, '/');
}

export async function vfs_read(path: string): Promise<VfsResult> {
  const safePath = sanitizePath(path);
  const content = fileStore.get(safePath);
  if (content === undefined) {
    return { ok: false, error: `File not found: ${safePath}` };
  }
  return { ok: true, data: content };
}

export async function vfs_write(path: string, content: string): Promise<VfsResult> {
  const safePath = sanitizePath(path);
  if (new TextEncoder().encode(content).length > LIMITS.VFS_MAX_FILE_BYTES) {
    return { ok: false, error: `File exceeds max size of ${LIMITS.VFS_MAX_FILE_BYTES} bytes` };
  }
  fileStore.set(safePath, content);
  return { ok: true, data: `Written to ${safePath}` };
}

export async function vfs_list(directory: string): Promise<VfsResult> {
  const safeDir = sanitizePath(directory);
  const files = Array.from(fileStore.keys()).filter(f => f.startsWith(safeDir));
  return { ok: true, data: files };
}

export async function vfs_delete(path: string): Promise<VfsResult> {
  const safePath = sanitizePath(path);
  if (!fileStore.has(safePath)) {
    return { ok: false, error: `File not found: ${safePath}` };
  }
  fileStore.delete(safePath);
  return { ok: true, data: `Deleted ${safePath}` };
}

// For testing: preload files
export function vfs_preload(files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    fileStore.set(sanitizePath(path), content);
  }
}

export function vfs_clear(): void {
  fileStore.clear();
}
