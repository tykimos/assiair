import { getContextProviderRegistry } from '@/context/context-registry';
import { PDFDocument, rgb, PDFFont } from 'pdf-lib';
import { storePdf } from '@/lib/pdf-store';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Supabase client for document numbering
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

// ---------------------------------------------------------------------------
// Fallback in-memory counter (used only when Supabase is unavailable)
// ---------------------------------------------------------------------------
let documentCounter = 0;

async function getNextDocumentNumber(meta: {
  recipient_org: string;
  recipient_name?: string;
  requester_token?: string;
  filename: string;
}): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) {
    documentCounter++;
    return String(documentCounter).padStart(4, '0');
  }

  // Insert a new row; DB assigns seq via next_doc_seq()
  const { data, error } = await supabase.rpc('next_doc_seq');
  if (error || data == null) {
    console.warn('[generate-document] next_doc_seq RPC failed, using fallback:', error?.message);
    documentCounter++;
    return String(documentCounter).padStart(4, '0');
  }

  const seq = data as number;
  const docNumber = `AIF-A2602${String(seq).padStart(4, '0')}`;

  // Record the document in the documents table
  const { error: insertError } = await supabase.from('documents').insert({
    doc_number: docNumber,
    seq,
    document_type: 'official_letter',
    recipient_org: meta.recipient_org,
    recipient_name: meta.recipient_name || null,
    requester_token: meta.requester_token || null,
    filename: meta.filename,
  });

  if (insertError) {
    console.warn('[generate-document] Failed to insert document record:', insertError.message);
  }

  return String(seq).padStart(4, '0');
}

// ---------------------------------------------------------------------------
// Asset cache
// ---------------------------------------------------------------------------
let assetsLoaded = false;
let regularFontBytes: Buffer | null = null;
let boldFontBytes: Buffer | null = null;
let templatePdfBytes: Buffer | null = null;

function loadAssets(): void {
  if (assetsLoaded) return;
  if (typeof window !== 'undefined') { assetsLoaded = true; return; }
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    /* eslint-enable @typescript-eslint/no-require-imports */
    const assetsDir = path.join(process.cwd(), 'src', 'assets');
    try {
      regularFontBytes = fs.readFileSync(path.join(assetsDir, 'fonts', 'NotoSansKR-Regular.otf'));
      boldFontBytes = fs.readFileSync(path.join(assetsDir, 'fonts', 'NotoSansKR-Bold.otf'));
    } catch (e) {
      console.warn('[generate-document] Korean fonts not found:', e);
    }
    try {
      templatePdfBytes = fs.readFileSync(path.join(assetsDir, 'official-letter-template.pdf'));
    } catch {
      console.warn('[generate-document] Template PDF not found');
    }
  } catch {
    console.warn('[generate-document] Node.js modules not available (client-side)');
  }
  assetsLoaded = true;
}

// ---------------------------------------------------------------------------
// Structured data for official letter
// ---------------------------------------------------------------------------
interface OfficialLetterData {
  document_type: 'official_letter';
  recipient_org: string;
  recipient_name?: string;
}

// ---------------------------------------------------------------------------
// Template-based: white-out $A$ and $B$ areas and overlay replacement text
//
// Content stream analysis (cm transforms give page coordinates, bottom-left origin):
//   $A$ (문서번호 값): 0.12 0 0 -0.12 134.28 668.36 cm  — full text "AIF-A2602$A$"
//   $B$ (수신자 값):   0.12 0 0 -0.12 134.28 620 cm     — text "$B$"
//   Both use font scale 0.12 × 100 = 12pt effective size
//   Negative y-scale means text origin is at TOP of cell, text extends downward
// ---------------------------------------------------------------------------
async function generateOfficialLetterPdf(
  data: OfficialLetterData,
  filename: string,
  requesterToken?: string,
): Promise<Uint8Array> {
  loadAssets();

  if (!templatePdfBytes) {
    throw new Error('Template PDF not found');
  }

  const pdfDoc = await PDFDocument.load(templatePdfBytes);

  // Embed fonts: Helvetica for ASCII (doc number), Korean font for recipient
  const { StandardFonts } = await import('pdf-lib');
  const latinFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let koreanFont: PDFFont;
  if (regularFontBytes) {
    const fontkit = (await import('@pdf-lib/fontkit')).default;
    pdfDoc.registerFontkit(fontkit);
    koreanFont = await pdfDoc.embedFont(regularFontBytes);
  } else {
    koreanFont = latinFont;
  }

  const page = pdfDoc.getPages()[0];
  const white = rgb(1, 1, 1);
  const black = rgb(0, 0, 0);
  const fontSize = 12;

  // ─── $A$: 문서번호 값 ─────────────────────────────────────────────
  // Row clip: y=660.44..684.68, separator line at y≈684.5
  // White-out only within the row (avoid covering separator line above)
  page.drawRectangle({
    x: 129, y: 660, width: 423, height: 23,
    color: white,
  });
  const seqStr = await getNextDocumentNumber({
    recipient_org: data.recipient_org,
    recipient_name: data.recipient_name,
    requester_token: requesterToken,
    filename,
  });
  const docNum = `AIF-A2602${seqStr}`;
  page.drawText(docNum, {
    x: 134.28, y: 668, size: fontSize, font: latinFont, color: black,
  });

  // ─── $B$: 수신자 값 ───────────────────────────────────────────────
  // Row clip: y=612.2..636.32
  page.drawRectangle({
    x: 129, y: 612, width: 423, height: 23,
    color: white,
  });
  const recipientText = data.recipient_name
    ? `${data.recipient_org} ${data.recipient_name} 귀하`
    : `${data.recipient_org} 귀하`;
  page.drawText(recipientText, {
    x: 134.28, y: 620, size: fontSize, font: koreanFont, color: black,
  });

  return pdfDoc.save();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function generateDocumentTool(
  type: string,
  content: string,
  filename: string
): Promise<{ ok: boolean; download_url?: string; filename?: string; error?: string }> {
  // 1. Try configured service endpoint first
  try {
    const registry = getContextProviderRegistry();
    const endpoints = registry.getAllEndpoints();
    const docEndpoint = endpoints.find(e => e.category === 'document');

    if (docEndpoint) {
      const result = await registry.callEndpoint(docEndpoint.id, { type, content, filename });
      const resultData = result as Record<string, unknown>;
      return {
        ok: true,
        download_url: (resultData.download_url as string) || (resultData.url as string) || '',
        filename: (resultData.filename as string) || filename,
      };
    }
  } catch (endpointError) {
    console.warn('[generate-document] Service endpoint failed, trying local fallback:', endpointError);
  }

  // 2. Fallback: local PDF generation
  if (type !== 'pdf') {
    return { ok: false, error: `로컬 문서 생성은 현재 PDF 형식만 지원합니다. (요청: ${type})` };
  }

  try {
    // Detect structured official letter JSON
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      // not JSON
    }

    if (!parsed || parsed.document_type !== 'official_letter') {
      return { ok: false, error: '현재 공문(official_letter) 형식만 지원합니다.' };
    }

    const pdfBytes = await generateOfficialLetterPdf(
      parsed as unknown as OfficialLetterData,
      filename,
    );

    const base64 = Buffer.from(pdfBytes).toString('base64');
    const dataUrl = `data:application/pdf;base64,${base64}`;
    const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

    // Store PDF server-side and return a short download URL
    const pdfId = storePdf(dataUrl, safeFilename);
    const downloadUrl = `/api/pdf?id=${pdfId}`;

    return { ok: true, download_url: downloadUrl, filename: safeFilename };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'PDF generation failed',
    };
  }
}
