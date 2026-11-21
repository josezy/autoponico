-- Itineraries, phases, routines, logs, and clone batches live in Postgres.
-- Sensor time series stay in InfluxDB. Photo bytes are not stored here:
-- these tables keep the object-storage key only.

CREATE TABLE itineraries (
  id uuid PRIMARY KEY,
  template_id text NOT NULL,
  template_name text NOT NULL,
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'paused', 'archived')),
  start_date date NOT NULL,
  horizon_end date NOT NULL,
  horizon_kind text NOT NULL CHECK (horizon_kind IN ('plan_length', 'generation_window')),
  location text NOT NULL DEFAULT '',
  quantity double precision,
  quantity_unit text NOT NULL DEFAULT '',
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE itinerary_phases (
  id uuid PRIMARY KEY,
  itinerary_id uuid NOT NULL REFERENCES itineraries (id) ON DELETE CASCADE,
  phase_key text NOT NULL,
  name text NOT NULL,
  summary text NOT NULL DEFAULT '',
  tag text,
  goal text,
  sort_order integer NOT NULL,
  start_date date,
  end_date date,
  UNIQUE (itinerary_id, phase_key)
);

CREATE TABLE itinerary_tasks (
  id uuid PRIMARY KEY,
  itinerary_id uuid NOT NULL REFERENCES itineraries (id) ON DELETE CASCADE,
  task_key text NOT NULL,
  title text NOT NULL,
  details text NOT NULL DEFAULT '',
  due_date date NOT NULL,
  schedule_label text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'skipped')),
  notes text,
  completed_at timestamptz,
  UNIQUE (itinerary_id, task_key, due_date)
);

CREATE INDEX itinerary_tasks_due_idx ON itinerary_tasks (itinerary_id, status, due_date);

CREATE TABLE itinerary_routines (
  id uuid PRIMARY KEY,
  itinerary_id uuid NOT NULL REFERENCES itineraries (id) ON DELETE CASCADE,
  routine_key text NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  schedule text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  UNIQUE (itinerary_id, routine_key)
);

CREATE TABLE itinerary_metrics (
  id uuid PRIMARY KEY,
  itinerary_id uuid NOT NULL REFERENCES itineraries (id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  name text NOT NULL,
  unit text,
  expected_value double precision,
  expected_min double precision,
  expected_max double precision,
  expected_text text,
  per_unit boolean NOT NULL DEFAULT false,
  notes text,
  UNIQUE (itinerary_id, metric_key)
);

CREATE TABLE metric_actuals (
  id uuid PRIMARY KEY,
  itinerary_id uuid NOT NULL REFERENCES itineraries (id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  recorded_on date NOT NULL,
  value double precision,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX metric_actuals_idx ON metric_actuals (itinerary_id, metric_key, recorded_on);

CREATE TABLE daily_logs (
  id uuid PRIMARY KEY,
  itinerary_id uuid NOT NULL REFERENCES itineraries (id) ON DELETE CASCADE,
  log_date date NOT NULL,
  photo_key text,
  height_cm double precision,
  nodes integer,
  watering_ml double precision,
  ph double precision,
  ec double precision,
  temp_c double precision,
  humidity_pct double precision,
  actions text[] NOT NULL DEFAULT '{}',
  issues text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX daily_logs_idx ON daily_logs (itinerary_id, log_date DESC);

CREATE TABLE clone_batches (
  id uuid PRIMARY KEY,
  itinerary_id uuid NOT NULL REFERENCES itineraries (id) ON DELETE CASCADE,
  cut_date date NOT NULL,
  cuttings_count integer NOT NULL CHECK (cuttings_count > 0 AND cuttings_count <= 200),
  rooting_agent text,
  method text,
  dome_humidity double precision,
  goal_count integer,
  goal_rooting_pct double precision,
  goal_days integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE clones (
  id uuid PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES clone_batches (id) ON DELETE CASCADE,
  label text NOT NULL,
  position integer NOT NULL,
  photo_key text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rooted', 'no_root', 'wilted')),
  rooted_day integer,
  notes text
);

CREATE INDEX clones_batch_idx ON clones (batch_id, position);

CREATE TABLE stored_photos (
  object_key text PRIMARY KEY,
  itinerary_id uuid REFERENCES itineraries (id) ON DELETE SET NULL,
  content_type text NOT NULL,
  byte_size integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
