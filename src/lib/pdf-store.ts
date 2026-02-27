/**
 * File-system-based store for generated PDFs.
 * PDFs are saved as temp files and expire after 30 minutes.
 * Uses the filesystem instead of in-memory Map to survive module
 * re-evaluation in Next.js dev mode (Turbopack / HMR).
 *
 * Node.js modules (fs, path) are loaded dynamically to avoid
 * breaking the client-side bundle.
 */

const TTL_MS = 30 * 60 * 1000; // 30 minutes

let counter = 0;

function getStoreDir(): string {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const path = require('path') as typeof import('path');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return path.join(process.cwd(), '.next', 'pdf-store');
}

function ensureDir(): void {
  if (typeof window !== 'undefined') return;
  /* eslint-disable @typescript-eslint/no-require-imports */
  const fs = require('fs') as typeof import('fs');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const dir = getStoreDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function cleanup(): void {
  if (typeof window !== 'undefined') return;
  /* eslint-disable @typescript-eslint/no-require-imports */
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const dir = getStoreDir();
  const now = Date.now();
  try {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(dir, file);
      try {
        const meta = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (now - meta.createdAt > TTL_MS) {
          fs.unlinkSync(filePath);
          const pdfPath = filePath.replace('.json', '.pdf');
          if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
        }
      } catch {
        // Skip malformed entries
      }
    }
  } catch {
    // Directory might not exist yet
  }
}

export function storePdf(dataUrl: string, filename: string): string {
  if (typeof window !== 'undefined') return '';
  /* eslint-disable @typescript-eslint/no-require-imports */
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  /* eslint-enable @typescript-eslint/no-require-imports */
  ensureDir();
  cleanup();

  const id = `pdf_${Date.now()}_${++counter}`;
  const base64 = dataUrl.replace(/^data:application\/pdf;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  const dir = getStoreDir();

  fs.writeFileSync(path.join(dir, `${id}.pdf`), buffer);
  fs.writeFileSync(
    path.join(dir, `${id}.json`),
    JSON.stringify({ filename, createdAt: Date.now() })
  );

  return id;
}

export function getPdf(id: string): { buffer: Buffer; filename: string } | undefined {
  if (typeof window !== 'undefined') return undefined;
  /* eslint-disable @typescript-eslint/no-require-imports */
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const dir = getStoreDir();
  const metaPath = path.join(dir, `${id}.json`);
  const pdfPath = path.join(dir, `${id}.pdf`);

  if (!fs.existsSync(metaPath) || !fs.existsSync(pdfPath)) return undefined;

  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    if (Date.now() - meta.createdAt > TTL_MS) {
      fs.unlinkSync(metaPath);
      fs.unlinkSync(pdfPath);
      return undefined;
    }
    return { buffer: fs.readFileSync(pdfPath), filename: meta.filename };
  } catch {
    return undefined;
  }
}
