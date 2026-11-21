import 'server-only';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';

import { addDays, monthOf, yearOf } from './dates';
import { getPool, withTransaction } from './db';
import { expandTemplate, type ExpandedPhase, type ExpandedTask } from './expand';
import { getPhotoStorage } from './photos';
import { getTemplate } from './templates';
import type {
  CloneStatus,
  ItineraryFeatures,
  ItineraryStatus,
  LogField,
  MetricOverride,
  TaskStatus,
} from './types';

export type ItineraryRecord = {
  id: string;
  templateId: string;
  templateName: string;
  name: string;
  status: ItineraryStatus;
  startDate: string;
  horizonEnd: string;
  horizonKind: 'plan_length' | 'generation_window';
  location: string;
  quantity: number | null;
  quantityUnit: string;
  parameters: Record<string, unknown>;
  features: ItineraryFeatures;
  createdAt: string;
  updatedAt: string;
};

export type ItineraryListItem = ItineraryRecord & {
  overdueCount: number;
  nextTitle: string | null;
  nextDue: string | null;
};

export type PhaseRecord = {
  id: string;
  phaseKey: string;
  name: string;
  summary: string;
  tag: string | null;
  goal: string | null;
  sortOrder: number;
  startDate: string | null;
  endDate: string | null;
  state: 'upcoming' | 'current' | 'done';
};

export type TaskRecord = {
  id: string;
  taskKey: string;
  title: string;
  details: string;
  dueDate: string;
  scheduleLabel: string;
  status: TaskStatus;
  notes: string | null;
  completedAt: string | null;
};

export type RoutineRecord = {
  routineKey: string;
  kind: string;
  title: string;
  schedule: string;
  enabled: boolean;
};

export type ActualRecord = {
  id: string;
  recordedOn: string;
  value: number | null;
  notes: string | null;
};

export type MetricRecord = {
  metricKey: string;
  name: string;
  unit: string | null;
  expectedValue: number | null;
  expectedMin: number | null;
  expectedMax: number | null;
  expectedText: string | null;
  perUnit: boolean;
  notes: string | null;
  actuals: ActualRecord[];
};

export type LogRecord = {
  id: string;
  logDate: string;
  photoKey: string | null;
  photoUrl: string | null;
  heightCm: number | null;
  nodes: number | null;
  wateringMl: number | null;
  ph: number | null;
  ec: number | null;
  tempC: number | null;
  humidityPct: number | null;
  actions: string[];
  issues: string[];
  notes: string | null;
};

export type CloneRecord = {
  id: string;
  label: string;
  position: number;
  photoKey: string | null;
  photoUrl: string | null;
  status: CloneStatus;
  rootedDay: number | null;
  notes: string | null;
};

export type BatchRecord = {
  id: string;
  cutDate: string;
  cuttingsCount: number;
  rootingAgent: string | null;
  method: string | null;
  domeHumidity: number | null;
  goalCount: number | null;
  goalRootingPct: number | null;
  goalDays: number | null;
  notes: string | null;
  clones: CloneRecord[];
};

export type CloneSummary = {
  batchCount: number;
  cuttings: number;
  rooted: number;
  noRoot: number;
  wilted: number;
  pending: number;
  rootingRate: number | null;
  scoredRate: number | null;
  avgCuttings: number | null;
  avgDaysToRoot: number | null;
  rootedThisMonth: number;
};

export type ItineraryDetail = {
  itinerary: ItineraryRecord;
  phases: PhaseRecord[];
  currentPhase: PhaseRecord | null;
  routines: RoutineRecord[];
  metrics: MetricRecord[];
  overdue: TaskRecord[];
  upcoming: TaskRecord[];
  recentDone: TaskRecord[];
  counts: { overdue: number; upcoming: number; pending: number; done: number; skipped: number };
  recentLogs: LogRecord[];
  cloneSummary: CloneSummary | null;
};

