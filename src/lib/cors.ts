import { NextResponse } from 'next/server';

const ALLOWED_ORIGINS = process.env.ASSIAIR_ALLOWED_ORIGINS || '*';

/** Add CORS headers to a NextResponse */
export function withCors(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGINS);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

/** Handle OPTIONS preflight request */
export function handleOptions(): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }));
}
