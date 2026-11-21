import { NextResponse } from 'next/server';

import { apiError, assertDate, assertUuid, optionalNumber, optionalText, readBody, stringList } from '@/lib/itineraries/api';
import { addDailyLog, getItinerary } from '@/lib/itineraries/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertUuid(params.id, 'Itinerary');
    const itinerary = await getItinerary(params.id);
    if (!itinerary) throw new Error('Itinerary not found');
    const body = await readBody(request);
    const nodes = optionalNumber(body.nodes);
    await addDailyLog(params.id, {
      logDate: assertDate(body.logDate, 'Date'),
      photoKey: optionalText(body.photoKey, 300),
      heightCm: optionalNumber(body.heightCm),
      nodes: nodes == null ? null : Math.round(nodes),
      wateringMl: optionalNumber(body.wateringMl),
      ph: optionalNumber(body.ph),
      ec: optionalNumber(body.ec),
      tempC: optionalNumber(body.tempC),
      humidityPct: optionalNumber(body.humidityPct),
      actions: stringList(body.actions, itinerary.features.suggestedActions),
      issues: stringList(body.issues, itinerary.features.suggestedIssues),
      notes: optionalText(body.notes),
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