export type CreateItineraryInput = {
  templateId: string;
  name: string;
  startDate: string;
  location: string;
  quantity: number | null;
  parameters: Record<string, unknown>;
  metricOverrides: Record<string, MetricOverride>;
  routineEnabled: Record<string, boolean>;
};

type ItineraryRow = {
  id: string;
  template_id: string;
  template_name: string;
  name: string;
  status: ItineraryStatus;
  start_date: string;
  horizon_end: string;
  horizon_kind: 'plan_length' | 'generation_window';
  location: string;
  quantity: number | null;
  quantity_unit: string;
  parameters: Record<string, unknown> | null;
  features: Partial<ItineraryFeatures> | null;
  created_at: Date | string;
  updated_at: Date | string;
  overdue_count?: number;
  next_title?: string | null;
  next_due?: string | null;
};

function stamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asFeatures(value: Partial<ItineraryFeatures> | null): ItineraryFeatures {
  const logFields = Array.isArray(value?.logFields) ? value.logFields.filter((field): field is LogField => typeof field === 'string') : ['notes' as LogField];
  return {
    dailyLog: Boolean(value?.dailyLog),
    clones: Boolean(value?.clones),
    logFields,
    suggestedActions: Array.isArray(value?.suggestedActions) ? value.suggestedActions.map(String) : [],
    suggestedIssues: Array.isArray(value?.suggestedIssues) ? value.suggestedIssues.map(String) : [],
  };
}

function mapItinerary(row: ItineraryRow): ItineraryRecord {
  return {
    id: row.id,
    templateId: row.template_id,
    templateName: row.template_name,
    name: row.name,
    status: row.status,
    startDate: row.start_date,
    horizonEnd: row.horizon_end,
    horizonKind: row.horizon_kind,
    location: row.location,
    quantity: num(row.quantity),
    quantityUnit: row.quantity_unit,
    parameters: row.parameters ?? {},
    features: asFeatures(row.features),
    createdAt: stamp(row.created_at),
    updatedAt: stamp(row.updated_at),
  };
}

function phaseState(start: string | null, end: string | null, today: string): PhaseRecord['state'] {
  if (start && start > today) return 'upcoming';
  if (end && end < today) return 'done';
  if (start && start <= today) return 'current';
  return 'upcoming';
}

async function insertRows(client: PoolClient, table: string, columns: string[], rows: unknown[][], onConflict?: string) {
  const width = columns.length;
  const chunkSize = 40;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const values: unknown[] = [];
    const tuples = chunk.map((row) => {
      const placeholders = row.map((value) => {
        values.push(value);
        return `$${values.length}`;
      });
      if (placeholders.length !== width) throw new Error(`Column mismatch for ${table}`);
      return `(${placeholders.join(', ')})`;
    });
    await client.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')}${onConflict ?? ''}`,
      values,
    );
  }
}

function phaseRows(itineraryId: string, phases: ExpandedPhase[]): unknown[][] {
  return phases.map((phase) => [
    randomUUID(),
    itineraryId,
    phase.phaseKey,
    phase.name,
    phase.summary,
    phase.tag,
    phase.goal,
    phase.sortOrder,
    phase.startDate,
    phase.endDate,
  ]);
}

function taskRows(itineraryId: string, tasks: ExpandedTask[]): unknown[][] {
  return tasks.map((task) => [
    randomUUID(),
    itineraryId,
    task.taskKey,
    task.title,
    task.details,
    task.dueDate,
    task.scheduleLabel,
  ]);
}

