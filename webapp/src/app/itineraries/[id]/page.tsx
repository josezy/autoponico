import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DatabaseSetup, isUuid, rethrowNavigation } from '@/components/itineraries/DatabaseSetup';
import { expectedLabel, formatQuantity, latestActual, trimNum } from '@/components/itineraries/format';
import { ItineraryNav } from '@/components/itineraries/ItineraryNav';
import { StatusActions } from '@/components/itineraries/StatusActions';
import { TaskBoard } from '@/components/itineraries/TaskBoard';
import { daysBetween, formatDisplay, todayISO } from '@/lib/itineraries/dates';
import { getItineraryDetail } from '@/lib/itineraries/repository';

export const metadata: Metadata = { title: 'Itinerary' };
export const dynamic = 'force-dynamic';

export default async function ItineraryPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();
  const today = todayISO();
  try {
    const detail = await getItineraryDetail(params.id, today);
    if (!detail) notFound();
    const { itinerary } = detail;
    const day = daysBetween(itinerary.startDate, today) + 1;
    const span = daysBetween(itinerary.startDate, itinerary.horizonEnd);
    const parameterLabels: Record<string, string> = {
      genetics: 'Genetics',
      plantType: 'Type',
      pot: 'Pot',
      substrate: 'Substrate',
      planted: 'Planted',
      age: 'Age',
      altitude: 'Altitude',
    };
    const facts = Object.entries(itinerary.parameters).filter(([, value]) => typeof value === 'string' && value);
    return (
      <div className="container mx-auto p-4 max-w-5xl">
        <p className="text-sm text-gray-500 mb-1"><Link href="/itineraries" className="text-teal-700">Itineraries</Link></p>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div>
            <h1 className="text-2xl font-bold">{itinerary.name}</h1>
            <p className="text-sm text-gray-600">{itinerary.templateName} · {itinerary.status}</p>
          </div>
          <StatusActions id={itinerary.id} status={itinerary.status} horizonKind={itinerary.horizonKind} />
        </div>
        <p className="text-sm text-gray-700 mb-1">
          {itinerary.location || 'No location'} · {formatQuantity(itinerary.quantity, itinerary.quantityUnit)}
        </p>
        <p className="text-sm text-gray-700 mb-3">
          {day < 1
            ? `Starts ${formatDisplay(itinerary.startDate)}`
            : itinerary.horizonKind === 'generation_window'
              ? `Day ${day} · open-ended · tasks through ${formatDisplay(itinerary.horizonEnd)}`
              : `Day ${day} of ${span} · through ${formatDisplay(itinerary.horizonEnd)}`}
        </p>
        {facts.length > 0 && (
          <p className="text-sm text-gray-600 mb-4">{facts.map(([key, value]) => `${parameterLabels[key] ?? key}: ${value}`).join(' · ')}</p>
        )}
        <ItineraryNav id={itinerary.id} current="plan" clones={itinerary.features.clones} />

        <section className="mb-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {detail.phases.map((phase) => (
              <div
                key={phase.id}
                className={`shrink-0 w-40 rounded-lg p-3 text-sm ${phase.state === 'current' ? 'bg-teal-700 text-white' : 'bg-white shadow'}`}
              >
                {phase.tag ? <p className="text-xs opacity-80">{phase.tag}</p> : null}
                <p className="font-medium">{phase.name}</p>
                <p className="text-xs opacity-80">{phase.startDate ? formatDisplay(phase.startDate) : ''}{phase.endDate ? ` – ${formatDisplay(phase.endDate)}` : phase.startDate ? ' – open' : ''}</p>
              </div>
            ))}
          </div>
        </section>

        {detail.currentPhase && (
          <section className="bg-white shadow rounded-lg p-4 mb-4">
            <p className="text-xs uppercase tracking-wide text-teal-700">Current phase</p>
            <h2 className="text-lg font-semibold">{detail.currentPhase.name}</h2>
            <p className="text-sm text-gray-700 mt-1">{detail.currentPhase.summary}</p>
            {detail.currentPhase.goal ? <p className="text-sm font-medium mt-2">Goal: {detail.currentPhase.goal}</p> : null}
          </section>
        )}

        <section className="mb-4">
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <h2 className="text-lg font-semibold text-red-800">Overdue ({detail.counts.overdue})</h2>
            <Link href={`/itineraries/${itinerary.id}/tasks?view=overdue`} className="text-sm text-teal-700">All tasks</Link>
          </div>
          {detail.counts.overdue > detail.overdue.length ? (
            <p className="text-xs text-gray-500 mb-2">Showing the {detail.overdue.length} most recent of {detail.counts.overdue} overdue tasks.</p>
          ) : null}
          <TaskBoard itineraryId={itinerary.id} tasks={detail.overdue} empty="Nothing overdue." />
        </section>

        <section className="mb-4">
          <h2 className="text-lg font-semibold mb-2">Next 7 days ({detail.counts.upcoming})</h2>
          <TaskBoard itineraryId={itinerary.id} tasks={detail.upcoming} empty="No tasks due in the next 7 days." />
        </section>

        <section className="bg-white shadow rounded-lg p-4 mb-4">
          <h2 className="font-semibold mb-2">Routines</h2>
          <ul className="space-y-2">
            {detail.routines.map((routine) => (
              <li key={routine.routineKey} className="text-sm flex flex-wrap justify-between gap-2">
                <span>
                  <span className="font-medium">{routine.title}</span>
                  <span className="block text-gray-600">{routine.schedule}</span>
                </span>
                <span className={`text-xs uppercase ${routine.enabled ? 'text-teal-700' : 'text-gray-400'}`}>{routine.enabled ? 'On' : 'Off'}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-4">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-lg font-semibold">Expected vs actual</h2>
            <Link href={`/itineraries/${itinerary.id}/metrics`} className="text-sm text-teal-700">Log actuals</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {detail.metrics.map((metric) => {
              const latest = latestActual(metric.actuals);
              return (
                <div key={metric.metricKey} className="bg-white shadow rounded-lg p-3 text-sm">
                  <p className="font-medium">{metric.name}</p>
                  <p className="text-gray-600">Expected {expectedLabel(metric)}</p>
                  <p>Actual {latest == null ? '—' : `${trimNum(latest)}${metric.unit ? ` ${metric.unit}` : ''}`}</p>
                </div>
              );
            })}
          </div>
        </section>

        {detail.cloneSummary && (
          <section className="bg-white shadow rounded-lg p-4 mb-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Clone batches</h2>
              <Link href={`/itineraries/${itinerary.id}/clones`} className="text-sm text-teal-700">Open tracker</Link>
            </div>
            <p className="text-sm text-gray-700 mt-2">
              {detail.cloneSummary.batchCount} batches · {detail.cloneSummary.rooted}/{detail.cloneSummary.cuttings} rooted
              {detail.cloneSummary.rootingRate != null ? ` (${trimNum(detail.cloneSummary.rootingRate)}%)` : ''}
              {detail.cloneSummary.avgDaysToRoot != null ? ` · ${trimNum(detail.cloneSummary.avgDaysToRoot)} days to root` : ''}
              {` · ${detail.cloneSummary.rootedThisMonth} rooted from cuts this month`}
            </p>
          </section>
        )}

        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-lg font-semibold">Recent log</h2>
            <Link href={`/itineraries/${itinerary.id}/log`} className="text-sm text-teal-700">Daily log</Link>
          </div>
          {detail.recentLogs.length === 0 ? <p className="text-sm text-gray-500">No log entries yet.</p> : (
            <ul className="space-y-2">
              {detail.recentLogs.map((log) => (
                <li key={log.id} className="bg-white shadow rounded-lg p-3 text-sm">
                  <p className="font-medium">{formatDisplay(log.logDate)}</p>
                  {log.notes ? <p className="text-gray-700">{log.notes}</p> : null}
                  {log.actions.length > 0 ? <p className="text-gray-500">{log.actions.join(', ')}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  } catch (error) {
    rethrowNavigation(error);
    return <DatabaseSetup message={error instanceof Error ? error.message : 'Database error'} />;
  }
}
