'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ImSpinner9 } from 'react-icons/im';
import { TbReload } from 'react-icons/tb';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import TimeRangeSelector from './TimeRangeSelector';

interface ChartPoint {
  timestamp: number;
  value: number | null;
}

function parseTimeRangeMs(timeRange: string): number {
  const match = /^-?(\d+)([mhd])$/.exec(timeRange);
  if (!match) return 24 * 60 * 60 * 1000;

  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === 'm') return amount * 60 * 1000;
  if (unit === 'h') return amount * 60 * 60 * 1000;
  return amount * 24 * 60 * 60 * 1000;
}

/** Break the line when consecutive samples are farther apart than this. */
function gapThresholdMs(timeRange: string): number {
  const rangeMs = parseTimeRangeMs(timeRange);
  // ~1/96 of the window (15m for 24h), clamped to [1m, 1h]
  return Math.min(Math.max(rangeMs / 96, 60 * 1000), 60 * 60 * 1000);
}

function toChartPoints(
  raw: { time: string; value: number }[],
  thresholdMs: number
): ChartPoint[] {
  const points = raw
    .map((point) => ({
      timestamp: new Date(point.time).getTime(),
      value: point.value,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (points.length === 0) return [];

  const withGaps: ChartPoint[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (curr.timestamp - prev.timestamp > thresholdMs) {
      // Null breaks the Recharts line across the missing interval
      withGaps.push({ timestamp: prev.timestamp + 1, value: null });
    }
    withGaps.push(curr);
  }
  return withGaps;
}

const WaterLevelChart: React.FC = () => {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('-24h');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/water-level?timeRange=${encodeURIComponent(timeRange)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch water level data');
      }

      const result = await response.json();
      setData(toChartPoints(result.data ?? [], gapThresholdMs(timeRange)));
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch water level data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rangeMs = parseTimeRangeMs(timeRange);
  const domainEnd = lastUpdated?.getTime() ?? Date.now();
  const domainStart = domainEnd - rangeMs;

  const formatTick = (timestamp: number) => {
    const date = new Date(timestamp);
    if (rangeMs <= 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatTooltipTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="bg-white shadow rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">Water Level Chart</h2>
          <TbReload
            size={24}
            strokeWidth={3}
            onClick={fetchData}
            className="text-teal-600 cursor-pointer rounded-full hover:bg-neutral-100 p-1"
            title="Refresh data"
          />
        </div>
        <TimeRangeSelector
          selectedRange={timeRange}
          onRangeChange={setTimeRange}
        />
      </div>

      {lastUpdated && (
        <div className="text-xs text-gray-500 mb-2">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <ImSpinner9 className="animate-spin text-2xl text-teal-600 mr-2" />
          <span className="text-gray-600">Loading chart data...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No data available for the selected time range
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={[domainStart, domainEnd]}
                tickFormatter={formatTick}
                stroke="#666"
                fontSize={12}
                tick={{ fill: '#666' }}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#666"
                fontSize={12}
                tick={{ fill: '#666' }}
                label={{ value: 'Water Level (%)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                labelFormatter={(value) => `Time: ${formatTooltipTime(Number(value))}`}
                formatter={(value) =>
                  value == null
                    ? ['—', 'Water Level']
                    : [`${Number(value).toFixed(1)}%`, 'Water Level']
                }
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0d9488"
                strokeWidth={2}
                connectNulls={false}
                dot={{ fill: '#0d9488', strokeWidth: 0, r: 2 }}
                activeDot={{ r: 4, stroke: '#0d9488', strokeWidth: 2, fill: '#fff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default WaterLevelChart;
