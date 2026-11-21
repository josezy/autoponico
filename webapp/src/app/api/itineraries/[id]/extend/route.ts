import { NextResponse } from 'next/server';

import { apiError, assertUuid } from '@/lib/itineraries/api';
import { extendItinerary } from '@/lib/itineraries/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    assertUuid(params.id, 'Itinerary');
    const horizonEnd = await extendItinerary(params.id);
    return NextResponse.json({ horizonEnd });
  } catch (error) {
    return apiError(error);
  }
}
