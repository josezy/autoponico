# Grow itineraries

Itineraries are the planning layer on top of the Autoponico dashboard. The dashboard already shows what the hardware is doing (water level, plugs, pH/EC). An itinerary says where a crop is in its life, what is due, and whether the grow is tracking the plan.

A **crop plan template** is reusable. It describes phases, recurring work, and measurable goals. A person picks a template, sets a start date, a location, and a quantity (trees, mother plants), and the app builds an **itinerary**: dated tasks that can be checked off with a note, log entries, and expected-versus-actual metrics.

This is the feature proposed in [issue #44](https://github.com/josezy/autoponico/issues/44). The wizard is three steps: template, details, goals and routines. Step 2 is the details the proposal left open.

The screens live in the Next.js app under `/itineraries`. The UI chrome is English, matching the rest of the dashboard. Template text for both seed plans is Spanish.

## Where data lives

Santiago’s decision on open question 3 of issue #44:

| Data | Store |
| --- | --- |
| Itineraries, phases, tasks, routines, metric targets, actuals, daily logs, clone batches, clone cards | **Postgres** (`DATABASE_URL`) |
| Photo bytes for logs and clone cards | **Object storage.** The app only stores the object key. |
| Sensor series (water level and the rest of the greenhouse charts) | **InfluxDB**, unchanged |

There was no application database in the repo. Postgres is new, and it is only for this planning data. Do not write itineraries into InfluxDB.

Photos go through `PhotoStorage` in `webapp/src/lib/itineraries/photos.ts`:

- `put` stores bytes and returns a key like `itineraries/{id}/{uuid}-name.jpg`
- `urlFor` returns a browser URL (a signed GET URL, a public base URL, or `/api/photos/...` for the local driver)
- `get` / `delete` read or remove the object

`PHOTO_STORAGE=s3` uses an S3-compatible bucket (`S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, optional `S3_PUBLIC_URL_BASE`). When `S3_PUBLIC_URL_BASE` is empty, URLs are signed for one hour.

`PHOTO_STORAGE=local` (the default when `S3_BUCKET` is unset) writes `webapp/data/photos`. That directory is gitignored. It implements the same interface so the app can run without a bucket. Production should set `PHOTO_STORAGE=s3`.

The app has no user accounts. Itineraries are project-wide, same as the rest of the dashboard. Who may edit a plan is still an open question.

“Today”, overdue, and the LED window use `America/Bogota`.

## Run it locally

From `webapp/`:

```bash
cp .env.example .env.local
docker compose up -d          # Postgres 16 on localhost:5432
npm install
npm run db:migrate
npm run dev
```

`.env.local` (also listed in `webapp/.env.example`):

```bash
DATABASE_URL=postgres://autoponico:autoponico@127.0.0.1:5432/autoponico
PHOTO_STORAGE=local
```

Without Docker, create the same role and database in any Postgres 16, then run `npm run db:migrate`. The migration runner reads `webapp/.env` and `webapp/.env.local` and records applied files in `schema_migrations`. SQL lives in `webapp/db/migrations/`.

Checks:

```bash
npm run test:itineraries   # template expansion, no database
npm run lint
npm run build
```

Open `http://localhost:3000/itineraries`.

On Vercel, set `DATABASE_URL` to a pooled Postgres connection (Neon, Vercel Postgres, or similar) and set the `S3_*` variables. Serverless functions should not rely on the local photo directory.

## Data model

Templates are TypeScript modules, not rows. Creating an itinerary **copies** phases, tasks, routines, and metrics into Postgres, so later edits to a template do not rewrite history.

| Table | Role |
| --- | --- |
| `itineraries` | Name, template id, status (`active`, `paused`, `archived`), start date, horizon end, location, quantity, parameter JSON, feature JSON |
| `itinerary_phases` | Ordered stages. `end_date` null means the stage is open-ended |
| `itinerary_tasks` | One row per dated occurrence. Status `pending`, `done`, or `skipped`, plus notes |
| `itinerary_routines` | Standing rules (extra light, weekly scout). Chosen when the itinerary is created |
| `itinerary_metrics` | Expected value and/or min–max, unit, optional per-tree flag |
| `metric_actuals` | A logged number on a date |
| `daily_logs` | One entry: optional photo key, measurements, actions, issues, notes |
| `clone_batches` / `clones` | Cuttings from a mother. Each cutting is `pending`, `rooted`, `no_root`, or `wilted` |
| `stored_photos` | Object key, content type, size. Not the bytes |

Tasks are generated for `horizonDays` (365). **Extend one year** appends the next window. Unique keys are `(itinerary_id, phase_key)` and `(itinerary_id, task_key, due_date)`, so extending does not duplicate work.

A mother plant uses `horizon_kind = generation_window`: the productive phase has no end date. The horizon is only how far tasks were generated. An annual farm plan uses `plan_length`: day N of that span.

The dashboard shows overdue tasks (most recent eight, plus the full count) and the next seven days. `/itineraries/{id}/tasks` lists overdue, the next 30 days, closed tasks, or up to 400 rows.

## Scheduling rules

These are conventions so a range in a written plan becomes a date. They are not extra agronomic doses.

| Written as | Generated as |
| --- | --- |
| Every week | Every 7 days from the start date |
| Every month, or “in March” | The 1st of that month. If the plan starts later in that month, the task moves to the start date, still inside the month |
| Every 2–3 weeks (clone cuts) | Every 14 days, the short end of the range |
| Every 3–4 weeks (harvest passes) | Every 21 days, only in the harvest months the plan names |
| Every 4–6 months (root and medium refresh) | Every 5 months, the middle of the range |
| Every 2–3 months, and the calendar names the months | Those named months only. No extra months are added |

## How to add a crop plan template

1. Add `webapp/src/lib/itineraries/templates/<crop>.ts` exporting a `CropPlanTemplate`.
2. Register it in `templates/index.ts`.
3. Cover the expansion in `expand.test.ts` (`npm run test:itineraries`).

The type is `CropPlanTemplate` in `webapp/src/lib/itineraries/types.ts`. The expander is `expandTemplate` in `expand.ts`. It does not talk to the database, so it can run in the wizard preview and in tests.

Fields that matter:

- `calendar`: `relative` (day offsets from the start date) or `calendar_year` (months 1–12, repeated if the window crosses a new year).
- `horizonDays` / `horizonKind`: how far to generate tasks, and whether that window is the life of the plan.
- `phases`: relative phases use `startDay` and an exclusive `endDay` (`null` stays open). Calendar phases set `month`.
- `tasks`: a `frequency` of `weekly`, `every_n_days`, `monthly`, `in_months`, `every_n_months`, `relative_every_months`, or `once_on_day`. `duringMonths` keeps a date only in those months. `when` drops the task unless a parameter matches.
- `metrics`: `expectedValue` and/or `expectedMin`/`expectedMax`. `perUnit` makes the UI multiply a per-tree rate by the itinerary quantity and label that product as arithmetic, not as a new recommendation.
- `routines`: reminders stored with the itinerary. They are not a second checkbox on top of the dated tasks.
- `parameters` and optional `deriveParameters`: questions asked in the wizard (genetics, “start from seed”, …). Derived values are stored on the itinerary.
- `features`: daily-log fields, suggested actions and issues, and whether clone batches exist.

Keep doses and dates that you did not get from a source out of the template. If a source says “2 to 3 kg”, store the range. Do not collapse it to one number and do not invent a per-application split. Say in `scheduleLabel` or `notes` when a date was chosen inside a stated range.

Copy-on-create means an existing itinerary keeps the old tasks until someone makes a new one.

## Seed template: cannabis mother for clones

Id: `cannabis-mother`. File: `webapp/src/lib/itineraries/templates/cannabis-mother.ts`.

Purpose: keep a mother vegetative and take clones. Near the equator, 18 hours of light needs a supplemental LED from 18:00 to 00:00 (`America/Bogota`). That routine is stored as `extra_light`. It does **not** switch a Tasmota plug yet.

Work:

- Watering reminder every 2 days
- Weekly pH and EC check
- Topping on day 50 when the plan starts from seed
- Clone cuts every 14 days (the plan says every 2–3 weeks), starting on day 70 from seed, or on day 0 if “Start from seed” is unchecked
- Root and medium refresh in a plastic pot every 5 months (the plan says every 4–6 months)

Phases from seed: germinación (days 0–2), plántula, vegetativo, then an open **madre productiva** phase. The numeric goals (6 cuttings, 80% rooting, 8 clones a month, 25 cm, 6 nodes) are the example targets from issue #44. They are editable in the wizard and are not measurements from a grow. “Days to root” has no default target.

Clone batches record the cut, the agent, the method, dome humidity, and one card per cutting (`rooted` with the day, `no_root`, or `wilted`). The metrics page compares those batches with the targets.

## Seed template: Hass avocado, 120 trees

Id: `hass-avocado`. File: `webapp/src/lib/itineraries/templates/hass-avocado.ts`.

Source: the agronomy note “Plan del cultivo de aguacate Hass, 120 árboles” for a 6-year-old planting (2020) in San Vicente Ferrer, Antioquia, about 2,100 m, about 5 t/year (about 42 kg per tree). Bimodal rain (March–May and September–November) and dry seasons (December–February and June–August). Main harvest October–January, traviesa May–August.

The month phases are the calendar text, unchanged in substance. Tasks:

- Every week: scout 10 random trees, pick up fallen fruit, field notebook (ICA)
- Every month: drains, flowering or fruit status
- Plateo in April, July, and October (the months the calendar names; the frequency note says every 2–3 months)
- Guadaña in April only (the only month the calendar names it, with the same frequency note)
- Soil analysis, dolomitic lime (1–2 kg/tree), and the four compound-fertilizer applications in March, May, September (more potassium), and November (light). The annual rate is 2–3 kg/tree, not split further
- Boron 50–100 g or foliar, and foliar zinc with no dose, in April
- Organic matter 5–10 kg/tree prepared in August, one or two times a year, second date not specified
- Height and thinning prune in January (the note also allows February), sanitary prune in August
- Hives in January and a smaller set in July (1 or 2 hives for 120 trees)
- Pest checks on the months the calendar names them: trips/mites/Monalonion, March rains pests (Compsus and Phytophthora), copper only if anthracnose or scab is heavy, Heilipus and Stenoma, rot at the start of the main harvest
- Harvest passes every 21 days in May–August and October–January, with dry matter 21–23%, a 1 cm peduncle, and shaded crates
- December: plan next year’s pruning and budget, and review ICA / BPA / GlobalGAP. The plan says to renew the ICA registration once a year and does not name the month; December is the planning month already in the calendar

The 5 t/year figure is for this 120-tree farm. Changing the tree count does not rescale it. Per-tree fertilizer rates do show a farm total labeled as rate × tree count. Zinc has no numeric metric because the source gives no dose. The November 2026 price note (6–10 million pesos) stays in the paperwork task; it is not a metric.

The note says dates move by a few weeks with the weather. The generated day-of-month is the 1st unless the itinerary starts later that month.

## Still open

- Accounts and who may edit a shared plan
- Driving the 18:00–00:00 LED from an existing Tasmota plug, and what to do if a night is missed
- Email or push reminders (Resend is already a dependency; v1 is the on-screen task list only)
- Full-grow and clones-to-flower templates from issue #44
- Which hosted Postgres and which bucket the Vercel deploy should use
- Attaching greenhouse sensor readings to a log entry (pH/EC stay manual here)
