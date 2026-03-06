'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS } from '@/lib/analytics-constants'
import { aggregateByWeek } from '@/lib/analytics-utils'
import type { DailyPoint } from '@/lib/types'

interface TrendLineChartProps {
  data: DailyPoint[]
  title?: string
}

export function TrendLineChart({ data, title = 'Family activity trend' }: TrendLineChartProps) {
  const weekly = aggregateByWeek(data).map((w) => ({
    ...w,
    label: w.week.slice(5), // MM-DD
  }))

  if (weekly.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">
        No activity data in this period.
      </p>
    )
  }

  return (
    <div>
      <div role="img" aria-label={`${title}: ${weekly.length} weeks of data`}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={weekly} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            <Legend formatter={(v) => <span style={{ fontSize: 12, color: '#374151' }}>{v}</span>} />
            <Line
              type="monotone"
              dataKey="completions"
              name="Completions"
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="points"
              name="Points"
              stroke={CHART_COLORS.secondary}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Screen-reader table */}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Week</th>
            <th>Completions</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {weekly.map((w) => (
            <tr key={w.week}>
              <td>{w.week}</td>
              <td>{w.completions}</td>
              <td>{w.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
