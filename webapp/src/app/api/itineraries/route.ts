import { NextResponse } from 'next/server';

import {
  apiError,
  assertDate,
  optionalNumber,
  optionalText,
  readBody,
  readMetricOverrides,
  readParameters,
  readRoutineEnabled,
  ValidationError,
} from '@/lib/itineraries/api';
import { createItinerary } from '@/lib/itineraries/repository';
import { getTemplate } from '@/lib/itineraries/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const templateId = typeof body.templateId === 'string' ? body.templateId : '';
    const template = getTemplate(templateId);
    if (!template) throw new ValidationError('Unknown template');
    const name = optionalText(body.name, 120);
    if (!name) throw new ValidationError('Name is required');
    const quantity = optionalNumber(body.quantity) ?? template.defaultQuantity;
    if (quantity < 0) throw new ValidationError('Quantity cannot be negative');
    const id = await createItinerary({
      templateId,
      name,
      startDate: assertDate(body.startDate, 'Start date'),
      location: optionalText(body.location, 200) || template.defaultLocation,
      quantity,
      parameters: readParameters(templateId, body.parameters),
      metricOverrides: readMetricOverrides(templateId, body.metricOverrides),
      routineEnabled: readRoutineEnabled(templateId, body.routineEnabled),
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
