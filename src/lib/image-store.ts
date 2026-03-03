/**
 * Temporary file-system store for generated images (QR codes etc.).
 * Images are saved as temp files and expire after 30 minutes.
 * Same pattern as pdf-store.ts.
 */

const TTL_MS = 30 * 60 * 1000; // 30 minutes

let counter = 0;

function getStoreDir(): string {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const path = require('path') as typeof import('path');
  const os = require('os') as typeof import('os');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return path.join(os.tmpdir(), 'assiair-image-store');
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
          const imgPath = filePath.replace('.json', `.${meta.ext || 'png'}`);
          if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        }
      } catch { /* skip */ }
    }
  } catch { /* dir might not exist */ }
}

export function storeImage(dataUrl: string): string {
  if (typeof window !== 'undefined') return '';
  /* eslint-disable @typescript-eslint/no-require-imports */
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  /* eslint-enable @typescript-eslint/no-require-imports */
  ensureDir();
  cleanup();

  const id = `img_${Date.now()}_${++counter}`;

  // Parse data URL: data:image/png;base64,xxxxx
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  const ext = match?.[1] || 'png';
  const base64 = match?.[2] || dataUrl;
  const buffer = Buffer.from(base64, 'base64');
  const dir = getStoreDir();

  fs.writeFileSync(path.join(dir, `${id}.${ext}`), buffer);
  fs.writeFileSync(
    path.join(dir, `${id}.json`),
    JSON.stringify({ ext, createdAt: Date.now() })
  );

  return id;
}

export function getImage(id: string): { buffer: Buffer; contentType: string } | undefined {
  if (typeof window !== 'undefined') return undefined;
  /* eslint-disable @typescript-eslint/no-require-imports */
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const dir = getStoreDir();
  const metaPath = path.join(dir, `${id}.json`);

  if (!fs.existsSync(metaPath)) return undefined;

  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    if (Date.now() - meta.createdAt > TTL_MS) {
      fs.unlinkSync(metaPath);
      const imgPath = path.join(dir, `${id}.${meta.ext}`);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      return undefined;
    }
    const imgPath = path.join(dir, `${id}.${meta.ext}`);
    if (!fs.existsSync(imgPath)) return undefined;
    return { buffer: fs.readFileSync(imgPath), contentType: `image/${meta.ext}` };
  } catch {
    return undefined;
  }
}
