import { NextResponse } from 'next/server';

import { apiError, assertUuid, optionalText, readBody, ValidationError } from '@/lib/itineraries/api';
import { setTaskStatus } from '@/lib/itineraries/repository';
import type { TaskStatus } from '@/lib/itineraries/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const statuses: TaskStatus[] = ['pending', 'done', 'skipped'];

export async function POST(request: Request, { params }: { params: { id: string; taskId: string } }) {
  try {
    assertUuid(params.id, 'Itinerary');
    assertUuid(params.taskId, 'Task');
    const body = await readBody(request);
    if (typeof body.status !== 'string' || !statuses.includes(body.status as TaskStatus)) {
      throw new ValidationError('Status must be pending, done, or skipped');
    }
    await setTaskStatus(params.id, params.taskId, body.status as TaskStatus, optionalText(body.notes));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
