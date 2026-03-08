'use client'

import dynamic from 'next/dynamic'

const LineChart = dynamic(() => import('recharts').then((m) => m.LineChart), { ssr: false })
const Line = dynamic(() => import('recharts').then((m) => m.Line), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false }
)

interface SparklineChartProps {
  data: Array<Record<string, unknown>>
  dataKey: string
  color?: string
  height?: number
}

export function SparklineChart({ data, dataKey, color = '#a78bfa', height = 60 }: SparklineChartProps) {
  if (!data || data.length === 0) {
    return <div className="h-[60px] flex items-center justify-center text-gray-600 text-xs">No data</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          dot={false}
          strokeWidth={2}
        />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb', fontSize: 12 }}
          labelStyle={{ display: 'none' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
