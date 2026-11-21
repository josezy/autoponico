'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';

import { todayISO } from '@/lib/itineraries/dates';
import { expectedLabel, farmTotal, latestActual, trimNum } from './format';
import { MetricChart } from './MetricChart';

type MetricItem = {
  metricKey: string;
  name: string;
  unit: string | null;
  expectedValue: number | null;
  expectedMin: number | null;
  expectedMax: number | null;
  expectedText: string | null;
  perUnit: boolean;
  notes: string | null;
  actuals: { id: string; recordedOn: string; value: number | null; notes: string | null }[];
};

export function MetricEditor({
  itineraryId,
  metrics,
  quantity,
  quantityUnit,
}: {
  itineraryId: string;
  metrics: MetricItem[];
  quantity: number | null;
  quantityUnit: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function send(path: string, method: string, body: unknown, ok: string) {
    setBusy(path);
    try {
      const response = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Request failed');
      toast(ok, { autoClose: 1400 });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {metrics.map((metric) => {
        const latest = latestActual(metric.actuals);
        const total = farmTotal(metric, quantity, quantityUnit);
        const inside = latest != null && metric.expectedMin != null && metric.expectedMax != null
          ? latest >= metric.expectedMin && latest <= metric.expectedMax
          : null;
        return (
          <section key={metric.metricKey} className="bg-white shadow rounded-lg p-4">
            <h2 className="font-semibold">{metric.name}</h2>
            {metric.notes ? <p className="text-xs text-gray-500 mt-1">{metric.notes}</p> : null}
            <dl className="grid grid-cols-2 gap-3 mt-3 text-sm">
              <div>
                <dt className="text-gray-500">Expected</dt>
                <dd className="font-medium">{expectedLabel(metric)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Latest actual</dt>
                <dd className="font-medium">
                  {latest == null ? '—' : `${trimNum(latest)}${metric.unit ? ` ${metric.unit}` : ''}`}
                  {metric.expectedValue != null && latest != null ? (
                    <span className="block text-xs text-gray-500">{latest - metric.expectedValue > 0 ? '+' : ''}{trimNum(latest - metric.expectedValue)} vs target</span>
                  ) : null}
                  {inside != null ? <span className="block text-xs text-gray-500">{inside ? 'Inside the expected range' : 'Outside the expected range'}</span> : null}
                </dd>
              </div>
            </dl>
            {total ? <p className="text-xs text-gray-500 mt-2">{total}</p> : null}
            <MetricChart actuals={metric.actuals} expected={metric.expectedValue} />
            {metric.actuals.length > 0 && (
              <ul className="mt-2 text-sm text-gray-600 space-y-1">
                {metric.actuals.slice(-5).reverse().map((actual) => (
                  <li key={actual.id}>{actual.recordedOn}: {trimNum(actual.value)}{actual.notes ? ` — ${actual.notes}` : ''}</li>
                ))}
              </ul>
            )}
            <form
              className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 items-end"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void send(`/api/itineraries/${itineraryId}/metrics/${metric.metricKey}/actuals`, 'POST', {
                  recordedOn: form.get('recordedOn'),
                  value: form.get('value'),
                  notes: form.get('notes'),
                }, 'Actual saved');
                event.currentTarget.reset();
              }}
            >
              <label className="text-sm text-gray-700">Date
                <input type="date" name="recordedOn" defaultValue={todayISO()} required />
              </label>
              <label className="text-sm text-gray-700">Actual
                <input type="number" step="any" name="value" required />
              </label>
              <label className="text-sm text-gray-700">Note
                <input type="text" name="notes" />
              </label>
              <button type="submit" className="btn min-h-[44px] sm:col-span-3" disabled={busy != null}>Log actual</button>
            </form>
            <form
              className="mt-3 grid grid-cols-2 gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void send(`/api/itineraries/${itineraryId}/metrics/${metric.metricKey}`, 'POST', {
                  expectedValue: form.get('expectedValue'),
                  expectedMin: form.get('expectedMin'),
                  expectedMax: form.get('expectedMax'),
                }, 'Target updated');
              }}
            >
              <label className="text-sm text-gray-700 col-span-2 sm:col-span-1">Target
                <input type="number" step="any" name="expectedValue" defaultValue={metric.expectedValue ?? ''} />
              </label>
              <label className="text-sm text-gray-700">Min
                <input type="number" step="any" name="expectedMin" defaultValue={metric.expectedMin ?? ''} />
              </label>
              <label className="text-sm text-gray-700">Max
                <input type="number" step="any" name="expectedMax" defaultValue={metric.expectedMax ?? ''} />
              </label>
              <button type="submit" className="min-h-[44px] rounded border px-3 text-sm col-span-2" disabled={busy != null}>Update target</button>
            </form>
          </section>
        );
      })}
    </div>
  );
}
