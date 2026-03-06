'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS } from '@/lib/analytics-constants'
import type { ChildStats } from '@/lib/types'

interface ChildComparisonChartProps {
  items: ChildStats[]
}

export function ChildComparisonChart({ items }: ChildComparisonChartProps) {
  const data = items.map((c) => ({
    name: c.profile.nickname ?? c.profile.display_name,
    'This Week': c.completions_this_week,
    'Last Week': c.completions_last_week,
  }))

  if (data.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">
        No children in the family yet.
      </p>
    )
  }

  return (
    <div>
      <div
        role="img"
        aria-label={`Child comparison: ${data.length} children, this week vs last week completions`}
      >
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              formatter={(value: number | undefined) => [value ?? 0, '']}
            />
            <Legend formatter={(v) => <span style={{ fontSize: 12, color: '#374151' }}>{v}</span>} />
            <Bar dataKey="Last Week" fill={CHART_COLORS.quaternary} radius={[4, 4, 0, 0]} maxBarSize={30} />
            <Bar dataKey="This Week" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Screen-reader table */}
      <table className="sr-only">
        <caption>Child completion comparison this week vs last week</caption>
        <thead>
          <tr>
            <th>Child</th>
            <th>This Week</th>
            <th>Last Week</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.profile.id}>
              <td>{c.profile.nickname ?? c.profile.display_name}</td>
              <td>{c.completions_this_week}</td>
              <td>{c.completions_last_week}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
