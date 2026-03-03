import { NextRequest, NextResponse } from 'next/server';
import { getImage } from '@/lib/image-store';
import { handleOptions } from '@/lib/cors';

export async function OPTIONS() { return handleOptions(); }

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }

  const entry = getImage(id);
  if (!entry) {
    return NextResponse.json({ error: 'Image not found or expired' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(entry.buffer), {
    headers: {
      'Content-Type': entry.contentType,
      'Cache-Control': 'public, max-age=1800',
    },
  });
}