export async function listItineraries(today: string): Promise<ItineraryListItem[]> {
  const pool = getPool();
  const result = await pool.query<ItineraryRow>(
    `SELECT i.*,
        (SELECT count(*)::int FROM itinerary_tasks t
          WHERE t.itinerary_id = i.id AND t.status = 'pending' AND t.due_date < $1) AS overdue_count,
        (SELECT t.title FROM itinerary_tasks t
          WHERE t.itinerary_id = i.id AND t.status = 'pending' AND t.due_date >= $1
          ORDER BY t.due_date, t.title LIMIT 1) AS next_title,
        (SELECT t.due_date FROM itinerary_tasks t
          WHERE t.itinerary_id = i.id AND t.status = 'pending' AND t.due_date >= $1
          ORDER BY t.due_date, t.title LIMIT 1) AS next_due
     FROM itineraries i
     ORDER BY i.created_at DESC`,
    [today],
  );
  return result.rows.map((row) => ({
    ...mapItinerary(row),
    overdueCount: row.overdue_count ?? 0,
    nextTitle: row.next_title ?? null,
    nextDue: row.next_due ?? null,
  }));
}

export async function createItinerary(input: CreateItineraryInput): Promise<string> {
  const template = getTemplate(input.templateId);
  if (!template) throw new Error('Unknown template');
  const expanded = expandTemplate(template, {
    startDate: input.startDate,
    parameters: input.parameters,
    metricOverrides: input.metricOverrides,
    routineEnabled: input.routineEnabled,
  });
  const id = randomUUID();
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO itineraries (
         id, template_id, template_name, name, status, start_date, horizon_end, horizon_kind,
         location, quantity, quantity_unit, parameters, features
       ) VALUES ($1,$2,$3,$4,'active',$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)`,
      [
        id,
        template.id,
        template.name,
        input.name,
        input.startDate,
        expanded.horizonEnd,
        template.horizonKind,
        input.location,
        input.quantity,
        template.quantityUnit,
        JSON.stringify(expanded.parameters),
        JSON.stringify(template.features),
      ],
    );
    await insertRows(client, 'itinerary_phases', [
      'id', 'itinerary_id', 'phase_key', 'name', 'summary', 'tag', 'goal', 'sort_order', 'start_date', 'end_date',
    ], phaseRows(id, expanded.phases));
    await insertRows(client, 'itinerary_tasks', [
      'id', 'itinerary_id', 'task_key', 'title', 'details', 'due_date', 'schedule_label',
    ], taskRows(id, expanded.tasks));
    await insertRows(client, 'itinerary_routines', [
      'id', 'itinerary_id', 'routine_key', 'kind', 'title', 'schedule', 'enabled',
    ], expanded.routines.map((routine) => [
      randomUUID(), id, routine.routineKey, routine.kind, routine.title, routine.schedule, routine.enabled,
    ]));
    await insertRows(client, 'itinerary_metrics', [
      'id', 'itinerary_id', 'metric_key', 'name', 'unit', 'expected_value', 'expected_min', 'expected_max', 'expected_text', 'per_unit', 'notes',
    ], expanded.metrics.map((metric) => [
      randomUUID(), id, metric.metricKey, metric.name, metric.unit, metric.expectedValue, metric.expectedMin,
      metric.expectedMax, metric.expectedText, metric.perUnit, metric.notes,
    ]));
  });
  return id;
}

export async function getItinerary(id: string): Promise<ItineraryRecord | null> {
  const pool = getPool();
  const result = await pool.query<ItineraryRow>('SELECT * FROM itineraries WHERE id = $1', [id]);
  return result.rows[0] ? mapItinerary(result.rows[0]) : null;
}

async function requireItinerary(id: string): Promise<ItineraryRecord> {
  const itinerary = await getItinerary(id);
  if (!itinerary) throw new Error('Itinerary not found');
  return itinerary;
}

function mapTask(row: {
  id: string;
  task_key: string;
  title: string;
  details: string;
  due_date: string;
  schedule_label: string;
  status: TaskStatus;
  notes: string | null;
  completed_at: Date | string | null;
}): TaskRecord {
  return {
    id: row.id,
    taskKey: row.task_key,
    title: row.title,
    details: row.details,
    dueDate: row.due_date,
    scheduleLabel: row.schedule_label,
    status: row.status,
    notes: row.notes,
    completedAt: row.completed_at ? stamp(row.completed_at) : null,
  };
}

export async function getItineraryDetail(id: string, today: string): Promise<ItineraryDetail | null> {
  const pool = getPool();
  const found = await pool.query<ItineraryRow>('SELECT * FROM itineraries WHERE id = $1', [id]);
  if (!found.rows[0]) return null;
  const itinerary = mapItinerary(found.rows[0]);
  const upcomingEnd = addDays(today, 7);
  const monthKey = `${yearOf(today)}-${String(monthOf(today)).padStart(2, '0')}`;

  const [phasesResult, routinesResult, metricsResult, actualsResult, overdueResult, upcomingResult, doneResult, countsResult, logsResult, cloneResult, batchResult] = await Promise.all([
    pool.query<{
      id: string; phase_key: string; name: string; summary: string; tag: string | null; goal: string | null;
      sort_order: number; start_date: string | null; end_date: string | null;
    }>('SELECT * FROM itinerary_phases WHERE itinerary_id = $1 ORDER BY sort_order, start_date', [id]),
    pool.query('SELECT * FROM itinerary_routines WHERE itinerary_id = $1 ORDER BY title', [id]),
    pool.query('SELECT * FROM itinerary_metrics WHERE itinerary_id = $1 ORDER BY name', [id]),
    pool.query('SELECT * FROM metric_actuals WHERE itinerary_id = $1 ORDER BY recorded_on, created_at', [id]),
    pool.query(`SELECT * FROM itinerary_tasks WHERE itinerary_id = $1 AND status = 'pending' AND due_date < $2 ORDER BY due_date DESC, title LIMIT 8`, [id, today]),
    pool.query(`SELECT * FROM itinerary_tasks WHERE itinerary_id = $1 AND status = 'pending' AND due_date >= $2 AND due_date < $3 ORDER BY due_date, title`, [id, today, upcomingEnd]),
    pool.query(`SELECT * FROM itinerary_tasks WHERE itinerary_id = $1 AND status = 'done' ORDER BY completed_at DESC NULLS LAST LIMIT 5`, [id]),
    pool.query<{ overdue: number; upcoming: number; pending: number; done: number; skipped: number }>(
      `SELECT
         count(*) FILTER (WHERE status = 'pending' AND due_date < $2)::int AS overdue,
         count(*) FILTER (WHERE status = 'pending' AND due_date >= $2 AND due_date < $3)::int AS upcoming,
         count(*) FILTER (WHERE status = 'pending')::int AS pending,
         count(*) FILTER (WHERE status = 'done')::int AS done,
         count(*) FILTER (WHERE status = 'skipped')::int AS skipped
       FROM itinerary_tasks WHERE itinerary_id = $1`,
      [id, today, upcomingEnd],
    ),
    pool.query('SELECT * FROM daily_logs WHERE itinerary_id = $1 ORDER BY log_date DESC, created_at DESC LIMIT 8', [id]),
    pool.query<{
      cuttings: number; rooted: number; no_root: number; wilted: number; pending: number;
      rooted_this_month: number; avg_days: number | null;
    }>(
      `SELECT
         count(*)::int AS cuttings,
         count(*) FILTER (WHERE c.status = 'rooted')::int AS rooted,
         count(*) FILTER (WHERE c.status = 'no_root')::int AS no_root,
         count(*) FILTER (WHERE c.status = 'wilted')::int AS wilted,
         count(*) FILTER (WHERE c.status = 'pending')::int AS pending,
         count(*) FILTER (WHERE c.status = 'rooted' AND to_char(b.cut_date, 'YYYY-MM') = $2)::int AS rooted_this_month,
         avg(c.rooted_day) FILTER (WHERE c.status = 'rooted' AND c.rooted_day IS NOT NULL) AS avg_days
       FROM clone_batches b
       JOIN clones c ON c.batch_id = b.id
       WHERE b.itinerary_id = $1`,
      [id, monthKey],
    ),
    pool.query<{ batch_count: number; avg_cuttings: number | null }>(
      `SELECT count(*)::int AS batch_count, avg(cuttings_count) AS avg_cuttings FROM clone_batches WHERE itinerary_id = $1`,
      [id],
    ),
  ]);

  const phases: PhaseRecord[] = phasesResult.rows.map((row) => ({
    id: row.id,
    phaseKey: row.phase_key,
    name: row.name,
    summary: row.summary,
    tag: row.tag,
    goal: row.goal,
    sortOrder: row.sort_order,
    startDate: row.start_date,
    endDate: row.end_date,
    state: phaseState(row.start_date, row.end_date, today),
  }));
  const currentPhase = phases.find((phase) => phase.state === 'current')
    ?? phases.find((phase) => phase.state === 'upcoming')
    ?? phases[phases.length - 1]
    ?? null;

  const actualsByKey = new Map<string, ActualRecord[]>();
  for (const row of actualsResult.rows as Array<{ id: string; metric_key: string; recorded_on: string; value: number | null; notes: string | null }>) {
    const list = actualsByKey.get(row.metric_key) ?? [];
    list.push({ id: row.id, recordedOn: row.recorded_on, value: num(row.value), notes: row.notes });
    actualsByKey.set(row.metric_key, list);
  }
  const metrics: MetricRecord[] = (metricsResult.rows as Array<{
    metric_key: string; name: string; unit: string | null; expected_value: number | null; expected_min: number | null;
    expected_max: number | null; expected_text: string | null; per_unit: boolean; notes: string | null;
  }>).map((row) => ({
    metricKey: row.metric_key,
    name: row.name,
    unit: row.unit,
    expectedValue: num(row.expected_value),
    expectedMin: num(row.expected_min),
    expectedMax: num(row.expected_max),
    expectedText: row.expected_text,
    perUnit: row.per_unit,
    notes: row.notes,
    actuals: actualsByKey.get(row.metric_key) ?? [],
  }));

  const storage = getPhotoStorage();
  const recentLogs = await Promise.all((logsResult.rows as Array<Record<string, unknown>>).map((row) => mapLog(row, storage)));

  const cloneRow = cloneResult.rows[0];
  const batchRow = batchResult.rows[0];
  const cuttings = cloneRow?.cuttings ?? 0;
  const rooted = cloneRow?.rooted ?? 0;
  const scored = rooted + (cloneRow?.no_root ?? 0) + (cloneRow?.wilted ?? 0);
  const cloneSummary: CloneSummary | null = itinerary.features.clones ? {
    batchCount: batchRow?.batch_count ?? 0,
    cuttings,
    rooted,
    noRoot: cloneRow?.no_root ?? 0,
    wilted: cloneRow?.wilted ?? 0,
    pending: cloneRow?.pending ?? 0,
    rootingRate: cuttings ? (rooted / cuttings) * 100 : null,
    scoredRate: scored ? (rooted / scored) * 100 : null,
    avgCuttings: num(batchRow?.avg_cuttings),
    avgDaysToRoot: num(cloneRow?.avg_days),
    rootedThisMonth: cloneRow?.rooted_this_month ?? 0,
  } : null;

  const counts = countsResult.rows[0] ?? { overdue: 0, upcoming: 0, pending: 0, done: 0, skipped: 0 };
  return {
    itinerary,
    phases,
    currentPhase,
    routines: (routinesResult.rows as Array<{ routine_key: string; kind: string; title: string; schedule: string; enabled: boolean }>).map((row) => ({
      routineKey: row.routine_key,
      kind: row.kind,
      title: row.title,
      schedule: row.schedule,
      enabled: row.enabled,
    })),
    metrics,
    overdue: overdueResult.rows.map(mapTask),
    upcoming: upcomingResult.rows.map(mapTask),
    recentDone: doneResult.rows.map(mapTask),
    counts,
    recentLogs,
    cloneSummary,
  };
}

async function mapLog(row: Record<string, unknown>, storage: ReturnType<typeof getPhotoStorage>): Promise<LogRecord> {
  const photoKey = (row.photo_key as string | null) ?? null;
  return {
    id: String(row.id),
    logDate: String(row.log_date),
    photoKey,
    photoUrl: photoKey ? await storage.urlFor(photoKey) : null,
    heightCm: num(row.height_cm),
    nodes: num(row.nodes),
    wateringMl: num(row.watering_ml),
    ph: num(row.ph),
    ec: num(row.ec),
    tempC: num(row.temp_c),
    humidityPct: num(row.humidity_pct),
    actions: (row.actions as string[]) ?? [],
    issues: (row.issues as string[]) ?? [],
    notes: (row.notes as string | null) ?? null,
  };
}

export async function listTasks(itineraryId: string, filter: 'overdue' | 'upcoming' | 'done' | 'all', today: string): Promise<TaskRecord[]> {
  const pool = getPool();
  const upcomingEnd = addDays(today, 30);
  const where = {
    overdue: `status = 'pending' AND due_date < $2`,
    upcoming: `status = 'pending' AND due_date >= $2 AND due_date < $3`,
    done: `status IN ('done', 'skipped')`,
    all: 'TRUE',
  }[filter];
  const order = filter === 'overdue' || filter === 'done' ? 'due_date DESC, title' : 'due_date, title';
  const params: unknown[] = [itineraryId];
  if (filter === 'overdue') params.push(today);
  if (filter === 'upcoming') params.push(today, upcomingEnd);
  const result = await pool.query(
    `SELECT * FROM itinerary_tasks WHERE itinerary_id = $1 AND ${where} ORDER BY ${order} LIMIT 400`,
    params,
  );
  return result.rows.map(mapTask);
}

export async function setTaskStatus(itineraryId: string, taskId: string, status: TaskStatus, notes: string | null): Promise<void> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE itinerary_tasks
     SET status = $1, notes = $2, completed_at = CASE WHEN $1 = 'pending' THEN NULL ELSE now() END
     WHERE id = $3 AND itinerary_id = $4`,
    [status, notes, taskId, itineraryId],
  );
  if (!result.rowCount) throw new Error('Task not found');
  await pool.query('UPDATE itineraries SET updated_at = now() WHERE id = $1', [itineraryId]);
}

