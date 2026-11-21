import type { Metadata } from 'next';

import { Wizard } from '@/components/itineraries/Wizard';

export const metadata: Metadata = { title: 'New itinerary' };
export const dynamic = 'force-dynamic';

export default function NewItineraryPage() {
  return <Wizard />;
}
