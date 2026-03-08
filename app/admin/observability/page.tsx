'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { HealthPanel } from '@/components/admin/health-panel'
import { ErrorPanel } from '@/components/admin/error-panel'
import { PerformancePanel } from '@/components/admin/performance-panel'
import { UsagePanel } from '@/components/admin/usage-panel'
import type { ObservabilitySummary, ErrorListResult, PerformanceMetrics, UsageAnalytics } from '@/lib/types'

type TimeRange = '24h' | '7d' | '30d'
type UsageRange = '7d' | '30d' | '90d'

const REFRESH_INTERVAL_MS = 30_000

interface HealthStatus {
  supabase: 'ok' | 'error'
  logging_pipeline: 'ok' | 'error'
  timestamp: string
}

function ObservabilityDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const rangeParam = searchParams.get('range') as TimeRange | null
  const [range, setRange] = useState<TimeRange>(rangeParam ?? '24h')

  // Data state
  const [summary, setSummary] = useState<ObservabilitySummary | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [errors, setErrors] = useState<ErrorListResult | null>(null)
  const [errorPage, setErrorPage] = useState(1)
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null)
  const [usage, setUsage] = useState<UsageAnalytics | null>(null)

  // Error state per panel
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [errorsError, setErrorsError] = useState<string | null>(null)
  const [performanceError, setPerformanceError] = useState<string | null>(null)
  const [usageError, setUsageError] = useState<string | null>(null)

  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const usageRange: UsageRange = range === '30d' ? '30d' : '7d'

  async function fetchSummary(r: TimeRange) {
    setSummaryError(null)
    const res = await fetch(`/api/admin/observability/summary?range=${r}`)
    if (res.status === 401) { router.push('/admin/observability/login'); return }
    if (!res.ok) { setSummaryError('Failed to load'); return }
    setSummary(await res.json())
  }

  async function fetchHealth() {
    const res = await fetch('/api/observability/health')
    if (res.ok) setHealth(await res.json())
  }

  async function fetchErrors(r: TimeRange, page: number) {
    setErrorsError(null)
    const res = await fetch(`/api/admin/observability/errors?range=${r}&page=${page}`)
    if (res.status === 401) { router.push('/admin/observability/login'); return }
    if (!res.ok) { setErrorsError('Failed to load'); return }
    setErrors(await res.json())
  }

  async function fetchPerformance(r: TimeRange) {
    setPerformanceError(null)
    const res = await fetch(`/api/admin/observability/performance?range=${r}`)
    if (res.status === 401) { router.push('/admin/observability/login'); return }
    if (!res.ok) { setPerformanceError('Failed to load'); return }
    setPerformance(await res.json())
  }

  async function fetchUsage(ur: UsageRange) {
    setUsageError(null)
    const res = await fetch(`/api/admin/observability/usage?range=${ur}`)
    if (res.status === 401) { router.push('/admin/observability/login'); return }
    if (!res.ok) { setUsageError('Failed to load'); return }
    setUsage(await res.json())
  }

  const refreshAll = useCallback(async (r: TimeRange, page: number) => {
    await Promise.all([
      fetchSummary(r),
      fetchHealth(),
      fetchErrors(r, page),
      fetchPerformance(r),
      fetchUsage(r === '30d' ? '30d' : '7d'),
    ])
    setLastRefreshed(new Date())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Initial load and range change
  useEffect(() => {
    void refreshAll(range, errorPage)
  }, [range, errorPage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      void refreshAll(range, errorPage)
    }, REFRESH_INTERVAL_MS)
    return () => {
      /* istanbul ignore next -- cleanup guard: intervalRef is always set by setInterval above */
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [range, errorPage, refreshAll])

  function handleRangeChange(newRange: TimeRange) {
    setRange(newRange)
    setErrorPage(1)
    const params = new URLSearchParams(searchParams.toString())
    params.set('range', newRange)
    router.replace(`/admin/observability?${params.toString()}`)
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/observability/login')
  }

  async function handleCleanup() {
    try {
      const res = await fetch('/api/admin/observability/cleanup', { method: 'POST' })
      if (res.status === 401) { router.push('/admin/observability/login'); return }
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? 'Cleanup failed')
      }
      const result = await res.json() as { errors_deleted: number; events_deleted: number }
      toast.success(`Cleanup done: ${result.errors_deleted} errors, ${result.events_deleted} events deleted`)
      void refreshAll(range, errorPage)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cleanup failed')
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Observability Dashboard</h1>
          {lastRefreshed && (
            <p className="text-xs text-gray-500 mt-1">
              Last refreshed {lastRefreshed.toLocaleTimeString()} · Auto-refresh every 30s
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Time range selector */}
          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
            {(['24h', '7d', '30d'] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => handleRangeChange(r)}
                className={`px-3 py-1 rounded text-sm transition-colors ${range === r ? 'bg-purple-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            onClick={() => void refreshAll(range, errorPage)}
            className="px-3 py-1 text-sm bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700"
          >
            Refresh
          </button>
          <button
            onClick={() => void handleCleanup()}
            className="px-3 py-1 text-sm bg-gray-800 text-orange-300 rounded-lg hover:bg-gray-700"
            title="Delete observability data older than 90 days"
          >
            Cleanup (90d)
          </button>
          <button
            onClick={() => void handleLogout()}
            className="px-3 py-1 text-sm bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Dashboard panels */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <HealthPanel
          summary={summary}
          health={health}
          error={summaryError}
          onRetry={() => { void fetchSummary(range); void fetchHealth() }}
        />
        <ErrorPanel
          data={errors}
          error={errorsError}
          onPageChange={(p) => setErrorPage(p)}
          onRetry={() => void fetchErrors(range, errorPage)}
        />
        <PerformancePanel
          data={performance}
          error={performanceError}
          onRetry={() => void fetchPerformance(range)}
        />
        <UsagePanel
          data={usage}
          error={usageError}
          onRetry={() => void fetchUsage(usageRange)}
        />
      </div>
    </div>
  )
}

export default function ObservabilityDashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400 text-sm">Loading dashboard...</div>}>
      <ObservabilityDashboard />
    </Suspense>
  )
}
