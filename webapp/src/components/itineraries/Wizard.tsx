'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';

import { todayISO } from '@/lib/itineraries/dates';
import { expandTemplate } from '@/lib/itineraries/expand';
import { getTemplate, listTemplates } from '@/lib/itineraries/templates';
import type { CropPlanTemplate } from '@/lib/itineraries/types';

type MetricDraft = { expectedValue: string; expectedMin: string; expectedMax: string };

function blankParameters(template: CropPlanTemplate): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {};
  for (const parameter of template.parameters) {
    values[parameter.key] = parameter.type === 'boolean'
      ? Boolean(parameter.defaultValue)
      : String(parameter.defaultValue ?? '');
  }
  return values;
}

function metricDrafts(template: CropPlanTemplate): Record<string, MetricDraft> {
  return Object.fromEntries(template.metrics.map((metric) => [metric.key, {
    expectedValue: metric.expectedValue == null ? '' : String(metric.expectedValue),
    expectedMin: metric.expectedMin == null ? '' : String(metric.expectedMin),
    expectedMax: metric.expectedMax == null ? '' : String(metric.expectedMax),
  }]));
}

function routineDefaults(template: CropPlanTemplate): Record<string, boolean> {
  return Object.fromEntries(template.routines.map((routine) => [routine.key, routine.enabledByDefault]));
}

function parameterPayload(template: CropPlanTemplate, values: Record<string, string | boolean>) {
  const payload: Record<string, unknown> = {};
  for (const parameter of template.parameters) {
    const value = values[parameter.key];
    if (parameter.type === 'boolean') payload[parameter.key] = value === true;
    else if (parameter.type === 'number') payload[parameter.key] = value === '' ? null : Number(value);
    else payload[parameter.key] = value ?? '';
  }
  return payload;
}

