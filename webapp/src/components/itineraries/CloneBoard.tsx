'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';

import { daysBetween, formatDisplay, todayISO } from '@/lib/itineraries/dates';

type CloneItem = {
  id: string;
  label: string;
  status: 'pending' | 'rooted' | 'no_root' | 'wilted';
  rootedDay: number | null;
  notes: string | null;
  photoUrl: string | null;
};

type BatchItem = {
  id: string;
  cutDate: string;
  cuttingsCount: number;
  rootingAgent: string | null;
  method: string | null;
  domeHumidity: number | null;
  goalCount: number | null;
  goalRootingPct: number | null;
  goalDays: number | null;
  notes: string | null;
  clones: CloneItem[];
};

export function CloneBoard({
  itineraryId,
  batches,
  defaultCount,
  defaultRate,
}: {
  itineraryId: string;
  batches: BatchItem[];
  defaultCount: number | null;
  defaultRate: number | null;
}) {
  const router = useRouter();
  const [cutDate, setCutDate] = useState(todayISO());
  const [count, setCount] = useState(String(defaultCount ?? 6));
  const [agent, setAgent] = useState('');
  const [method, setMethod] = useState('');
  const [humidity, setHumidity] = useState('');
  const [goalDays, setGoalDays] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function createBatch(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(`/api/itineraries/${itineraryId}/clone-batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cutDate,
          cuttingsCount: Number(count),
          rootingAgent: agent,
          method,
          domeHumidity: humidity,
          goalCount: defaultCount,
          goalRootingPct: defaultRate,
          goalDays,
          notes,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not open the batch');
      toast('Clone batch opened', { autoClose: 1600 });
      setNotes('');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open the batch');
    } finally {
      setSaving(false);
    }
  }

  async function uploadClonePhoto(clone: CloneItem, cutDateValue: string, file: File) {
    const form = new FormData();
    form.set('file', file);
    const uploaded = await fetch(`/api/itineraries/${itineraryId}/photos`, { method: 'POST', body: form });
    const stored = await uploaded.json().catch(() => ({}));
    if (!uploaded.ok) {
      toast.error(stored.error || 'Could not store the photo');
      return;
    }
    const rootedDay = clone.status === 'rooted' ? (clone.rootedDay ?? Math.max(0, daysBetween(cutDateValue, todayISO()))) : clone.rootedDay;
    const response = await fetch(`/api/itineraries/${itineraryId}/clones/${clone.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: clone.status, rootedDay, notes: clone.notes ?? '', photoKey: stored.key }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error || 'Could not attach the photo');
      return;
    }
    router.refresh();
  }

  async function updateClone(clone: CloneItem, cutDateValue: string, status: CloneItem['status']) {
    const rootedDay = status === 'rooted' ? (clone.rootedDay ?? Math.max(0, daysBetween(cutDateValue, todayISO()))) : null;
    const response = await fetch(`/api/itineraries/${itineraryId}/clones/${clone.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, rootedDay, notes: clone.notes ?? '' }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error || 'Could not update the clone');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={createBatch} className="bg-white shadow rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">New clone batch</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm font-medium text-gray-700">Cut date
            <input type="date" value={cutDate} onChange={(event) => setCutDate(event.target.value)} required />
          </label>
          <label className="text-sm font-medium text-gray-700">Cuttings
            <input type="number" min="1" max="200" value={count} onChange={(event) => setCount(event.target.value)} required />
          </label>
          <label className="text-sm font-medium text-gray-700">Rooting agent
            <input value={agent} onChange={(event) => setAgent(event.target.value)} />
          </label>
          <label className="text-sm font-medium text-gray-700">Method
            <input value={method} onChange={(event) => setMethod(event.target.value)} placeholder="Dome, aero, water" />
          </label>
          <label className="text-sm font-medium text-gray-700">Dome humidity %
            <input type="number" step="any" value={humidity} onChange={(event) => setHumidity(event.target.value)} />
          </label>
          <label className="text-sm font-medium text-gray-700">Goal days to root
            <input type="number" min="0" value={goalDays} onChange={(event) => setGoalDays(event.target.value)} />
          </label>
        </div>
        <label className="block text-sm font-medium text-gray-700">Notes
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <button type="submit" className="btn min-h-[44px]" disabled={saving}>{saving ? 'Saving…' : 'Open batch'}</button>
      </form>

      {batches.map((batch) => {
        const rooted = batch.clones.filter((clone) => clone.status === 'rooted').length;
        const rate = batch.cuttingsCount ? Math.round((rooted / batch.cuttingsCount) * 1000) / 10 : 0;
        return (
          <section key={batch.id} className="bg-white shadow rounded-lg p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">{formatDisplay(batch.cutDate)} · {batch.cuttingsCount} cuttings</h2>
              <p className="text-sm text-gray-600">{rooted} rooted · {rate}% of cuttings</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Goal {batch.goalCount ?? '—'} cuttings · {batch.goalRootingPct ?? '—'}% rooting
              {batch.goalDays != null ? ` · ${batch.goalDays} days` : ''}
              {batch.rootingAgent ? ` · ${batch.rootingAgent}` : ''}
              {batch.method ? ` · ${batch.method}` : ''}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
              {batch.clones.map((clone) => (
                <article key={clone.id} className="border rounded-lg p-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{clone.label}</p>
                    <p className="text-xs uppercase text-gray-500">{clone.status.replace('_', ' ')}</p>
                  </div>
                  {clone.photoUrl ? (
                    // User photos are served from this app or a signed object URL.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={clone.photoUrl} alt={clone.label} className="mt-2 h-20 w-full object-cover rounded" />
                  ) : null}
                  <label className="block text-xs text-gray-500 mt-1">
                    Photo
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="block w-full text-xs"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadClonePhoto(clone, batch.cutDate, file);
                      }}
                    />
                  </label>
                  {clone.status === 'rooted' && clone.rootedDay != null ? <p className="text-xs text-gray-600 mt-1">Rooted day {clone.rootedDay}</p> : null}
                  <div className="grid grid-cols-2 gap-1 mt-2">
                    <button type="button" className="text-xs min-h-[44px] rounded bg-teal-600 text-white" onClick={() => updateClone(clone, batch.cutDate, 'rooted')}>Rooted</button>
                    <button type="button" className="text-xs min-h-[44px] rounded border" onClick={() => updateClone(clone, batch.cutDate, 'no_root')}>No root</button>
                    <button type="button" className="text-xs min-h-[44px] rounded border" onClick={() => updateClone(clone, batch.cutDate, 'wilted')}>Wilted</button>
                    <button type="button" className="text-xs min-h-[44px] rounded border" onClick={() => updateClone(clone, batch.cutDate, 'pending')}>Reset</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
      {!batches.length ? <p className="text-sm text-gray-500">No batches yet. Open one when you take cuttings.</p> : null}
    </div>
  );
}