export async function setItineraryStatus(itineraryId: string, status: ItineraryStatus): Promise<void> {
  const pool = getPool();
  const result = await pool.query('UPDATE itineraries SET status = $1, updated_at = now() WHERE id = $2', [status, itineraryId]);
  if (!result.rowCount) throw new Error('Itinerary not found');
}

export async function updateMetricExpected(itineraryId: string, metricKey: string, override: MetricOverride): Promise<void> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE itinerary_metrics
     SET expected_value = $3, expected_min = $4, expected_max = $5
     WHERE itinerary_id = $1 AND metric_key = $2`,
    [itineraryId, metricKey, override.expectedValue ?? null, override.expectedMin ?? null, override.expectedMax ?? null],
  );
  if (!result.rowCount) throw new Error('Metric not found');
}

export async function addMetricActual(itineraryId: string, metricKey: string, recordedOn: string, value: number | null, notes: string | null): Promise<void> {
  const pool = getPool();
  const metric = await pool.query('SELECT 1 FROM itinerary_metrics WHERE itinerary_id = $1 AND metric_key = $2', [itineraryId, metricKey]);
  if (!metric.rowCount) throw new Error('Metric not found');
  await pool.query(
    `INSERT INTO metric_actuals (id, itinerary_id, metric_key, recorded_on, value, notes) VALUES ($1,$2,$3,$4,$5,$6)`,
    [randomUUID(), itineraryId, metricKey, recordedOn, value, notes],
  );
  await pool.query('UPDATE itineraries SET updated_at = now() WHERE id = $1', [itineraryId]);
}

async function assertPhoto(itineraryId: string, photoKey: string | null): Promise<void> {
  if (!photoKey) return;
  const pool = getPool();
  const result = await pool.query('SELECT 1 FROM stored_photos WHERE object_key = $1 AND itinerary_id = $2', [photoKey, itineraryId]);
  if (!result.rowCount) throw new Error('Photo not found');
}

export type LogInput = {
  logDate: string;
  photoKey: string | null;
  heightCm: number | null;
  nodes: number | null;
  wateringMl: number | null;
  ph: number | null;
  ec: number | null;
  tempC: number | null;
  humidityPct: number | null;
  actions: string[];
  issues: string[];
  notes: string | null;
};

export async function addDailyLog(itineraryId: string, input: LogInput): Promise<void> {
  await requireItinerary(itineraryId);
  await assertPhoto(itineraryId, input.photoKey);
  const pool = getPool();
  await pool.query(
    `INSERT INTO daily_logs (
       id, itinerary_id, log_date, photo_key, height_cm, nodes, watering_ml, ph, ec, temp_c, humidity_pct, actions, issues, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      randomUUID(), itineraryId, input.logDate, input.photoKey, input.heightCm, input.nodes, input.wateringMl,
      input.ph, input.ec, input.tempC, input.humidityPct, input.actions, input.issues, input.notes,
    ],
  );
  await pool.query('UPDATE itineraries SET updated_at = now() WHERE id = $1', [itineraryId]);
}

