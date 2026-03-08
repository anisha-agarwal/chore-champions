'use client'

import { MetricCard } from './metric-card'
import { SparklineChart } from './sparkline-chart'
import type { ObservabilitySummary } from '@/lib/types'

interface HealthStatus {
  supabase: 'ok' | 'error'
  logging_pipeline: 'ok' | 'error'
  timestamp: string
}

interface HealthPanelProps {
  summary: ObservabilitySummary | null
  health: HealthStatus | null
  error: string | null
  onRetry: () => void
}

const statusColor = (s: 'ok' | 'error' | undefined) =>
  s === 'ok' ? 'text-green-400' : 'text-red-400'

const statusDot = (s: 'ok' | 'error' | undefined) =>
  s === 'ok'
    ? 'w-2 h-2 rounded-full bg-green-400 inline-block mr-1'
    : 'w-2 h-2 rounded-full bg-red-400 inline-block mr-1'

export function HealthPanel({ summary, health, error, onRetry }: HealthPanelProps) {
  if (error) {
    return (
      <PanelShell title="Health">
        <div className="flex flex-col items-center py-6 gap-3">
          <p className="text-gray-400 text-sm">Unable to load health data.</p>
          <button onClick={onRetry} className="text-purple-400 hover:text-purple-300 text-sm underline">
            Retry
          </button>
        </div>
      </PanelShell>
    )
  }

  const errorTrend = summary?.error_count != null && summary?.prev_error_count != null
    ? summary.error_count > summary.prev_error_count
      ? 'up'
      : summary.error_count < summary.prev_error_count
        ? 'down'
        : 'neutral'
    : undefined

  return (
    <PanelShell title="Health">
      {/* Status indicators */}
      <div className="flex gap-4 mb-4 text-sm">
        <div>
          <span className={statusDot(health?.supabase)} />
          <span className={statusColor(health?.supabase)}>Supabase</span>
        </div>
        <div>
          <span className={statusDot(health?.logging_pipeline)} />
          <span className={statusColor(health?.logging_pipeline)}>Logging</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <MetricCard
          label="Errors"
          value={summary?.error_count ?? '—'}
          trend={errorTrend}
          trendLabel={errorTrend === 'up' ? 'vs prev period' : errorTrend === 'down' ? 'vs prev period' : undefined}
          highlight={
            summary?.error_count != null && summary.error_count > 0 ? 'red' : 'green'
          }
        />
        <MetricCard
          label="Active Users"
          value={summary?.active_users ?? '—'}
          highlight="default"
        />
        <MetricCard
          label="Avg Latency"
          value={summary?.avg_latency_ms != null ? `${summary.avg_latency_ms}ms` : '—'}
          highlight={
            summary?.avg_latency_ms != null && summary.avg_latency_ms > 1000
              ? 'yellow'
              : 'default'
          }
        />
      </div>

      {/* Error rate sparkline */}
      {summary?.error_rate_trend && summary.error_rate_trend.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-1">Error Rate (hourly)</p>
          <SparklineChart
            data={summary.error_rate_trend}
            dataKey="count"
            color="#f87171"
            height={60}
          />
        </div>
      )}
    </PanelShell>
  )
}

function PanelShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h2 className="text-lg font-semibold text-gray-100 mb-4">{title}</h2>
      {children}
    </div>
  )
}
