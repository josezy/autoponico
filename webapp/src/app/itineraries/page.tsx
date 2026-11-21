import Link from 'next/link';
import type { Metadata } from 'next';

import { DatabaseSetup } from '@/components/itineraries/DatabaseSetup';
import { formatQuantity } from '@/components/itineraries/format';
import { formatDisplay, todayISO } from '@/lib/itineraries/dates';
import { listItineraries } from '@/lib/itineraries/repository';

export const metadata: Metadata = { title: 'Itineraries' };
export const dynamic = 'force-dynamic';

export default async function ItinerariesPage() {
  try {
    const items = await listItineraries(todayISO());
    return (
      <div className="container mx-auto p-4 max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold">Itineraries</h1>
            <p className="text-sm text-gray-600">Crop plans turned into dated tasks, logs, and expected-vs-actual metrics.</p>
          </div>
          <Link href="/itineraries/new" className="btn min-h-[44px] inline-flex items-center">New itinerary</Link>
        </div>
        {items.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-gray-700">No itineraries yet. Pick a crop plan template and set a start date, location, and quantity.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id}>
                <Link href={`/itineraries/${item.id}`} className="block bg-white shadow rounded-lg p-4 hover:ring-2 hover:ring-teal-600">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-lg font-semibold">{item.name}</h2>
                    <span className="text-xs uppercase tracking-wide text-gray-500">{item.status}</span>
                  </div>
                  <p className="text-sm text-gray-600">{item.templateName}</p>
                  <p className="text-sm text-gray-700 mt-1">
                    {item.location || 'No location'} · {formatQuantity(item.quantity, item.quantityUnit)} · since {formatDisplay(item.startDate)}
                  </p>
                  <p className="text-sm mt-2">
                    {item.overdueCount > 0 ? <span className="text-red-700 font-medium">{item.overdueCount} overdue</span> : <span className="text-gray-500">Nothing overdue</span>}
                    {item.nextTitle ? <span className="text-gray-700"> · Next: {item.nextTitle} ({formatDisplay(item.nextDue || item.startDate)})</span> : null}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  } catch (error) {
    return <DatabaseSetup message={error instanceof Error ? error.message : 'Database error'} />;
  }
}