export async function listDailyLogs(itineraryId: string): Promise<LogRecord[]> {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM daily_logs WHERE itinerary_id = $1 ORDER BY log_date DESC, created_at DESC LIMIT 60', [itineraryId]);
  const storage = getPhotoStorage();
  return Promise.all(result.rows.map((row) => mapLog(row, storage)));
}

export async function recordStoredPhoto(itineraryId: string, key: string, contentType: string, byteSize: number): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO stored_photos (object_key, itinerary_id, content_type, byte_size) VALUES ($1,$2,$3,$4)`,
    [key, itineraryId, contentType, byteSize],
  );
}

export type CloneBatchInput = {
  cutDate: string;
  cuttingsCount: number;
  rootingAgent: string | null;
  method: string | null;
  domeHumidity: number | null;
  goalCount: number | null;
  goalRootingPct: number | null;
  goalDays: number | null;
  notes: string | null;
};

export async function createCloneBatch(itineraryId: string, input: CloneBatchInput): Promise<string> {
  const itinerary = await requireItinerary(itineraryId);
  if (!itinerary.features.clones) throw new Error('This itinerary does not track clones');
  const batchId = randomUUID();
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO clone_batches (
         id, itinerary_id, cut_date, cuttings_count, rooting_agent, method, dome_humidity, goal_count, goal_rooting_pct, goal_days, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        batchId, itineraryId, input.cutDate, input.cuttingsCount, input.rootingAgent, input.method,
        input.domeHumidity, input.goalCount, input.goalRootingPct, input.goalDays, input.notes,
      ],
    );
    const clones = Array.from({ length: input.cuttingsCount }, (_, index) => [
      randomUUID(), batchId, `C${index + 1}`, index + 1,
    ]);
    await insertRows(client, 'clones', ['id', 'batch_id', 'label', 'position'], clones);
  });
  return batchId;
}

export async function listCloneBatches(itineraryId: string): Promise<BatchRecord[]> {
  const pool = getPool();
  const batches = await pool.query(
    `SELECT * FROM clone_batches WHERE itinerary_id = $1 ORDER BY cut_date DESC, created_at DESC`,
    [itineraryId],
  );
  if (!batches.rows.length) return [];
  const clones = await pool.query(
    `SELECT c.* FROM clones c
     JOIN clone_batches b ON b.id = c.batch_id
     WHERE b.itinerary_id = $1
     ORDER BY c.position`,
    [itineraryId],
  );
  const storage = getPhotoStorage();
  const byBatch = new Map<string, CloneRecord[]>();
  for (const row of clones.rows as Array<Record<string, unknown>>) {
    const photoKey = (row.photo_key as string | null) ?? null;
    const clone: CloneRecord = {
      id: String(row.id),
      label: String(row.label),
      position: Number(row.position),
      photoKey,
      photoUrl: photoKey ? await storage.urlFor(photoKey) : null,
      status: row.status as CloneStatus,
      rootedDay: num(row.rooted_day),
      notes: (row.notes as string | null) ?? null,
    };
    const list = byBatch.get(String(row.batch_id)) ?? [];
    list.push(clone);
    byBatch.set(String(row.batch_id), list);
  }
  return (batches.rows as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    cutDate: String(row.cut_date),
    cuttingsCount: Number(row.cuttings_count),
    rootingAgent: (row.rooting_agent as string | null) ?? null,
    method: (row.method as string | null) ?? null,
    domeHumidity: num(row.dome_humidity),
    goalCount: num(row.goal_count),
    goalRootingPct: num(row.goal_rooting_pct),
    goalDays: num(row.goal_days),
    notes: (row.notes as string | null) ?? null,
    clones: byBatch.get(String(row.id)) ?? [],
  }));
}

export async function updateClone(
  itineraryId: string,
  cloneId: string,
  input: { status: CloneStatus; rootedDay: number | null; notes: string | null; photoKey: string | null },
): Promise<void> {
  await assertPhoto(itineraryId, input.photoKey);
  const pool = getPool();
  const result = await pool.query(
    `UPDATE clones c
     SET status = $1,
         rooted_day = $2,
         notes = $3,
         photo_key = COALESCE($4, c.photo_key)
     FROM clone_batches b
     WHERE c.id = $5 AND c.batch_id = b.id AND b.itinerary_id = $6`,
    [input.status, input.status === 'rooted' ? input.rootedDay : null, input.notes, input.photoKey, cloneId, itineraryId],
  );
  if (!result.rowCount) throw new Error('Clone not found');
  await pool.query('UPDATE itineraries SET updated_at = now() WHERE id = $1', [itineraryId]);
}

export async function extendItinerary(itineraryId: string, extraDays = 365): Promise<string> {
  const itinerary = await requireItinerary(itineraryId);
  const template = getTemplate(itinerary.templateId);
  if (!template) throw new Error('Template is no longer in the app, so the horizon cannot be extended');
  const windowStart = itinerary.horizonEnd;
  const windowEnd = addDays(windowStart, extraDays);
  const expanded = expandTemplate(template, {
    startDate: itinerary.startDate,
    parameters: itinerary.parameters,
    windowStart,
    windowEnd,
  });
  await withTransaction(async (client) => {
    if (expanded.phases.length) {
      await insertRows(client, 'itinerary_phases', [
        'id', 'itinerary_id', 'phase_key', 'name', 'summary', 'tag', 'goal', 'sort_order', 'start_date', 'end_date',
      ], phaseRows(itineraryId, expanded.phases), ' ON CONFLICT (itinerary_id, phase_key) DO NOTHING');
    }
    if (expanded.tasks.length) {
      await insertRows(client, 'itinerary_tasks', [
        'id', 'itinerary_id', 'task_key', 'title', 'details', 'due_date', 'schedule_label',
      ], taskRows(itineraryId, expanded.tasks), ' ON CONFLICT (itinerary_id, task_key, due_date) DO NOTHING');
    }
    await client.query('UPDATE itineraries SET horizon_end = $2, updated_at = now() WHERE id = $1', [itineraryId, windowEnd]);
  });
  return windowEnd;
}
