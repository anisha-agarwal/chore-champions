'use client'

import { Suspense } from 'react'
import { HealthPanel } from '@/components/admin/health-panel'
import { ErrorPanel } from '@/components/admin/error-panel'
import { PerformancePanel } from '@/components/admin/performance-panel'
import { UsagePanel } from '@/components/admin/usage-panel'
import type { ObservabilitySummary, ErrorListResult, PerformanceMetrics, UsageAnalytics } from '@/lib/types'

// --- Sample data ---

const sampleSummary: ObservabilitySummary = {
  error_count: 3,
  prev_error_count: 5,
  active_users: 127,
  avg_latency_ms: 142,
  error_rate_trend: [
    { time: '00:00', count: 1 }, { time: '01:00', count: 0 }, { time: '02:00', count: 0 },
    { time: '03:00', count: 0 }, { time: '04:00', count: 1 }, { time: '05:00', count: 0 },
    { time: '06:00', count: 0 }, { time: '07:00', count: 0 }, { time: '08:00', count: 2 },
    { time: '09:00', count: 1 }, { time: '10:00', count: 0 }, { time: '11:00', count: 0 },
    { time: '12:00', count: 1 }, { time: '13:00', count: 0 }, { time: '14:00', count: 0 },
    { time: '15:00', count: 0 }, { time: '16:00', count: 1 }, { time: '17:00', count: 0 },
    { time: '18:00', count: 0 }, { time: '19:00', count: 1 }, { time: '20:00', count: 0 },
    { time: '21:00', count: 0 }, { time: '22:00', count: 0 }, { time: '23:00', count: 0 },
  ],
  top_errors: [
    { error_message: 'Anthropic API timeout after 5000ms', route: '/api/ai/encouragement', count: 2 },
    { error_message: 'Query exceeded 2s timeout', route: 'get_family_analytics', count: 1 },
  ],
  route_latency: [
    { route: '/api/ai/analytics-insights', p95_ms: 2340, avg_ms: 1820, count: 89 },
    { route: '/api/ai/encouragement', p95_ms: 1890, avg_ms: 1240, count: 312 },
  ],
}

const sampleHealth = {
  supabase: 'ok' as const,
  logging_pipeline: 'ok' as const,
  timestamp: new Date().toISOString(),
}

const sampleErrors: ErrorListResult = {
  errors: [
    { id: 'e1', error_message: 'Anthropic API timeout after 5000ms', error_type: 'api', error_code: 'TIMEOUT', route: '/api/ai/encouragement', method: 'POST', user_id: null, metadata: { duration_ms: 5012 }, created_at: new Date(Date.now() - 2 * 60_000).toISOString() },
    { id: 'e2', error_message: 'Query exceeded 2s timeout threshold', error_type: 'rpc', error_code: null, route: 'get_family_analytics', method: null, user_id: 'u-abc', metadata: { rpc: 'get_family_analytics' }, created_at: new Date(Date.now() - 18 * 60_000).toISOString() },
    { id: 'e3', error_message: "Cannot read properties of null (reading 'map')", error_type: 'boundary', error_code: null, route: '/quests', method: null, user_id: 'u-xyz', metadata: { component: 'TaskList' }, created_at: new Date(Date.now() - 60 * 60_000).toISOString() },
  ],
  total: 3,
  page: 1,
  total_pages: 1,
}

const samplePerformance: PerformanceMetrics = {
  route_latency: [
    { route: '/api/ai/analytics-insights', p95_ms: 2340, avg_ms: 1820, min_ms: 1100, max_ms: 3200, count: 89 },
    { route: '/api/ai/encouragement', p95_ms: 1890, avg_ms: 1240, min_ms: 800, max_ms: 2600, count: 312 },
    { route: '/api/ai/parse-quest', p95_ms: 680, avg_ms: 420, min_ms: 200, max_ms: 980, count: 156 },
    { route: '/api/observability/ingest', p95_ms: 12, avg_ms: 8, min_ms: 4, max_ms: 28, count: 4821 },
  ],
  rpc_timing: [
    { rpc_name: 'get_family_analytics', p95_ms: 520, avg_ms: 380, min_ms: 150, max_ms: 820, count: 234 },
    { rpc_name: 'get_kid_analytics', p95_ms: 340, avg_ms: 210, min_ms: 80, max_ms: 560, count: 445 },
    { rpc_name: 'get_user_streaks', p95_ms: 89, avg_ms: 52, min_ms: 20, max_ms: 180, count: 1203 },
    { rpc_name: 'get_kid_heatmap', p95_ms: 145, avg_ms: 98, min_ms: 40, max_ms: 280, count: 387 },
    { rpc_name: 'accept_family_invite', p95_ms: 78, avg_ms: 45, min_ms: 18, max_ms: 120, count: 23 },
  ],
  latency_trend: [
    { time: '00:00', avg_ms: 160 }, { time: '04:00', avg_ms: 140 },
    { time: '08:00', avg_ms: 180 }, { time: '12:00', avg_ms: 155 },
    { time: '16:00', avg_ms: 170 }, { time: '20:00', avg_ms: 130 },
  ],
}

