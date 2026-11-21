import { NextResponse } from 'next/server';

import { apiError, assertUuid, optionalNumber, optionalText, readBody, ValidationError } from '@/lib/itineraries/api';
import { updateClone } from '@/lib/itineraries/repository';
import type { CloneStatus } from '@/lib/itineraries/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const statuses: CloneStatus[] = ['pending', 'rooted', 'no_root', 'wilted'];

export async function POST(request: Request, { params }: { params: { id: string; cloneId: string } }) {
  try {
    assertUuid(params.id, 'Itinerary');
    assertUuid(params.cloneId, 'Clone');
    const body = await readBody(request);
    if (typeof body.status !== 'string' || !statuses.includes(body.status as CloneStatus)) {
      throw new ValidationError('Unknown clone status');
    }
    const rootedDay = optionalNumber(body.rootedDay);
    await updateClone(params.id, params.cloneId, {
      status: body.status as CloneStatus,
      rootedDay: rootedDay == null ? null : Math.round(rootedDay),
      notes: optionalText(body.notes),
      photoKey: optionalText(body.photoKey, 300),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
