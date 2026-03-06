'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS } from '@/lib/analytics-constants'

interface CompletionBarChartProps {
  thisWeek: number
  lastWeek: number
}

export function CompletionBarChart({ thisWeek, lastWeek }: CompletionBarChartProps) {
  const data = [
    { week: 'Last Week', completions: lastWeek },
    { week: 'This Week', completions: thisWeek },
  ]

  return (
    <div>
      <div
        role="img"
        aria-label={`Week comparison: last week ${lastWeek} completions, this week ${thisWeek} completions`}
      >
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              formatter={(value: number | undefined) => [value ?? 0, 'Completions']}
            />
            <Bar
              dataKey="completions"
              fill={CHART_COLORS.primary}
              radius={[4, 4, 0, 0]}
              maxBarSize={60}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Screen-reader table */}
      <table className="sr-only">
        <caption>Week over week completions comparison</caption>
        <thead>
          <tr>
            <th>Week</th>
            <th>Completions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.week}>
              <td>{d.week}</td>
              <td>{d.completions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
