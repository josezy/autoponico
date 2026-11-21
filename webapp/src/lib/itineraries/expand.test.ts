import assert from 'node:assert/strict';
import test from 'node:test';

import { addDays } from './dates';
import { expandTemplate } from './expand';
import { cannabisMotherTemplate } from './templates/cannabis-mother';
import { hassAvocadoTemplate } from './templates/hass-avocado';
import type { CropPlanTemplate } from './types';

const YEAR = { startDate: '2026-01-01' };

test('cannabis from seed schedules establishment, cuts from day 70, and a 5-month root refresh', () => {
  const plan = expandTemplate(cannabisMotherTemplate, YEAR);
  const phaseKeys = plan.phases.map((phase) => phase.phaseKey);
  assert.deepEqual(phaseKeys, ['germination', 'seedling', 'veg', 'mother']);
  assert.equal(plan.phases[0].endDate, '2026-01-03');
  assert.equal(plan.phases[3].startDate, addDays('2026-01-01', 70));
  assert.equal(plan.phases[3].endDate, null);

  const cuts = plan.tasks.filter((task) => task.taskKey === 'clone-cut').map((task) => task.dueDate);
  assert.equal(cuts[0], addDays('2026-01-01', 70));
  assert.equal(cuts[1], addDays(cuts[0], 14));
  assert.ok(cuts.every((date) => date >= cuts[0]));

  const topping = plan.tasks.filter((task) => task.taskKey === 'topping');
  assert.equal(topping.length, 1);
  assert.equal(topping[0].dueDate, addDays('2026-01-01', 50));

  const refresh = plan.tasks.filter((task) => task.taskKey === 'root-refresh').map((task) => task.dueDate);
  assert.deepEqual(refresh, ['2026-06-01', '2026-11-01']);

  const water = plan.tasks.filter((task) => task.taskKey === 'water');
  assert.equal(water[0].dueDate, '2026-01-01');
  assert.equal(water[1].dueDate, '2026-01-03');
  assert.equal(plan.metrics.find((metric) => metric.metricKey === 'rooting-rate')?.expectedValue, 80);
  assert.equal(plan.routines.find((routine) => routine.routineKey === 'extra-light')?.enabled, true);
});

test('an existing cannabis mother skips establishment and cuts on day 0', () => {
  const plan = expandTemplate(cannabisMotherTemplate, {
    ...YEAR,
    parameters: { includeEstablishment: false },
  });
  assert.deepEqual(plan.phases.map((phase) => phase.phaseKey), ['mother']);
  assert.equal(plan.phases[0].startDate, '2026-01-01');
  assert.equal(plan.tasks.some((task) => task.taskKey === 'topping'), false);
  const cuts = plan.tasks.filter((task) => task.taskKey === 'clone-cut');
  assert.equal(cuts[0].dueDate, '2026-01-01');
});

test('hass calendar keeps source months and does not invent a September harvest', () => {
  const plan = expandTemplate(hassAvocadoTemplate, YEAR);
  assert.equal(plan.phases.length, 12);
  assert.equal(plan.phases[0].name, 'Enero');
  assert.equal(plan.phases[0].tag, 'Seco');
  assert.equal(plan.phases[0].endDate, '2026-01-31');

  const months = (key: string) => plan.tasks.filter((task) => task.taskKey === key).map((task) => task.dueDate.slice(5, 7));
  assert.deepEqual(months('plateo'), ['04', '07', '10']);
  assert.deepEqual(months('guadana'), ['04']);
  assert.deepEqual(months('fert-marzo'), ['03']);
  assert.deepEqual(months('fert-mayo'), ['05']);
  assert.deepEqual(months('fert-septiembre'), ['09']);
  assert.deepEqual(months('fert-noviembre'), ['11']);
  assert.deepEqual(months('cal'), ['03']);
  assert.deepEqual(months('boro-zinc'), ['04']);
  assert.deepEqual(months('organico'), ['08']);
  assert.deepEqual(months('papeles'), ['12']);

  const harvestMonths = new Set(months('cosecha-pases'));
  assert.deepEqual([...harvestMonths].sort(), ['01', '05', '06', '07', '08', '10', '11', '12']);
  assert.equal(harvestMonths.has('09'), false);
  assert.equal(harvestMonths.has('02'), false);

  const weekly = plan.tasks.filter((task) => task.taskKey === 'recorrido');
  assert.equal(weekly.length, 53);
  assert.equal(weekly[0].dueDate, '2026-01-01');

  const production = plan.metrics.find((metric) => metric.metricKey === 'produccion');
  assert.equal(production?.expectedValue, 5);
  assert.equal(production?.expectedText, 'unos 42 kg por árbol');
  const dry = plan.metrics.find((metric) => metric.metricKey === 'materia-seca');
  assert.equal(dry?.expectedMin, 21);
  assert.equal(dry?.expectedMax, 23);
  assert.equal(plan.metrics.some((metric) => /zinc/i.test(metric.name)), false);
});

test('a mid-year start still keeps March work inside March and clips the phase', () => {
  const plan = expandTemplate(hassAvocadoTemplate, { startDate: '2026-03-15' });
  const march = plan.phases.find((phase) => phase.phaseKey === 'marzo-2026');
  assert.equal(march?.startDate, '2026-03-15');
  assert.equal(march?.endDate, '2026-03-31');
  assert.equal(plan.phases.some((phase) => phase.phaseKey === 'enero-2026'), false);
  assert.equal(plan.phases.some((phase) => phase.phaseKey === 'enero-2027'), true);
  const fert = plan.tasks.find((task) => task.taskKey === 'fert-marzo');
  assert.equal(fert?.dueDate, '2026-03-15');
});

test('a mid-year avocado window lists months in calendar order', () => {
  const plan = expandTemplate(hassAvocadoTemplate, { startDate: '2026-11-21' });
  assert.equal(plan.phases[0].phaseKey, 'noviembre-2026');
  const november = plan.phases.findIndex((phase) => phase.phaseKey === 'noviembre-2026');
  const january = plan.phases.findIndex((phase) => phase.phaseKey === 'enero-2027');
  assert.ok(november >= 0 && january > november);
});

test('metric overrides replace template defaults', () => {
  const plan = expandTemplate(cannabisMotherTemplate, {
    ...YEAR,
    metricOverrides: { 'clones-per-cut': { expectedValue: 4 } },
    routineEnabled: { 'extra-light': false },
  });
  assert.equal(plan.metrics.find((metric) => metric.metricKey === 'clones-per-cut')?.expectedValue, 4);
  assert.equal(plan.metrics.find((metric) => metric.metricKey === 'rooting-rate')?.expectedValue, 80);
  assert.equal(plan.routines.find((routine) => routine.routineKey === 'extra-light')?.enabled, false);
});

test('every-n-months anchor stays inside the window', () => {
  const template: CropPlanTemplate = {
    ...cannabisMotherTemplate,
    id: 'synthetic',
    calendar: 'calendar_year',
    phases: [],
    tasks: [
      {
        key: 'pulse',
        title: 'Pulse',
        details: '',
        scheduleLabel: 'Cada 3 meses',
        frequency: { kind: 'every_n_months', months: 3, anchorMonth: 4, day: 1 },
      },
    ],
    metrics: [],
    routines: [],
  };
  const plan = expandTemplate(template, YEAR);
  assert.deepEqual(plan.tasks.map((task) => task.dueDate), ['2026-01-01', '2026-04-01', '2026-07-01', '2026-10-01']);
});
