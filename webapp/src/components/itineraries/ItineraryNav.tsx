import Link from 'next/link';

const tabs = [
  { key: 'plan', label: 'Plan', href: (id: string) => `/itineraries/${id}` },
  { key: 'tasks', label: 'Tasks', href: (id: string) => `/itineraries/${id}/tasks` },
  { key: 'log', label: 'Daily log', href: (id: string) => `/itineraries/${id}/log` },
  { key: 'metrics', label: 'Expected vs actual', href: (id: string) => `/itineraries/${id}/metrics` },
  { key: 'clones', label: 'Clones', href: (id: string) => `/itineraries/${id}/clones` },
];

export function ItineraryNav({ id, current, clones }: { id: string; current: string; clones: boolean }) {
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1 mb-4">
      {tabs.filter((tab) => tab.key !== 'clones' || clones).map((tab) => (
        <Link
          key={tab.key}
          href={tab.href(id)}
          className={`shrink-0 px-3 py-2 rounded-full text-sm font-medium min-h-[44px] inline-flex items-center ${current === tab.key ? 'bg-teal-600 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
