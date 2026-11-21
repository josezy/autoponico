import { addDays, addMonths, isoDate, monthOf, yearOf, yearsTouching } from './dates';
import type {
  CropPlanTemplate,
  MetricOverride,
  PhaseTemplate,
  TaskFrequency,
  TaskTemplate,
} from './types';

export type ExpandedPhase = {
  phaseKey: string;
  name: string;
  summary: string;
  tag: string | null;
  goal: string | null;
  sortOrder: number;
  startDate: string;
  endDate: string | null;
};

export type ExpandedTask = {
  taskKey: string;
  title: string;
  details: string;
  dueDate: string;
  scheduleLabel: string;
};

export type ExpandedMetric = {
  metricKey: string;
  name: string;
  unit: string | null;
  expectedValue: number | null;
  expectedMin: number | null;
  expectedMax: number | null;
  expectedText: string | null;
  perUnit: boolean;
  notes: string | null;
};

export type ExpandedRoutine = {
  routineKey: string;
  kind: string;
  title: string;
  schedule: string;
  enabled: boolean;
};

export type ExpandInput = {
  startDate: string;
  parameters?: Record<string, unknown>;
  /** Inclusive. Defaults to startDate. */
  windowStart?: string;
  /** Exclusive. Defaults to startDate + template.horizonDays. */
  windowEnd?: string;
  metricOverrides?: Record<string, MetricOverride>;
  routineEnabled?: Record<string, boolean>;
};

export type ExpandedPlan = {
  parameters: Record<string, unknown>;
  windowStart: string;
  horizonEnd: string;
  phases: ExpandedPhase[];
  tasks: ExpandedTask[];
  metrics: ExpandedMetric[];
  routines: ExpandedRoutine[];
};

export function applyParameterDefaults(
  template: CropPlanTemplate,
  parameters: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...parameters };
  for (const parameter of template.parameters) {
    if (merged[parameter.key] === undefined && parameter.defaultValue !== undefined) {
      merged[parameter.key] = parameter.defaultValue;
    }
  }
  if (template.deriveParameters) {
    Object.assign(merged, template.deriveParameters(merged));
  }
  return merged;
}

function whenMatches(when: { parameter: string; equals: string | number | boolean } | undefined, parameters: Record<string, unknown>): boolean {
  if (!when) return true;
  return parameters[when.parameter] === when.equals;
}

