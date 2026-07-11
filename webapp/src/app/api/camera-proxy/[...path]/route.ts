import { NextRequest, NextResponse } from 'next/server';

const CAMERA_ORIGIN = process.env.NEXT_PUBLIC_CAMERA_URL || 'https://cameras.tucanorobotics.co';

export const dynamic = 'force-dynamic';

async function proxyRequest(request: NextRequest, path: string[]) {
  const targetUrl = `${CAMERA_ORIGIN}/${path.join('/')}${request.nextUrl.search}`;

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers: request.headers.get('Content-Type')
      ? { 'Content-Type': request.headers.get('Content-Type')! }
      : undefined,
    body: request.method !== 'GET' && request.method !== 'HEAD'
      ? await request.arrayBuffer()
      : undefined,
    cache: 'no-store',
  });

  const headers = new Headers({ 'Cache-Control': 'no-cache' });
  const contentType = upstream.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);

  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return proxyRequest(request, params.path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return proxyRequest(request, params.path);
}
