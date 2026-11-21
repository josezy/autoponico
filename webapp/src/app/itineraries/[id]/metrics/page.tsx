import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DatabaseSetup, isUuid, rethrowNavigation } from '@/components/itineraries/DatabaseSetup';
import { ItineraryNav } from '@/components/itineraries/ItineraryNav';
import { MetricEditor } from '@/components/itineraries/MetricEditor';
import { trimNum } from '@/components/itineraries/format';
import { todayISO } from '@/lib/itineraries/dates';
import { getItineraryDetail } from '@/lib/itineraries/repository';

export const dynamic = 'force-dynamic';

export default async function MetricsPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();
  try {
    const detail = await getItineraryDetail(params.id, todayISO());
    if (!detail) notFound();
    const { itinerary, cloneSummary } = detail;
    const clonesPerCut = detail.metrics.find((metric) => metric.metricKey === 'clones-per-cut');
    const rooting = detail.metrics.find((metric) => metric.metricKey === 'rooting-rate');
    const perMonth = detail.metrics.find((metric) => metric.metricKey === 'clones-per-month');
    const days = detail.metrics.find((metric) => metric.metricKey === 'days-to-root');
    return (
      <div className="container mx-auto p-4 max-w-3xl">
        <p className="text-sm mb-1"><Link href={`/itineraries/${itinerary.id}`} className="text-teal-700">{itinerary.name}</Link></p>
        <h1 className="text-2xl font-bold mb-3">Expected vs actual</h1>
        <ItineraryNav id={itinerary.id} current="metrics" clones={itinerary.features.clones} />
        {cloneSummary && cloneSummary.batchCount > 0 && (
          <section className="bg-white shadow rounded-lg p-4 mb-4 text-sm">
            <h2 className="font-semibold mb-2">From clone batches</h2>
            <ul className="space-y-1 text-gray-700">
              <li>Cuttings per batch: {trimNum(cloneSummary.avgCuttings)} average vs {clonesPerCut?.expectedValue ?? '—'} expected</li>
              <li>Rooting rate: {trimNum(cloneSummary.rootingRate)}% of cuttings taken ({trimNum(cloneSummary.scoredRate)}% of scored) vs {rooting?.expectedValue ?? '—'}%</li>
              <li>Rooted from cuts this month: {cloneSummary.rootedThisMonth} vs {perMonth?.expectedValue ?? '—'} per month</li>
              <li>Days to root: {trimNum(cloneSummary.avgDaysToRoot)} average vs {days?.expectedValue ?? 'no target yet'}</li>
            </ul>
          </section>
        )}
        <MetricEditor
          itineraryId={itinerary.id}
          metrics={detail.metrics}
          quantity={itinerary.quantity}
          quantityUnit={itinerary.quantityUnit}
        />
      </div>
    );
  } catch (error) {
    rethrowNavigation(error);
    return <DatabaseSetup message={error instanceof Error ? error.message : 'Database error'} />;
  }
}
