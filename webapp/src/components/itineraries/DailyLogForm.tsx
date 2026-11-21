'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';

import { todayISO } from '@/lib/itineraries/dates';
import type { LogField } from '@/lib/itineraries/types';

const labels: Record<LogField, string> = {
  photo: 'Photo',
  notes: 'Notes',
  actions: 'Actions',
  issues: 'Issues',
  heightCm: 'Height (cm)',
  nodes: 'Nodes',
  wateringMl: 'Watering (ml)',
  ph: 'pH',
  ec: 'EC',
  tempC: 'Temperature (°C)',
  humidityPct: 'Humidity (%)',
};

const numericFields: LogField[] = ['heightCm', 'nodes', 'wateringMl', 'ph', 'ec', 'tempC', 'humidityPct'];

export function DailyLogForm({
  itineraryId,
  logFields,
  actions,
  issues,
}: {
  itineraryId: string;
  logFields: LogField[];
  actions: string[];
  issues: string[];
}) {
  const router = useRouter();
  const [logDate, setLogDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  function toggle(list: string[], value: string, setList: (next: string[]) => void) {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function uploadPhoto(): Promise<string | null> {
    if (!file) return null;
    const form = new FormData();
    form.set('file', file);
    const response = await fetch(`/api/itineraries/${itineraryId}/photos`, { method: 'POST', body: form });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Could not store the photo');
    return body.key as string;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const photoKey = await uploadPhoto();
      const payload: Record<string, unknown> = {
        logDate,
        notes,
        actions: selectedActions,
        issues: selectedIssues,
        photoKey,
      };
      for (const field of numericFields) {
        if (!logFields.includes(field)) continue;
        payload[field] = numbers[field] ?? '';
      }
      const response = await fetch(`/api/itineraries/${itineraryId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not save the log');
      toast('Log saved', { autoClose: 1600 });
      setNotes('');
      setSelectedActions([]);
      setSelectedIssues([]);
      setNumbers({});
      setFile(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the log');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-white shadow rounded-lg p-4 space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Date
        <input type="date" value={logDate} onChange={(event) => setLogDate(event.target.value)} required />
      </label>
      {numericFields.filter((field) => logFields.includes(field)).map((field) => (
        <label key={field} className="block text-sm font-medium text-gray-700">
          {labels[field]}
          <input
            type="number"
            step="any"
            inputMode="decimal"
            value={numbers[field] ?? ''}
            onChange={(event) => setNumbers((current) => ({ ...current, [field]: event.target.value }))}
          />
        </label>
      ))}
      {logFields.includes('actions') && (
        <fieldset>
          <legend className="text-sm font-medium text-gray-700 mb-2">{labels.actions}</legend>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => toggle(selectedActions, action, setSelectedActions)}
                className={`px-3 min-h-[44px] rounded-full border text-sm ${selectedActions.includes(action) ? 'bg-teal-600 text-white border-teal-600' : 'bg-white'}`}
              >
                {action}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {logFields.includes('issues') && (
        <fieldset>
          <legend className="text-sm font-medium text-gray-700 mb-2">{labels.issues}</legend>
          <div className="flex flex-wrap gap-2">
            {issues.map((issue) => (
              <button
                key={issue}
                type="button"
                onClick={() => toggle(selectedIssues, issue, setSelectedIssues)}
                className={`px-3 min-h-[44px] rounded-full border text-sm ${selectedIssues.includes(issue) ? 'bg-amber-600 text-white border-amber-600' : 'bg-white'}`}
              >
                {issue}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {logFields.includes('photo') && (
        <label className="block text-sm font-medium text-gray-700">
          {labels.photo}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="mt-1 block w-full text-sm" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
      )}
      {logFields.includes('notes') && (
        <label className="block text-sm font-medium text-gray-700">
          {labels.notes}
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What happened today" />
        </label>
      )}
      <button type="submit" className="btn w-full min-h-[44px]" disabled={saving}>{saving ? 'Saving…' : 'Save log'}</button>
    </form>
  );
}
