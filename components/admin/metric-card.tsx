interface MetricCardProps {
  label: string
  value: string | number
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  highlight?: 'red' | 'green' | 'yellow' | 'default'
}

const highlightClasses: Record<string, string> = {
  red: 'text-red-400',
  green: 'text-green-400',
  yellow: 'text-yellow-400',
  default: 'text-white',
}

const trendIcons: Record<string, string> = {
  up: '↑',
  down: '↓',
  neutral: '→',
}

const trendColors: Record<string, string> = {
  up: 'text-red-400',   // up is bad for errors
  down: 'text-green-400',
  neutral: 'text-gray-400',
}

export function MetricCard({ label, value, trend, trendLabel, highlight = 'default' }: MetricCardProps) {
  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlightClasses[highlight]}`}>{value}</p>
      {trend && trendLabel && (
        <p className={`text-xs mt-1 ${trendColors[trend]}`}>
          {trendIcons[trend]} {trendLabel}
        </p>
      )}
    </div>
  )
}
