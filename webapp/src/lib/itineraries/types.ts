export type ParameterWhen = {
  parameter: string;
  equals: string | number | boolean;
};

export type TaskFrequency =
  | { kind: 'weekly' }
  | {
      kind: 'every_n_days';
      everyDays: number;
      everyDaysMax?: number;
      fromDay?: number;
      fromDayParam?: string;
      untilDay?: number;
    }
  | { kind: 'monthly' }
  | { kind: 'in_months'; months: number[] }
  | {
      kind: 'every_n_months';
      months: number;
      monthsMax?: number;
      anchorMonth: number;
      day?: number;
    }
  | { kind: 'relative_every_months'; months: number; monthsMax?: number; fromMonth: number }
  | { kind: 'once_on_day'; day: number };

export type PhaseTemplate = {
  key: string;
  name: string;
  summary: string;
  tag?: string;
  goal?: string;
  /** Inclusive day offset from the itinerary start. Relative calendars only. */
  startDay?: number;
  startDayParam?: string;
  /** Exclusive day offset. Omit or null for an open-ended phase. */
  endDay?: number | null;
  /** Calendar-year plans: month number 1–12. */
  month?: number;
  when?: ParameterWhen;
};

export type TaskTemplate = {
  key: string;
  title: string;
  details: string;
  scheduleLabel: string;
  frequency: TaskFrequency;
  /** Keep a generated date only when its month is in this list. */
  duringMonths?: number[];
  when?: ParameterWhen;
};

export type MetricTemplate = {
  key: string;
  name: string;
  unit?: string;
  expectedValue?: number;
  expectedMin?: number;
  expectedMax?: number;
  expectedText?: string;
  /** When true, the UI multiplies the per-tree rate by the itinerary quantity. */
  perUnit?: boolean;
  notes?: string;
};

export type RoutineTemplate = {
  key: string;
  kind: string;
  title: string;
  schedule: string;
  enabledByDefault: boolean;
};

export type TemplateParameter = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  required?: boolean;
  defaultValue?: string | number | boolean;
  options?: { value: string; label: string }[];
  help?: string;
};

export type LogField =
  | 'photo'
  | 'notes'
  | 'actions'
  | 'issues'
  | 'heightCm'
  | 'nodes'
  | 'wateringMl'
  | 'ph'
  | 'ec'
  | 'tempC'
  | 'humidityPct';

export type ItineraryFeatures = {
  dailyLog: boolean;
  clones: boolean;
  logFields: LogField[];
  suggestedActions: string[];
  suggestedIssues: string[];
};

export type CropPlanTemplate = {
  id: string;
  name: string;
  crop: string;
  summary: string;
  sourceNote: string;
  language: 'es';
  calendar: 'relative' | 'calendar_year';
  horizonDays: number;
  horizonKind: 'plan_length' | 'generation_window';
  quantityLabel: string;
  quantityUnit: string;
  defaultQuantity: number;
  defaultLocation: string;
  features: ItineraryFeatures;
  parameters: TemplateParameter[];
  phases: PhaseTemplate[];
  tasks: TaskTemplate[];
  metrics: MetricTemplate[];
  routines: RoutineTemplate[];
  deriveParameters?: (parameters: Record<string, unknown>) => Record<string, unknown>;
};

export type MetricOverride = {
  expectedValue?: number | null;
  expectedMin?: number | null;
  expectedMax?: number | null;
};

export type ItineraryStatus = 'active' | 'paused' | 'archived';
export type TaskStatus = 'pending' | 'done' | 'skipped';
export type CloneStatus = 'pending' | 'rooted' | 'no_root' | 'wilted';
