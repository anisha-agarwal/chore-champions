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
import type { TaskFrequency } from '@/lib/types'

interface TaskFrequencyChartProps {
  tasks: TaskFrequency[]
  title?: string
  barColor?: string
  limit?: number
}

export function TaskFrequencyChart({
  tasks,
  title = 'Task frequency',
  barColor = CHART_COLORS.secondary,
  limit = 10,
}: TaskFrequencyChartProps) {
  const data = tasks
    .slice(0, limit)
    .map((t) => ({ name: t.title.length > 20 ? t.title.slice(0, 18) + '…' : t.title, count: t.count, fullTitle: t.title }))

  if (data.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-4">
        No completed tasks yet.
      </p>
    )
  }

  return (
    <div>
      <div role="img" aria-label={`${title}: horizontal bar chart of ${data.length} tasks`}>
        <ResponsiveContainer width="100%" height={Math.max(160, data.length * 32)}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: '#374151' }}
              tickLine={false}
              width={100}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              formatter={(value: number | undefined) => [value ?? 0, 'Completions']}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullTitle ?? ''}
            />
            <Bar dataKey="count" fill={barColor} radius={[0, 4, 4, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Screen-reader table */}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Task</th>
            <th>Completions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.slice(0, limit).map((t) => (
            <tr key={t.task_id}>
              <td>{t.title}</td>
              <td>{t.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
