import type { CropPlanTemplate } from '../types';

/**
 * Mother plant kept vegetative for clone production.
 * Goals marked as examples come from the itineraries proposal (issue #44);
 * they are editable defaults, not measurements from a grow.
 * Intervals that the owner stated as ranges are scheduled on a documented
 * point inside the range (see docs/itineraries.md).
 */
export const cannabisMotherTemplate: CropPlanTemplate = {
  id: 'cannabis-mother',
  name: 'Madre de cannabis para esquejes',
  crop: 'Cannabis',
  language: 'es',
  calendar: 'relative',
  horizonDays: 365,
  horizonKind: 'generation_window',
  quantityLabel: 'Mother plants',
  quantityUnit: 'plants',
  defaultQuantity: 1,
  defaultLocation: 'Balcón exterior',
  summary:
    'Mantener la planta en vegetativo de forma indefinida (18 h de luz) y sacar esquejes. En el ecuador un suplemento LED de 18:00 a 00:00 evita que la noche dispare la floración.',
  sourceNote:
    'Prácticas del encargo (18 h, LED 18:00–00:00, esquejes cada 2–3 semanas, renovación de raíces y medio cada 4–6 meses en matera plástica). Las metas numéricas de ejemplo (esquejes, tasa, altura, nudos) salen del proposal de itinerarios y se pueden cambiar al crear el plan.',
  features: {
    dailyLog: true,
    clones: true,
    logFields: ['photo', 'heightCm', 'nodes', 'wateringMl', 'ph', 'ec', 'tempC', 'humidityPct', 'actions', 'issues', 'notes'],
    suggestedActions: ['Topping', 'LST', 'Feed', 'Transplant', 'Defoliate', 'Clone taken'],
    suggestedIssues: ['Yellow leaves', 'Pests', 'Stretch', 'Overwater', 'Deficiency', 'None'],
  },
  parameters: [
    {
      key: 'genetics',
      label: 'Genetics',
      type: 'text',
      defaultValue: '',
      help: 'Example: Blacktuna feminized',
    },
    {
      key: 'plantType',
      label: 'Type',
      type: 'select',
      defaultValue: 'photoperiod',
      options: [
        { value: 'photoperiod', label: 'Photoperiod' },
        { value: 'auto', label: 'Autoflower' },
      ],
    },
    {
      key: 'pot',
      label: 'Pot',
      type: 'text',
      defaultValue: '8 L plastic',
    },
    {
      key: 'substrate',
      label: 'Substrate',
      type: 'text',
      defaultValue: '',
    },
    {
      key: 'includeEstablishment',
      label: 'Start from seed',
      type: 'boolean',
      defaultValue: true,
      help: 'Uncheck when the mother is already vegetative. Clone cuts then start on day 0.',
    },
  ],
  deriveParameters(parameters) {
    const fromSeed = parameters.includeEstablishment !== false;
    return { productiveStartDay: fromSeed ? 70 : 0 };
  },
  phases: [
    {
      key: 'germination',
      name: 'Germinación',
      summary: 'Semilla húmeda, sin luz hasta que aparezca la raíz.',
      goal: 'Raíz visible',
      startDay: 0,
      endDay: 3,
      when: { parameter: 'includeEstablishment', equals: true },
    },
    {
      key: 'seedling',
      name: 'Plántula',
      summary: 'Trasplante cuando la raíz mida cerca de 1–2 cm. Meta de ejemplo: 3 nudos.',
      goal: '3 nudos',
      startDay: 3,
      endDay: 13,
      when: { parameter: 'includeEstablishment', equals: true },
    },
    {
      key: 'veg',
      name: 'Vegetativo',
      summary: '18 h de luz. LED de apoyo 18:00–00:00 en el ecuador para no entrar a flor. Meta de ejemplo del proposal: en unos 45 días, 25 cm y 6 nudos.',
      goal: '25 cm y 6 nudos',
      startDay: 13,
      endDay: 70,
      when: { parameter: 'includeEstablishment', equals: true },
    },
    {
      key: 'mother',
      name: 'Madre productiva',
      summary: 'Fase abierta. Se queda en vegetativo y produce esquejes cada 2 a 3 semanas. La generación de tareas cubre un año y se puede extender.',
      goal: '8 clones al mes (meta de ejemplo)',
      startDay: 70,
      startDayParam: 'productiveStartDay',
      endDay: null,
    },
  ],
  tasks: [
    {
      key: 'water',
      title: 'Riego',
      details: 'Recordatorio cada 2 días. El volumen se anota en la bitácora.',
      scheduleLabel: 'Cada 2 días',
      frequency: { kind: 'every_n_days', everyDays: 2 },
    },
    {
      key: 'ph-ec',
      title: 'Revisar pH y EC',
      details: 'Chequeo semanal. En el balcón se anota a mano.',
      scheduleLabel: 'Semanal',
      frequency: { kind: 'weekly' },
    },
    {
      key: 'topping',
      title: 'Poda apical',
      details: 'Meta de ejemplo del proposal: 4 puntas, alrededor del día 50.',
      scheduleLabel: 'Día 50',
      frequency: { kind: 'once_on_day', day: 50 },
      when: { parameter: 'includeEstablishment', equals: true },
    },
    {
      key: 'clone-cut',
      title: 'Cortar esquejes',
      details: 'Cada 2 a 3 semanas. El calendario usa 14 días, el extremo corto del rango. Abre un lote de clones al cortar.',
      scheduleLabel: 'Cada 2 a 3 semanas',
      frequency: { kind: 'every_n_days', everyDays: 14, everyDaysMax: 21, fromDay: 70, fromDayParam: 'productiveStartDay' },
    },
    {
      key: 'root-refresh',
      title: 'Renovar raíces y medio',
      details: 'En matera plástica, cada 4 a 6 meses. El calendario usa 5 meses, el punto medio del rango.',
      scheduleLabel: 'Cada 4 a 6 meses',
      frequency: { kind: 'relative_every_months', months: 5, monthsMax: 6, fromMonth: 5 },
    },
  ],
  metrics: [
    {
      key: 'clones-per-cut',
      name: 'Esquejes por corte',
      unit: 'esquejes',
      expectedValue: 6,
      notes: 'Meta de ejemplo del proposal. Editable.',
    },
    {
      key: 'rooting-rate',
      name: 'Tasa de enraizamiento',
      unit: '%',
      expectedValue: 80,
      notes: 'Meta de ejemplo del proposal. Editable. Los lotes de clones calculan la tasa real.',
    },
    {
      key: 'clones-per-month',
      name: 'Clones por mes',
      unit: 'clones',
      expectedValue: 8,
      notes: 'Meta de ejemplo para la madre productiva.',
    },
    {
      key: 'days-to-root',
      name: 'Días hasta enraizar',
      unit: 'días',
      notes: 'El proposal compara este número con la realidad, pero no fija una meta. Déjala vacía o escribe la tuya.',
    },
    {
      key: 'height-cm',
      name: 'Altura en vegetativo',
      unit: 'cm',
      expectedValue: 25,
      notes: 'Meta de ejemplo del proposal (25 cm).',
    },
    {
      key: 'nodes',
      name: 'Nudos en vegetativo',
      unit: 'nudos',
      expectedValue: 6,
      notes: 'Meta de ejemplo del proposal (6 nudos).',
    },
  ],
  routines: [
    {
      key: 'extra-light',
      kind: 'extra_light',
      title: 'Luz suplementaria LED',
      schedule: '18:00–00:00 America/Bogota, para completar 18 h en el ecuador',
      enabledByDefault: true,
    },
    {
      key: 'water',
      kind: 'watering',
      title: 'Recordatorio de riego',
      schedule: 'Cada 2 días',
      enabledByDefault: true,
    },
    {
      key: 'ph-ec',
      kind: 'ph_ec',
      title: 'Chequeo de pH y EC',
      schedule: 'Semanal',
      enabledByDefault: true,
    },
    {
      key: 'root-refresh',
      kind: 'root_prune',
      title: 'Renovar raíces y medio',
      schedule: 'Cada 4 a 6 meses, en matera plástica',
      enabledByDefault: true,
    },
  ],
};
