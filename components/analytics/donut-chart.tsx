'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { ChildStats } from '@/lib/types'
import { CHART_COLORS } from '@/lib/analytics-constants'

interface DonutChartProps {
  items: ChildStats[]
}

const COLORS = Object.values(CHART_COLORS)

export function DonutChart({ items }: DonutChartProps) {
  const data = items.map((c) => ({
    name: c.profile.nickname ?? c.profile.display_name,
    value: c.profile.points,
  })).filter((d) => d.value > 0)

  if (data.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">
        No points earned yet.
      </p>
    )
  }

  const totalPoints = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div>
      <div role="img" aria-label={`Points distribution among ${data.length} children`}>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              formatter={(value: number | undefined) => [(value ?? 0).toLocaleString(), 'Points']}
            />
            <Legend
              formatter={(value) => <span style={{ fontSize: 12, color: '#374151' }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Screen-reader table */}
      <table className="sr-only">
        <caption>Points distribution by child</caption>
        <thead>
          <tr>
            <th>Child</th>
            <th>Points</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => {
            // totalPoints is always > 0 here since data is filtered to value > 0
            const pct = Math.round((d.value / totalPoints) * 100)
            return (
              <tr key={d.name}>
                <td>{d.name}</td>
                <td>{d.value}</td>
                <td>{pct}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
