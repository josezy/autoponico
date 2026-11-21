import { NextResponse } from 'next/server';

import { apiError, assertUuid, ValidationError } from '@/lib/itineraries/api';
import { PHOTO_CONTENT_TYPES, PHOTO_MAX_BYTES, getPhotoStorage } from '@/lib/itineraries/photos';
import { getItinerary, recordStoredPhoto } from '@/lib/itineraries/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertUuid(params.id, 'Itinerary');
    const itinerary = await getItinerary(params.id);
    if (!itinerary) throw new Error('Itinerary not found');
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new ValidationError('Choose an image');
    if (!PHOTO_CONTENT_TYPES.has(file.type)) throw new ValidationError('Use a JPEG, PNG, WEBP, or GIF');
    if (file.size > PHOTO_MAX_BYTES) throw new ValidationError('Images must be 5 MB or smaller');
    const body = Buffer.from(await file.arrayBuffer());
    const stored = await getPhotoStorage().put({
      itineraryId: params.id,
      filename: file.name || 'photo',
      contentType: file.type,
      body,
    });
    await recordStoredPhoto(params.id, stored.key, stored.contentType, stored.byteSize);
    const url = await getPhotoStorage().urlFor(stored.key);
    return NextResponse.json({ key: stored.key, url }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