function numberOrNull(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const steps = ['Template', 'Details', 'Goals and routines'];

export function Wizard() {
  const router = useRouter();
  const templates = listTemplates();
  const initial = templates[0];
  const [step, setStep] = useState(0);
  const [templateId, setTemplateId] = useState(initial.id);
  const [name, setName] = useState(initial.name);
  const [startDate, setStartDate] = useState(todayISO());
  const [location, setLocation] = useState(initial.defaultLocation);
  const [quantity, setQuantity] = useState(String(initial.defaultQuantity));
  const [parameters, setParameters] = useState(blankParameters(initial));
  const [metrics, setMetrics] = useState(metricDrafts(initial));
  const [routines, setRoutines] = useState(routineDefaults(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = getTemplate(templateId) ?? initial;

  function chooseTemplate(id: string) {
    const next = getTemplate(id);
    if (!next) return;
    setTemplateId(id);
    setName(next.name);
    setLocation(next.defaultLocation);
    setQuantity(String(next.defaultQuantity));
    setParameters(blankParameters(next));
    setMetrics(metricDrafts(next));
    setRoutines(routineDefaults(next));
    setError(null);
  }

  function continueFromDetails() {
    if (!name.trim()) {
      setError('Give the itinerary a name.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      setError('Choose a start date.');
      return;
    }
    if (quantity.trim() !== '' && !Number.isFinite(Number(quantity))) {
      setError('Quantity needs to be a number.');
      return;
    }
    setError(null);
    setStep(2);
  }

  async function create() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/itineraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          name,
          startDate,
          location,
          quantity: quantity.trim() === '' ? null : Number(quantity),
          parameters: parameterPayload(template, parameters),
          metricOverrides: Object.fromEntries(template.metrics.map((metric) => [metric.key, {
            expectedValue: numberOrNull(metrics[metric.key]?.expectedValue ?? ''),
            expectedMin: numberOrNull(metrics[metric.key]?.expectedMin ?? ''),
            expectedMax: numberOrNull(metrics[metric.key]?.expectedMax ?? ''),
          }])),
          routineEnabled: routines,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not create the itinerary');
      toast('Itinerary created', { autoClose: 1600 });
      router.push(`/itineraries/${body.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the itinerary');
      setSaving(false);
    }
  }

  const preview = step === 2
    ? expandTemplate(template, {
      startDate,
      parameters: parameterPayload(template, parameters),
      metricOverrides: Object.fromEntries(template.metrics.map((metric) => [metric.key, {
        expectedValue: numberOrNull(metrics[metric.key]?.expectedValue ?? ''),
        expectedMin: numberOrNull(metrics[metric.key]?.expectedMin ?? ''),
        expectedMax: numberOrNull(metrics[metric.key]?.expectedMax ?? ''),
      }])),
      routineEnabled: routines,
    })
    : null;

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <p className="text-sm text-gray-500 mb-1">Step {step + 1} of 3 · {steps[step]}</p>
      <h1 className="text-2xl font-bold mb-4">New itinerary</h1>
      <ol className="flex gap-2 mb-4 text-sm">
        {steps.map((label, index) => (
          <li key={label} className={`px-3 py-1 rounded-full ${index === step ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border'}`}>{label}</li>
        ))}
      </ol>

      {error ? <p className="mb-4 rounded bg-red-50 text-red-800 px-3 py-2 text-sm">{error}</p> : null}

      {step === 0 && (
        <div className="space-y-3">
          {templates.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => chooseTemplate(item.id)}
              className={`w-full text-left bg-white shadow rounded-lg p-4 border-2 ${item.id === templateId ? 'border-teal-600' : 'border-transparent'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">{item.name}</h2>
                <span className="text-xs uppercase tracking-wide text-gray-500">{item.language}</span>
              </div>
              <p className="text-sm text-gray-700 mt-2">{item.summary}</p>
              <p className="text-xs text-gray-500 mt-2">{item.sourceNote}</p>
            </button>
          ))}
          <button type="button" className="btn min-h-[44px]" onClick={() => setStep(1)}>Continue</button>
        </div>
      )}

      {step === 1 && (
        <div className="bg-white shadow rounded-lg p-4 space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Start date
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Location
            <input value={location} onChange={(event) => setLocation(event.target.value)} />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            {template.quantityLabel}
            <input type="number" min="0" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            <span className="text-xs font-normal text-gray-500">{template.quantityUnit}</span>
          </label>
          {template.parameters.map((parameter) => (
            <label key={parameter.key} className="block text-sm font-medium text-gray-700">
              {parameter.type === 'boolean' ? (
                <span className="flex items-start gap-2 font-normal">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={parameters[parameter.key] === true}
                    onChange={(event) => setParameters((current) => ({ ...current, [parameter.key]: event.target.checked }))}
                  />
                  <span>
                    <span className="font-medium">{parameter.label}</span>
                    {parameter.help ? <span className="block text-xs text-gray-500">{parameter.help}</span> : null}
                  </span>
                </span>
              ) : (
                <>
                  {parameter.label}
                  {parameter.type === 'select' ? (
                    <select
                      value={String(parameters[parameter.key] ?? '')}
                      onChange={(event) => setParameters((current) => ({ ...current, [parameter.key]: event.target.value }))}
                    >
                      {parameter.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : (
                    <input
                      type={parameter.type === 'number' ? 'number' : 'text'}
                      value={String(parameters[parameter.key] ?? '')}
                      onChange={(event) => setParameters((current) => ({ ...current, [parameter.key]: event.target.value }))}
                    />
                  )}
                  {parameter.help ? <span className="text-xs font-normal text-gray-500">{parameter.help}</span> : null}
                </>
              )}
            </label>
          ))}
          <div className="flex gap-2">
            <button type="button" className="min-h-[44px] rounded border border-gray-300 px-4 py-2 text-sm" onClick={() => setStep(0)}>Back</button>
            <button type="button" className="btn min-h-[44px]" onClick={continueFromDetails}>Continue</button>
          </div>
        </div>
      )}

      {step === 2 && preview && (
        <div className="space-y-4">
          <div className="bg-white shadow rounded-lg p-4">
            <h2 className="font-semibold mb-1">What will be created</h2>
            <p className="text-sm text-gray-600">
              {preview.tasks.length} dated tasks through {preview.horizonEnd}, {preview.phases.length} phases, {preview.routines.length} routines.
              {template.horizonKind === 'generation_window' ? ' The mother stays open-ended. This window is only the generated task list, and you can extend it later.' : ' This is one year of the calendar.'}
            </p>
            <ul className="mt-3 space-y-2">
              {preview.phases.slice(0, 8).map((phase) => (
                <li key={phase.phaseKey} className="text-sm">
                  <span className="font-medium">{phase.name}</span>
                  {phase.tag ? <span className="text-gray-500"> · {phase.tag}</span> : null}
                  {phase.goal ? <span className="block text-gray-600">{phase.goal}</span> : null}
                </li>
              ))}
              {preview.phases.length > 8 ? <li className="text-xs text-gray-500">+ {preview.phases.length - 8} more phases</li> : null}
            </ul>
          </div>

          <div className="bg-white shadow rounded-lg p-4 space-y-4">
            <h2 className="font-semibold">Expected values</h2>
            {template.metrics.map((metric) => {
              const draft = metrics[metric.key];
              const ranged = metric.expectedMin != null || metric.expectedMax != null;
              return (
                <fieldset key={metric.key} className="border-t pt-3">
                  <legend className="text-sm font-medium">{metric.name}{metric.unit ? ` (${metric.unit})` : ''}</legend>
                  {metric.notes ? <p className="text-xs text-gray-500 mb-2">{metric.notes}</p> : null}
                  {ranged ? (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-sm text-gray-700">Min
                        <input type="number" value={draft?.expectedMin ?? ''} onChange={(event) => setMetrics((current) => ({ ...current, [metric.key]: { ...current[metric.key], expectedMin: event.target.value } }))} />
                      </label>
                      <label className="text-sm text-gray-700">Max
                        <input type="number" value={draft?.expectedMax ?? ''} onChange={(event) => setMetrics((current) => ({ ...current, [metric.key]: { ...current[metric.key], expectedMax: event.target.value } }))} />
                      </label>
                    </div>
                  ) : (
                    <label className="text-sm text-gray-700">Target
                      <input type="number" value={draft?.expectedValue ?? ''} onChange={(event) => setMetrics((current) => ({ ...current, [metric.key]: { ...current[metric.key], expectedValue: event.target.value } }))} />
                    </label>
                  )}
                </fieldset>
              );
            })}
          </div>

          <div className="bg-white shadow rounded-lg p-4 space-y-3">
            <h2 className="font-semibold">Routines</h2>
            {template.routines.map((routine) => (
              <label key={routine.key} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={routines[routine.key] !== false}
                  onChange={(event) => setRoutines((current) => ({ ...current, [routine.key]: event.target.checked }))}
                />
                <span>
                  <span className="font-medium">{routine.title}</span>
                  <span className="block text-gray-600">{routine.schedule}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="flex gap-2">
            <button type="button" className="min-h-[44px] rounded border border-gray-300 px-4 py-2 text-sm" onClick={() => setStep(1)}>Back</button>
            <button type="button" className="btn min-h-[44px]" disabled={saving} onClick={create}>{saving ? 'Creating…' : 'Create itinerary'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
