import { NextResponse } from 'next/server';

import { getPhotoStorage } from '@/lib/itineraries/photos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { key: string[] } }) {
  const key = params.key.map((part) => decodeURIComponent(part)).join('/');
  try {
    const photo = await getPhotoStorage().get(key);
    if (!photo) return new NextResponse('Not found', { status: 404 });
    return new NextResponse(new Uint8Array(photo.body), {
      headers: {
        'Content-Type': photo.contentType,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