const sampleUsage: UsageAnalytics = {
  daily_active_users: [
    { date: '2026-03-02', users: 98 }, { date: '2026-03-03', users: 105 },
    { date: '2026-03-04', users: 112 }, { date: '2026-03-05', users: 118 },
    { date: '2026-03-06', users: 122 }, { date: '2026-03-07', users: 125 },
    { date: '2026-03-08', users: 127 },
  ],
  top_chores: [
    { task_name: 'Make Bed', count: 312 }, { task_name: 'Load Dishwasher', count: 245 },
    { task_name: 'Take Out Trash', count: 198 }, { task_name: 'Feed Pets', count: 176 },
    { task_name: 'Tidy Room', count: 134 },
  ],
  least_chores: [
    { task_name: 'Mow Lawn', count: 8 }, { task_name: 'Clean Garage', count: 12 },
    { task_name: 'Wash Car', count: 15 },
  ],
  peak_hours: [
    { hour: 6, count: 34 }, { hour: 7, count: 78 }, { hour: 8, count: 112 },
    { hour: 15, count: 89 }, { hour: 16, count: 134 }, { hour: 17, count: 198 },
    { hour: 18, count: 245 }, { hour: 19, count: 312 }, { hour: 20, count: 267 },
    { hour: 21, count: 156 },
  ],
  ai_call_volume: [
    { date: '2026-03-02', count: 89 }, { date: '2026-03-03', count: 102 },
    { date: '2026-03-04', count: 95 }, { date: '2026-03-05', count: 110 },
    { date: '2026-03-06', count: 118 }, { date: '2026-03-07', count: 125 },
    { date: '2026-03-08', count: 108 },
  ],
  event_counts: {
    task_completed: 1847, page_view: 12405, rpc_call: 8234, api_request: 5612,
    reward_claimed: 423, streak_milestone: 89, ai_insight_generated: 234,
    ai_encouragement: 312, ai_quest_parsed: 156, family_joined: 18,
  },
}

// --- Component ---

function DemoObservabilityDashboard() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Observability Dashboard</h1>
          <p className="text-xs text-gray-500 mt-1">
            Demo mode — sample data · <a href="https://github.com/anishadhamani/chore-champions" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">View source</a>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
            <button className="px-3 py-1 rounded text-sm bg-purple-700 text-white">24h</button>
            <button className="px-3 py-1 rounded text-sm text-gray-400 cursor-default">7d</button>
            <button className="px-3 py-1 rounded text-sm text-gray-400 cursor-default">30d</button>
          </div>
          <span className="px-3 py-1 text-sm bg-gray-800/50 text-gray-500 rounded-lg border border-gray-800">
            Demo mode
          </span>
        </div>
      </div>

      {/* Dashboard panels */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <HealthPanel
          summary={sampleSummary}
          health={sampleHealth}
          error={null}
          onRetry={() => {}}
        />
        <ErrorPanel
          data={sampleErrors}
          error={null}
          onPageChange={() => {}}
          onRetry={() => {}}
        />
        <PerformancePanel
          data={samplePerformance}
          error={null}
          onRetry={() => {}}
        />
        <UsagePanel
          data={sampleUsage}
          error={null}
          onRetry={() => {}}
        />
      </div>
    </div>
  )
}

export default function DemoObservabilityPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400 text-sm">Loading demo...</div>}>
      <DemoObservabilityDashboard />
    </Suspense>
  )
}
