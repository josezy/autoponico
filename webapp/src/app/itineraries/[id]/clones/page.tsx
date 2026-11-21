import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CloneBoard } from '@/components/itineraries/CloneBoard';
import { DatabaseSetup, isUuid, rethrowNavigation } from '@/components/itineraries/DatabaseSetup';
import { ItineraryNav } from '@/components/itineraries/ItineraryNav';
import { todayISO } from '@/lib/itineraries/dates';
import { getItineraryDetail, listCloneBatches } from '@/lib/itineraries/repository';

export const dynamic = 'force-dynamic';

export default async function ClonesPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();
  try {
    const detail = await getItineraryDetail(params.id, todayISO());
    if (!detail) notFound();
    if (!detail.itinerary.features.clones) {
      return (
        <div className="container mx-auto p-4 max-w-3xl">
          <p className="text-sm text-gray-700">This crop plan does not track clone batches.</p>
          <Link href={`/itineraries/${detail.itinerary.id}`} className="text-teal-700 text-sm">Back to the plan</Link>
        </div>
      );
    }
    const batches = await listCloneBatches(params.id);
    const count = detail.metrics.find((metric) => metric.metricKey === 'clones-per-cut')?.expectedValue ?? null;
    const rate = detail.metrics.find((metric) => metric.metricKey === 'rooting-rate')?.expectedValue ?? null;
    return (
      <div className="container mx-auto p-4 max-w-5xl">
        <p className="text-sm mb-1"><Link href={`/itineraries/${detail.itinerary.id}`} className="text-teal-700">{detail.itinerary.name}</Link></p>
        <h1 className="text-2xl font-bold mb-3">Clone batches</h1>
        <ItineraryNav id={detail.itinerary.id} current="clones" clones />
        <CloneBoard itineraryId={detail.itinerary.id} batches={batches} defaultCount={count} defaultRate={rate} />
      </div>
    );
  } catch (error) {
    rethrowNavigation(error);
    return <DatabaseSetup message={error instanceof Error ? error.message : 'Database error'} />;
  }
}
