'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';

import { formatDisplay } from '@/lib/itineraries/dates';

type TaskItem = {
  id: string;
  title: string;
  details: string;
  dueDate: string;
  scheduleLabel: string;
  status: 'pending' | 'done' | 'skipped';
  notes: string | null;
};

export function TaskBoard({
  itineraryId,
  tasks,
  empty,
}: {
  itineraryId: string;
  tasks: TaskItem[];
  empty: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function save(task: TaskItem, status: TaskItem['status']) {
    setPendingId(task.id);
    try {
      const response = await fetch(`/api/itineraries/${itineraryId}/tasks/${task.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes: notes[task.id] ?? task.notes ?? '' }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not update the task');
      toast(status === 'done' ? 'Task checked off' : status === 'skipped' ? 'Task skipped' : 'Task reopened', { autoClose: 1600 });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the task');
    } finally {
      setPendingId(null);
    }
  }

  if (!tasks.length) {
    return <p className="text-sm text-gray-500">{empty}</p>;
  }

  return (
    <ul className="space-y-3">
      {tasks.map((task) => {
        const busy = pendingId === task.id;
        const closed = task.status !== 'pending';
        return (
          <li key={task.id} className={`rounded-lg border bg-white p-3 ${task.status === 'pending' ? 'border-l-4 border-l-teal-600' : 'border-gray-200 opacity-80'}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium text-gray-900">{task.title}</p>
              <p className="text-xs text-gray-500">{formatDisplay(task.dueDate)} · {task.scheduleLabel}</p>
            </div>
            {task.details ? <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{task.details}</p> : null}
            {closed ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-gray-500">{task.status === 'done' ? 'Done' : 'Skipped'}</span>
                {task.notes ? <span className="text-sm text-gray-700">{task.notes}</span> : null}
                <button type="button" className="text-sm text-teal-700 underline min-h-[44px] px-2" disabled={busy} onClick={() => save(task, 'pending')}>
                  Reopen
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <label className="block text-sm text-gray-700">
                  Notes
                  <textarea
                    value={notes[task.id] ?? task.notes ?? ''}
                    onChange={(event) => setNotes((current) => ({ ...current, [task.id]: event.target.value }))}
                    placeholder="What you did, dose, or anything to remember"
                  />
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button type="button" className="btn min-h-[44px]" disabled={busy} onClick={() => save(task, 'done')}>Done</button>
                  <button type="button" className="min-h-[44px] rounded border border-gray-300 px-4 py-2 text-sm" disabled={busy} onClick={() => save(task, 'skipped')}>Skip</button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
