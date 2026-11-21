import { NextResponse } from 'next/server';

import { apiError, assertDate, assertUuid, optionalNumber, optionalText, readBody, ValidationError } from '@/lib/itineraries/api';
import { createCloneBatch } from '@/lib/itineraries/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function roundOrNull(value: number | null): number | null {
  return value == null ? null : Math.round(value);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertUuid(params.id, 'Itinerary');
    const body = await readBody(request);
    const cuttingsCount = optionalNumber(body.cuttingsCount);
    if (cuttingsCount == null || cuttingsCount < 1 || cuttingsCount > 200 || !Number.isInteger(cuttingsCount)) {
      throw new ValidationError('Cuttings must be a whole number from 1 to 200');
    }
    const id = await createCloneBatch(params.id, {
      cutDate: assertDate(body.cutDate, 'Cut date'),
      cuttingsCount,
      rootingAgent: optionalText(body.rootingAgent, 200),
      method: optionalText(body.method, 200),
      domeHumidity: optionalNumber(body.domeHumidity),
      goalCount: roundOrNull(optionalNumber(body.goalCount)),
      goalRootingPct: optionalNumber(body.goalRootingPct),
      goalDays: roundOrNull(optionalNumber(body.goalDays)),
      notes: optionalText(body.notes),
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
