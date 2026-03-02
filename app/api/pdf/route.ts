import { NextRequest, NextResponse } from 'next/server';
import { getPdf } from '@/lib/pdf-store';
import { handleOptions } from '@/lib/cors';

export async function OPTIONS() { return handleOptions(); }

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }

  const entry = getPdf(id);
  if (!entry) {
    return NextResponse.json({ error: 'PDF not found or expired' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(entry.buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(entry.filename)}"`,
    },
  });
}
