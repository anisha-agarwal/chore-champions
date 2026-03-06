'use client'

import type { AnalyticsTimeRange } from '@/lib/types'

interface TimeRangeSelectorProps {
  value: AnalyticsTimeRange
  onChange: (range: AnalyticsTimeRange) => void
}

const RANGES: { value: AnalyticsTimeRange; label: string }[] = [
  { value: 4, label: '4w' },
  { value: 12, label: '12w' },
  { value: 26, label: '26w' },
]

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex gap-1" role="group" aria-label="Select time range">
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          aria-pressed={value === r.value}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
            value === r.value
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
