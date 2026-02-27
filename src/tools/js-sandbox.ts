import { LIMITS } from '../../config/limits';

interface SandboxResult {
  ok: boolean;
  result?: string;
  error?: string;
}

export async function jsExecute(code: string): Promise<SandboxResult> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ ok: false, error: `Execution timed out after ${LIMITS.JS_TIMEOUT_MS}ms` });
    }, LIMITS.JS_TIMEOUT_MS);

    try {
      const logs: string[] = [];
      const mockConsole = {
        log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
        error: (...args: unknown[]) => logs.push('[ERROR] ' + args.map(String).join(' ')),
        warn: (...args: unknown[]) => logs.push('[WARN] ' + args.map(String).join(' ')),
      };

      // Create a sandboxed function
      const fn = new Function('console', code);
      const result = fn(mockConsole);

      clearTimeout(timeout);

      const output = logs.length > 0 ? logs.join('\n') : String(result ?? 'undefined');
      resolve({ ok: true, result: output });
    } catch (error) {
      clearTimeout(timeout);
      resolve({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
}
