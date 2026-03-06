'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { TimeRangeSelector } from './time-range-selector'
import { AIInsightCard } from './ai-insight-card'
import { AnalyticsSkeleton } from './analytics-skeleton'
import type { FamilyAnalytics, AnalyticsTimeRange } from '@/lib/types'
import Link from 'next/link'

// Lazy-load Recharts-dependent components
const ChildComparisonChart = dynamic(() => import('./child-comparison-chart').then((m) => ({ default: m.ChildComparisonChart })), { ssr: false })
const TaskFrequencyChart = dynamic(() => import('./task-frequency-chart').then((m) => ({ default: m.TaskFrequencyChart })), { ssr: false })
const DonutChart = dynamic(() => import('./donut-chart').then((m) => ({ default: m.DonutChart })), { ssr: false })
const TrendLineChart = dynamic(() => import('./trend-line-chart').then((m) => ({ default: m.TrendLineChart })), { ssr: false })

interface ParentAnalyticsProps {
  familyId: string
  userId: string
}

export function ParentAnalytics({ familyId, userId }: ParentAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>(12)
  const [analytics, setAnalytics] = useState<FamilyAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchData = useCallback(async (weeks: AnalyticsTimeRange, signal: AbortSignal) => {
    setLoading(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('get_family_analytics', {
      p_family_id: familyId,
      p_weeks: weeks,
    })

    if (signal.aborted) return

    if (rpcError) {
      if (rpcError.code === '42501') {
        setError('auth')
      } else {
        toast.error("Couldn't load family analytics")
        setError('fetch')
      }
      setLoading(false)
      return
    }

    setAnalytics(data as FamilyAnalytics | null)
    setLoading(false)
  // createClient() returns a singleton — supabase reference is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId])

  useEffect(() => {
    const controller = new AbortController()
    fetchData(timeRange, controller.signal)
    return () => controller.abort()
  }, [fetchData, timeRange])

  if (loading) return <AnalyticsSkeleton />

  if (error === 'auth') {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">You need to be a parent to view family analytics.</p>
        <Link href="/family" className="text-purple-600 font-medium mt-2 inline-block">
          Go to Family
        </Link>
      </div>
    )
  }

  if (!analytics || analytics.children.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-xl font-bold text-gray-700">Invite your kids to see their progress here</p>
        <p className="text-gray-500 text-sm max-w-xs mx-auto">
          Once your children join the family, you&apos;ll see their quest completions and trends here.
        </p>
        <Link
          href="/family"
          className="inline-block mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium text-sm hover:bg-purple-700 transition"
        >
          Go to Family
        </Link>
      </div>
    )
  }

  const completionRate = Math.round(analytics.family_completion_rate * 100)
  const totalCompletionsThisWeek = analytics.children.reduce(
    (sum, c) => sum + c.completions_this_week,
    0
  )

  return (
    <div className="space-y-6">
      {/* AI Insight */}
      <AIInsightCard userId={userId} role="parent" stats={analytics} />

      {/* Summary stats */}
      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-purple-50 p-3 text-center">
          <p className="text-2xl font-bold text-purple-700">{completionRate}%</p>
          <p className="text-xs text-gray-500 mt-0.5">Completion rate</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 text-center">
          <p className="text-2xl font-bold text-gray-800">{totalCompletionsThisWeek}</p>
          <p className="text-xs text-gray-500 mt-0.5">Quests this week</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 text-center">
          <p className="text-2xl font-bold text-gray-800">{analytics.children.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Kids</p>
        </div>
      </section>

      {/* Per-child completion rates */}
      {analytics.children.some((c) => c.completions_this_week === 0) && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          No quests completed yet for some kids. Assign quests to start tracking.
        </div>
      )}

      {/* Child comparison */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Child comparison</h3>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
        <ChildComparisonChart items={analytics.children} />
      </section>

      {/* Trend */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Activity trend</h3>
        <TrendLineChart data={analytics.daily_totals} />
      </section>

      {/* Points distribution */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Points distribution</h3>
        <DonutChart items={analytics.children} />
      </section>

      {/* Top tasks */}
      {analytics.top_tasks.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Most completed quests</h3>
          <TaskFrequencyChart
            tasks={analytics.top_tasks}
            title="Most completed quests"
            limit={10}
          />
        </section>
      )}

      {/* Bottom tasks */}
      {analytics.bottom_tasks.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Least completed quests</h3>
          <TaskFrequencyChart
            tasks={analytics.bottom_tasks}
            title="Least completed quests"
            barColor="#f59e0b"
            limit={5}
          />
        </section>
      )}
    </div>
  )
}
