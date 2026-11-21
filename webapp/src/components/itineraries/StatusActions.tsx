'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';

export function StatusActions({
  id,
  status,
  horizonKind,
}: {
  id: string;
  status: 'active' | 'paused' | 'archived';
  horizonKind: 'plan_length' | 'generation_window';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(path: string, body: unknown, ok: string) {
    setBusy(true);
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Request failed');
      toast(ok, { autoClose: 1600 });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== 'active' && (
        <button type="button" className="btn min-h-[44px]" disabled={busy} onClick={() => run(`/api/itineraries/${id}`, { status: 'active' }, 'Itinerary resumed')}>Resume</button>
      )}
      {status === 'active' && (
        <button type="button" className="min-h-[44px] rounded border border-gray-300 px-4 py-2 text-sm" disabled={busy} onClick={() => run(`/api/itineraries/${id}`, { status: 'paused' }, 'Itinerary paused')}>Pause</button>
      )}
      {status !== 'archived' && (
        <button type="button" className="min-h-[44px] rounded border border-gray-300 px-4 py-2 text-sm" disabled={busy} onClick={() => run(`/api/itineraries/${id}`, { status: 'archived' }, 'Itinerary archived')}>Archive</button>
      )}
      <button
        type="button"
        className="min-h-[44px] rounded border border-gray-300 px-4 py-2 text-sm"
        disabled={busy}
        onClick={() => run(`/api/itineraries/${id}/extend`, {}, horizonKind === 'generation_window' ? 'Added another year of tasks' : 'Extended the plan by one year')}
      >
        Extend one year
      </button>
    </div>
  );
}
