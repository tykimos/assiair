import { LIMITS } from '../../config/limits';

interface SandboxResult {
  ok: boolean;
  result?: string;
  error?: string;
}

// Server-side: Python execution is not available
// This is a placeholder that returns an informative message
// In production, this would use Pyodide in a Web Worker (client-side)
export async function pythonExecute(code: string): Promise<SandboxResult> {
  // Server-side stub
  return {
    ok: false,
    error: 'Python execution is only available in the browser via Pyodide. Server-side Python execution is not supported in v1.',
  };
}

// Lazy-load status
let pyodideLoaded = false;

export function isPyodideLoaded(): boolean {
  return pyodideLoaded;
}

export async function loadPyodide(): Promise<boolean> {
  // This would be implemented in the browser worker
  // For now, return false on server
  if (typeof window === 'undefined') {
    return false;
  }
  // Browser implementation would load Pyodide here
  pyodideLoaded = true;
  return true;
}
