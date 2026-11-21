import { NextResponse } from 'next/server';

import { apiError, assertUuid, readBody, ValidationError } from '@/lib/itineraries/api';
import { setItineraryStatus } from '@/lib/itineraries/repository';
import type { ItineraryStatus } from '@/lib/itineraries/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const statuses: ItineraryStatus[] = ['active', 'paused', 'archived'];

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertUuid(params.id, 'Itinerary');
    const body = await readBody(request);
    if (typeof body.status !== 'string' || !statuses.includes(body.status as ItineraryStatus)) {
      throw new ValidationError('Status must be active, paused, or archived');
    }
    await setItineraryStatus(params.id, body.status as ItineraryStatus);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
