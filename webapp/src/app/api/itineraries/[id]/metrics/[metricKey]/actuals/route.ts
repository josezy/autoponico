import { NextResponse } from 'next/server';

import { apiError, assertDate, assertUuid, optionalNumber, optionalText, readBody, ValidationError } from '@/lib/itineraries/api';
import { addMetricActual } from '@/lib/itineraries/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string; metricKey: string } }) {
  try {
    assertUuid(params.id, 'Itinerary');
    if (!/^[a-z0-9-]{1,80}$/.test(params.metricKey)) throw new ValidationError('Unknown metric');
    const body = await readBody(request);
    await addMetricActual(
      params.id,
      params.metricKey,
      assertDate(body.recordedOn, 'Date'),
      optionalNumber(body.value),
      optionalText(body.notes),
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
