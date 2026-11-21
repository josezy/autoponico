import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DatabaseSetup, isUuid, rethrowNavigation } from '@/components/itineraries/DatabaseSetup';
import { DailyLogForm } from '@/components/itineraries/DailyLogForm';
import { ItineraryNav } from '@/components/itineraries/ItineraryNav';
import { trimNum } from '@/components/itineraries/format';
import { formatDisplay } from '@/lib/itineraries/dates';
import { getItinerary, listDailyLogs } from '@/lib/itineraries/repository';

export const dynamic = 'force-dynamic';

export default async function LogPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();
  try {
    const itinerary = await getItinerary(params.id);
    if (!itinerary) notFound();
    const logs = await listDailyLogs(params.id);
    return (
      <div className="container mx-auto p-4 max-w-lg">
        <p className="text-sm mb-1"><Link href={`/itineraries/${itinerary.id}`} className="text-teal-700">{itinerary.name}</Link></p>
        <h1 className="text-2xl font-bold mb-3">Daily log</h1>
        <ItineraryNav id={itinerary.id} current="log" clones={itinerary.features.clones} />
        <DailyLogForm
          itineraryId={itinerary.id}
          logFields={itinerary.features.logFields}
          actions={itinerary.features.suggestedActions}
          issues={itinerary.features.suggestedIssues}
        />
        <ul className="space-y-3 mt-4">
          {logs.map((log) => (
            <li key={log.id} className="bg-white shadow rounded-lg p-3 text-sm">
              <p className="font-medium">{formatDisplay(log.logDate)}</p>
              {log.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={log.photoUrl} alt="" className="mt-2 rounded max-h-48 w-full object-cover" />
              ) : null}
              <p className="text-gray-700 mt-1">
                {[
                  log.heightCm != null ? `${trimNum(log.heightCm)} cm` : null,
                  log.nodes != null ? `${log.nodes} nodes` : null,
                  log.wateringMl != null ? `${trimNum(log.wateringMl)} ml` : null,
                  log.ph != null ? `pH ${trimNum(log.ph)}` : null,
                  log.ec != null ? `EC ${trimNum(log.ec)}` : null,
                ].filter(Boolean).join(' · ')}
              </p>
              {log.actions.length > 0 ? <p className="text-gray-600">{log.actions.join(', ')}</p> : null}
              {log.issues.length > 0 ? <p className="text-amber-800">{log.issues.join(', ')}</p> : null}
              {log.notes ? <p className="mt-1 whitespace-pre-wrap">{log.notes}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    );
  } catch (error) {
    rethrowNavigation(error);
    return <DatabaseSetup message={error instanceof Error ? error.message : 'Database error'} />;
  }
}
