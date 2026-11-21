import { NextResponse } from 'next/server';

import { isISODate } from './dates';
import { DatabaseConfigError } from './db';
import { getTemplate } from './templates';
import type { MetricOverride } from './types';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function apiError(error: unknown) {
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof DatabaseConfigError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof Error && /not found/i.test(error.message)) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  console.error(error);
  return NextResponse.json({ error: 'Request failed' }, { status: 500 });
}

export function assertUuid(value: string, label: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ValidationError(`${label} is invalid`);
  }
}

export function assertDate(value: unknown, label: string): string {
  if (typeof value !== 'string' || !isISODate(value)) throw new ValidationError(`${label} must be a YYYY-MM-DD date`);
  return value;
}

export function optionalNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new ValidationError('Expected a number');
  return parsed;
}

export function optionalText(value: unknown, max = 2000): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function stringList(value: unknown, allowed: string[]): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && allowed.includes(item));
}

export function readParameters(templateId: string, raw: unknown): Record<string, unknown> {
  const template = getTemplate(templateId);
  if (!template) throw new ValidationError('Unknown template');
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const parameters: Record<string, unknown> = {};
  for (const parameter of template.parameters) {
    const value = source[parameter.key];
    if (value === undefined) continue;
    if (parameter.type === 'boolean') {
      parameters[parameter.key] = value === true || value === 'true';
    } else if (parameter.type === 'number') {
      const parsed = optionalNumber(value);
      if (parsed != null) parameters[parameter.key] = parsed;
    } else if (parameter.type === 'select') {
      if (typeof value === 'string' && parameter.options?.some((option) => option.value === value)) {
        parameters[parameter.key] = value;
      }
    } else if (typeof value === 'string') {
      parameters[parameter.key] = value.trim().slice(0, 200);
    }
  }
  return parameters;
}

export function readMetricOverrides(templateId: string, raw: unknown): Record<string, MetricOverride> {
  const template = getTemplate(templateId);
  if (!template) throw new ValidationError('Unknown template');
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const overrides: Record<string, MetricOverride> = {};
  for (const metric of template.metrics) {
    const value = source[metric.key];
    if (!value || typeof value !== 'object') continue;
    const record = value as Record<string, unknown>;
    overrides[metric.key] = {
      expectedValue: optionalNumber(record.expectedValue),
      expectedMin: optionalNumber(record.expectedMin),
      expectedMax: optionalNumber(record.expectedMax),
    };
  }
  return overrides;
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Expected a JSON object');
  }
  return body as Record<string, unknown>;
}

export function readRoutineEnabled(templateId: string, raw: unknown): Record<string, boolean> {
  const template = getTemplate(templateId);
  if (!template) throw new ValidationError('Unknown template');
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const enabled: Record<string, boolean> = {};
  for (const routine of template.routines) {
    if (routine.key in source) enabled[routine.key] = source[routine.key] === true;
  }
  return enabled;
}
