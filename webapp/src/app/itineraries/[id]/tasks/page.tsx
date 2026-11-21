import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DatabaseSetup, isUuid, rethrowNavigation } from '@/components/itineraries/DatabaseSetup';
import { ItineraryNav } from '@/components/itineraries/ItineraryNav';
import { TaskBoard } from '@/components/itineraries/TaskBoard';
import { todayISO } from '@/lib/itineraries/dates';
import { getItinerary, listTasks } from '@/lib/itineraries/repository';

export const dynamic = 'force-dynamic';

const views = ['overdue', 'upcoming', 'done', 'all'] as const;
type View = (typeof views)[number];

const labels: Record<View, string> = {
  overdue: 'Overdue',
  upcoming: 'Next 30 days',
  done: 'Done or skipped',
  all: 'All',
};

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { view?: string };
}) {
  if (!isUuid(params.id)) notFound();
  const view: View = views.includes(searchParams.view as View) ? searchParams.view as View : 'upcoming';
  try {
    const itinerary = await getItinerary(params.id);
    if (!itinerary) notFound();
    const tasks = await listTasks(params.id, view, todayISO());
    return (
      <div className="container mx-auto p-4 max-w-5xl">
        <p className="text-sm mb-1"><Link href={`/itineraries/${itinerary.id}`} className="text-teal-700">{itinerary.name}</Link></p>
        <h1 className="text-2xl font-bold mb-3">Tasks</h1>
        <ItineraryNav id={itinerary.id} current="tasks" clones={itinerary.features.clones} />
        <div className="flex gap-2 overflow-x-auto mb-4">
          {views.map((item) => (
            <Link
              key={item}
              href={`/itineraries/${itinerary.id}/tasks?view=${item}`}
              className={`shrink-0 px-3 min-h-[44px] inline-flex items-center rounded-full text-sm border ${item === view ? 'bg-gray-900 text-white border-gray-900' : 'bg-white'}`}
            >
              {labels[item]}
            </Link>
          ))}
        </div>
        <TaskBoard itineraryId={itinerary.id} tasks={tasks} empty={`No tasks in ${labels[view].toLowerCase()}.`} />
      </div>
    );
  } catch (error) {
    rethrowNavigation(error);
    return <DatabaseSetup message={error instanceof Error ? error.message : 'Database error'} />;
  }
}
