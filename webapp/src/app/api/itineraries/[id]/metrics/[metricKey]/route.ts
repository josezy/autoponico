import { NextResponse } from 'next/server';

import { apiError, assertUuid, optionalNumber, readBody, ValidationError } from '@/lib/itineraries/api';
import { updateMetricExpected } from '@/lib/itineraries/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string; metricKey: string } }) {
  try {
    assertUuid(params.id, 'Itinerary');
    if (!/^[a-z0-9-]{1,80}$/.test(params.metricKey)) throw new ValidationError('Unknown metric');
    const body = await readBody(request);
    await updateMetricExpected(params.id, params.metricKey, {
      expectedValue: optionalNumber(body.expectedValue),
      expectedMin: optionalNumber(body.expectedMin),
      expectedMax: optionalNumber(body.expectedMax),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
