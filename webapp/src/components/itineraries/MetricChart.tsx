'use client';

import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function MetricChart({
  actuals,
  expected,
}: {
  actuals: { recordedOn: string; value: number | null }[];
  expected: number | null;
}) {
  const points = actuals.filter((actual) => actual.value != null);
  if (points.length < 2) return null;
  return (
    <div className="h-36 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <XAxis dataKey="recordedOn" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={36} />
          <Tooltip />
          {expected != null ? <ReferenceLine y={expected} stroke="#0d9488" strokeDasharray="4 4" /> : null}
          <Line type="monotone" dataKey="value" stroke="#0f766e" dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