function numberParam(parameters: Record<string, unknown>, key: string | undefined, fallback: number): number {
  if (!key) return fallback;
  const value = parameters[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Day-of-month inside the window. Month-anchored work has no day in the source
 * plans, so the preferred day is 1. If the plan starts later that month, the
 * task moves to the first in-window day of that month.
 */
function dateInMonthWithinWindow(
  year: number,
  month: number,
  preferredDay: number,
  windowStart: string,
  windowEnd: string,
): string | null {
  const first = isoDate(year, month, 1);
  const next = addMonths(first, 1);
  if (next <= windowStart || first >= windowEnd) return null;
  const lastDay = Number(addDays(next, -1).slice(8, 10));
  let due = isoDate(year, month, Math.min(preferredDay, lastDay));
  if (due < windowStart) due = windowStart;
  if (due >= windowEnd || due >= next) return null;
  return due;
}

function datesForTask(
  frequency: TaskFrequency,
  anchorStart: string,
  windowStart: string,
  windowEnd: string,
  parameters: Record<string, unknown>,
): string[] {
  switch (frequency.kind) {
    case 'weekly':
      return stepDays(anchorStart, windowStart, windowEnd, 7, 0);
    case 'every_n_days': {
      const fromDay = numberParam(parameters, frequency.fromDayParam, frequency.fromDay ?? 0);
      const until = frequency.untilDay == null ? null : addDays(anchorStart, frequency.untilDay);
      return stepDays(anchorStart, windowStart, windowEnd, frequency.everyDays, fromDay, until);
    }
    case 'once_on_day': {
      const due = addDays(anchorStart, frequency.day);
      return due >= windowStart && due < windowEnd ? [due] : [];
    }
    case 'monthly':
      return eachMonth(windowStart, windowEnd, 1);
    case 'in_months':
      return monthsOfYear(frequency.months, 1, windowStart, windowEnd);
    case 'every_n_months':
      return everyNMonths(frequency.anchorMonth, frequency.months, frequency.day ?? 1, windowStart, windowEnd);
    case 'relative_every_months': {
      const dates: string[] = [];
      let due = addMonths(anchorStart, frequency.fromMonth);
      for (let i = 0; i < 48 && due < windowEnd; i += 1) {
        if (due >= windowStart) dates.push(due);
        due = addMonths(due, frequency.months);
      }
      return dates;
    }
    default:
      return [];
  }
}

function stepDays(
  anchorStart: string,
  windowStart: string,
  windowEnd: string,
  step: number,
  fromDay: number,
  untilExclusive: string | null = null,
): string[] {
  const dates: string[] = [];
  let due = addDays(anchorStart, fromDay);
  for (let i = 0; i < 2000 && due < windowEnd; i += 1) {
    if (untilExclusive && due >= untilExclusive) break;
    if (due >= windowStart) dates.push(due);
    due = addDays(due, step);
  }
  return dates;
}

function eachMonth(windowStart: string, windowEnd: string, preferredDay: number): string[] {
  const dates: string[] = [];
  let cursor = isoDate(yearOf(windowStart), monthOf(windowStart), 1);
  for (let i = 0; i < 48 && cursor < windowEnd; i += 1) {
    const due = dateInMonthWithinWindow(yearOf(cursor), monthOf(cursor), preferredDay, windowStart, windowEnd);
    if (due) dates.push(due);
    cursor = addMonths(cursor, 1);
  }
  return dates;
}

function monthsOfYear(months: number[], preferredDay: number, windowStart: string, windowEnd: string): string[] {
  const dates: string[] = [];
  for (const year of yearsTouching(windowStart, windowEnd)) {
    for (const month of months) {
      const due = dateInMonthWithinWindow(year, month, preferredDay, windowStart, windowEnd);
      if (due) dates.push(due);
    }
  }
  return dates.sort();
}

function everyNMonths(
  anchorMonth: number,
  step: number,
  preferredDay: number,
  windowStart: string,
  windowEnd: string,
): string[] {
  const dates: string[] = [];
  const seen = new Set<string>();
  let cursor = isoDate(yearOf(windowStart) - 1, anchorMonth, 1);
  for (let i = 0; i < 48 && cursor < windowEnd; i += 1) {
    const due = dateInMonthWithinWindow(yearOf(cursor), monthOf(cursor), preferredDay, windowStart, windowEnd);
    if (due && !seen.has(due)) {
      seen.add(due);
      dates.push(due);
    }
    cursor = addMonths(cursor, step);
  }
  return dates;
}

function expandPhases(
  phases: PhaseTemplate[],
  anchorStart: string,
  windowStart: string,
  windowEnd: string,
  parameters: Record<string, unknown>,
): ExpandedPhase[] {
  const expanded: ExpandedPhase[] = [];
  phases.forEach((phase, index) => {
    if (!whenMatches(phase.when, parameters)) return;
    if (phase.month) {
      for (const year of yearsTouching(windowStart, windowEnd)) {
        const start = dateInMonthWithinWindow(year, phase.month, 1, windowStart, windowEnd);
        if (!start) continue;
        const monthStart = isoDate(year, phase.month, 1);
        const monthEnd = addDays(addMonths(monthStart, 1), -1);
        const end = monthEnd >= windowEnd ? addDays(windowEnd, -1) : monthEnd;
        expanded.push({
          phaseKey: `${phase.key}-${year}`,
          name: phase.name,
          summary: phase.summary,
          tag: phase.tag ?? null,
          goal: phase.goal ?? null,
          sortOrder: year * 100 + phase.month,
          startDate: start,
          endDate: end < start ? start : end,
        });
      }
      return;
    }

    const startOffset = numberParam(parameters, phase.startDayParam, phase.startDay ?? 0);
    const startDate = addDays(anchorStart, startOffset);
    const endDate = typeof phase.endDay === 'number' ? addDays(addDays(anchorStart, phase.endDay), -1) : null;
    if (endDate && endDate < windowStart) return;
    if (startDate >= windowEnd) return;
    const clippedStart = startDate < windowStart ? windowStart : startDate;
    expanded.push({
      phaseKey: phase.key,
      name: phase.name,
      summary: phase.summary,
      tag: phase.tag ?? null,
      goal: phase.goal ?? null,
      sortOrder: index,
      startDate: clippedStart,
      endDate,
    });
  });
  return expanded;
}

function expandTasks(
  tasks: TaskTemplate[],
  anchorStart: string,
  windowStart: string,
  windowEnd: string,
  parameters: Record<string, unknown>,
): ExpandedTask[] {
  const expanded: ExpandedTask[] = [];
  for (const task of tasks) {
    if (!whenMatches(task.when, parameters)) continue;
    let dates = datesForTask(task.frequency, anchorStart, windowStart, windowEnd, parameters);
    if (task.duringMonths?.length) {
      dates = dates.filter((date) => task.duringMonths!.includes(monthOf(date)));
    }
    for (const dueDate of dates) {
      expanded.push({
        taskKey: task.key,
        title: task.title,
        details: task.details,
        dueDate,
        scheduleLabel: task.scheduleLabel,
      });
    }
  }
  return expanded;
}

function nullableNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function expandTemplate(template: CropPlanTemplate, input: ExpandInput): ExpandedPlan {
  const parameters = applyParameterDefaults(template, input.parameters ?? {});
  const windowStart = input.windowStart ?? input.startDate;
  const horizonEnd = input.windowEnd ?? addDays(input.startDate, template.horizonDays);
  const phases = expandPhases(template.phases, input.startDate, windowStart, horizonEnd, parameters)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.startDate.localeCompare(b.startDate));
  const tasks = expandTasks(template.tasks, input.startDate, windowStart, horizonEnd, parameters);
  const metrics: ExpandedMetric[] = template.metrics.map((metric) => {
    const override = input.metricOverrides?.[metric.key];
    return {
      metricKey: metric.key,
      name: metric.name,
      unit: metric.unit ?? null,
      expectedValue: override && 'expectedValue' in override ? nullableNumber(override.expectedValue) : nullableNumber(metric.expectedValue),
      expectedMin: override && 'expectedMin' in override ? nullableNumber(override.expectedMin) : nullableNumber(metric.expectedMin),
      expectedMax: override && 'expectedMax' in override ? nullableNumber(override.expectedMax) : nullableNumber(metric.expectedMax),
      expectedText: metric.expectedText ?? null,
      perUnit: Boolean(metric.perUnit),
      notes: metric.notes ?? null,
    };
  });
  const routines: ExpandedRoutine[] = template.routines.map((routine) => ({
    routineKey: routine.key,
    kind: routine.kind,
    title: routine.title,
    schedule: routine.schedule,
    enabled: input.routineEnabled?.[routine.key] ?? routine.enabledByDefault,
  }));
  return { parameters, windowStart, horizonEnd, phases, tasks, metrics, routines };
}
