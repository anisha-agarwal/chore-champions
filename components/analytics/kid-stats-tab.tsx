'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { TimeRangeSelector } from './time-range-selector'
import { AIInsightCard } from './ai-insight-card'
import { BadgeCollection } from './badge-collection'
import { LevelProgress } from './level-progress'
import { AnalyticsSkeleton } from './analytics-skeleton'
import { formatCompletionDelta } from '@/lib/analytics-utils'
import type { KidAnalytics, KidHeatmap, UserStreaks, AnalyticsTimeRange } from '@/lib/types'
import Link from 'next/link'

// Lazy-load Recharts-dependent components to defer the ~200KB bundle
const PointsLineChart = dynamic(() => import('./points-line-chart').then((m) => ({ default: m.PointsLineChart })), { ssr: false })
const CompletionBarChart = dynamic(() => import('./completion-bar-chart').then((m) => ({ default: m.CompletionBarChart })), { ssr: false })
const StreakHeatmap = dynamic(() => import('./streak-heatmap').then((m) => ({ default: m.StreakHeatmap })), { ssr: false })

interface KidStatsTabProps {
  userId: string
}

export function KidStatsTab({ userId }: KidStatsTabProps) {
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>(12)
  const [analytics, setAnalytics] = useState<KidAnalytics | null>(null)
  const [heatmap, setHeatmap] = useState<KidHeatmap | null>(null)
  const [streaks, setStreaks] = useState<UserStreaks | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchData = useCallback(async (weeks: AnalyticsTimeRange, signal: AbortSignal) => {
    setLoading(true)
    setError(null)

    const [analyticsResult, heatmapResult, streaksResult] = await Promise.allSettled([
      supabase.rpc('get_kid_analytics', { p_user_id: userId, p_weeks: weeks }),
      supabase.rpc('get_kid_heatmap', { p_user_id: userId }),
      supabase.rpc('get_user_streaks', { p_user_id: userId }),
    ])

    if (signal.aborted) return

    if (analyticsResult.status === 'fulfilled') {
      if (analyticsResult.value.error?.code === '42501') {
        setError('auth')
        setLoading(false)
        return
      }
      setAnalytics(analyticsResult.value.data as KidAnalytics | null)
    } else {
      toast.error("Couldn't load analytics")
      setError('fetch')
    }

    if (heatmapResult.status === 'fulfilled') {
      setHeatmap(heatmapResult.value.data as KidHeatmap | null)
    }
    // heatmap failure is non-blocking

    if (streaksResult.status === 'fulfilled') {
      setStreaks(streaksResult.value.data as UserStreaks | null)
    }

    setLoading(false)
  // createClient() returns a singleton — supabase reference is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    const controller = new AbortController()
    fetchData(timeRange, controller.signal)
    return () => controller.abort()
  }, [fetchData, timeRange])

  if (loading) return <AnalyticsSkeleton />

  if (error === 'auth') {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Please sign in again to view your stats.</p>
        <Link href="/login" className="text-purple-600 font-medium mt-2 inline-block">
          Sign In
        </Link>
      </div>
    )
  }

  // Empty state: zero lifetime completions
  if (!analytics || (analytics.daily_points.length === 0 && analytics.completions_this_week === 0 && analytics.completions_last_week === 0)) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-2xl font-bold text-gray-700">Your adventure is just beginning</p>
        <p className="text-gray-500 text-sm max-w-xs mx-auto">
          Complete your first quest to start tracking your progress and earning badges.
        </p>
        <Link
          href="/quests"
          className="inline-block mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium text-sm hover:bg-purple-700 transition"
        >
          Go to Quests
        </Link>
      </div>
    )
  }

  const { direction, percentage } = formatCompletionDelta(
    analytics.completions_this_week,
    analytics.completions_last_week
  )

  return (
    <div className="space-y-6">
      {/* AI Insight */}
      <AIInsightCard userId={userId} role="child" stats={analytics} />

      {/* Level & Points */}
      <section>
        <LevelProgress points={analytics.total_points} />
      </section>

      {/* Weekly summary */}
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-purple-50 p-4 text-center">
          <p className="text-2xl font-bold text-purple-700">{analytics.completions_this_week}</p>
          <p className="text-xs text-gray-500 mt-0.5">Quests this week</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-4 text-center">
          <p className={`text-2xl font-bold ${direction === 'up' ? 'text-green-600' : direction === 'down' ? 'text-red-500' : 'text-gray-600'}`}>
            {direction === 'up' ? '+' : direction === 'down' ? '-' : ''}{percentage}%
          </p>
          <p className="text-xs text-gray-500 mt-0.5">vs last week</p>
        </div>
      </section>

      {/* Time range + points line chart */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Points over time</h3>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
        {analytics.daily_points.length > 0 ? (
          <PointsLineChart data={analytics.daily_points} />
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">
            No activity in this period — try a wider date range
          </p>
        )}
      </section>

      {/* Week comparison bar */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Week comparison</h3>
        <CompletionBarChart
          thisWeek={analytics.completions_this_week}
          lastWeek={analytics.completions_last_week}
        />
      </section>

      {/* Heatmap */}
      {heatmap && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Activity heatmap</h3>
          <StreakHeatmap data={heatmap.heatmap_data} />
        </section>
      )}

      {/* Badges */}
      {streaks && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Badges ({analytics.milestones.length})
          </h3>
          <BadgeCollection badges={analytics.milestones} streaks={streaks} />
        </section>
      )}
    </div>
  )
}
