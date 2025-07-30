import React from 'react';

interface TimeRangeSelectorProps {
  selectedRange: string;
  onRangeChange: (range: string) => void;
  className?: string;
}

interface TimeRange {
  label: string;
  value: string;
  start: string;
}

const TIME_RANGES: TimeRange[] = [
  { label: 'Past 1m', value: '1m', start: '-1m' },
  { label: 'Past 5m', value: '5m', start: '-5m' },
  { label: 'Past 30m', value: '30m', start: '-30m' },
  { label: 'Past 1h', value: '1h', start: '-1h' },
  { label: 'Past 6h', value: '6h', start: '-6h' },
  { label: 'Past 12h', value: '12h', start: '-12h' },
  { label: 'Past 24h', value: '24h', start: '-24h' },
  { label: 'Past 2d', value: '2d', start: '-2d' },
  { label: 'Past 4d', value: '4d', start: '-4d' },
  { label: 'Past 7d', value: '7d', start: '-7d' },
  { label: 'Past 30d', value: '30d', start: '-30d' },
];

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  selectedRange,
  onRangeChange,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Time Range:
      </label>
      <select
        value={selectedRange}
        onChange={(e) => onRangeChange(e.target.value)}
        className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
      >
        {TIME_RANGES.map((range) => (
          <option key={range.value} value={range.start}>
            {range.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TimeRangeSelector;