'use client'

import dynamic from 'next/dynamic'
import type { UsageAnalytics } from '@/lib/types'

const LineChart = dynamic(() => import('recharts').then((m) => m.LineChart), { ssr: false })
const Line = dynamic(() => import('recharts').then((m) => m.Line), { ssr: false })
const BarChart = dynamic(() => import('recharts').then((m) => m.BarChart), { ssr: false })
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false })
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false })

interface UsagePanelProps {
  data: UsageAnalytics | null
  error: string | null
  onRetry: () => void
}

export function UsagePanel({ data, error, onRetry }: UsagePanelProps) {
  if (error) {
    return (
      <PanelShell title="Usage">
        <div className="flex flex-col items-center py-6 gap-3">
          <p className="text-gray-400 text-sm">Unable to load usage data.</p>
          <button onClick={onRetry} className="text-purple-400 hover:text-purple-300 text-sm underline">
            Retry
          </button>
        </div>
      </PanelShell>
    )
  }

  const tooltipStyle = { background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb', fontSize: 12 }

  return (
    <PanelShell title="Usage">
      {/* DAU line chart */}
      <div className="mb-6">
        <p className="text-xs text-gray-400 mb-1">Daily Active Users</p>
        {data?.daily_active_users && data.daily_active_users.length > 0 ? (
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={data.daily_active_users} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <Line type="monotone" dataKey="users" stroke="#34d399" dot={false} strokeWidth={2} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} interval="preserveStartEnd" height={20} />
              <Tooltip contentStyle={tooltipStyle} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[100px] flex items-center justify-center text-gray-600 text-xs">No data</div>
        )}
      </div>

      {/* Top chores + Least completed side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-xs text-gray-400 mb-2">Most Completed Chores</p>
          {data?.top_chores && data.top_chores.length > 0 ? (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={data.top_chores} layout="vertical" margin={{ top: 2, right: 10, bottom: 2, left: 2 }}>
                <Bar dataKey="count" fill="#a78bfa" radius={2} />
                <XAxis type="number" tick={{ fontSize: 9, fill: '#9ca3af' }} />
                <Tooltip contentStyle={tooltipStyle} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[120px] flex items-center justify-center text-gray-600 text-xs">No data</div>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-2">Least Completed Chores</p>
          {data?.least_chores && data.least_chores.length > 0 ? (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={data.least_chores} layout="vertical" margin={{ top: 2, right: 10, bottom: 2, left: 2 }}>
                <Bar dataKey="count" fill="#f87171" radius={2} />
                <XAxis type="number" tick={{ fontSize: 9, fill: '#9ca3af' }} />
                <Tooltip contentStyle={tooltipStyle} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[120px] flex items-center justify-center text-gray-600 text-xs">No data</div>
          )}
        </div>
      </div>

      {/* Peak hours */}
      <div className="mb-6">
        <p className="text-xs text-gray-400 mb-1">Peak Usage Hours (UTC)</p>
        {data?.peak_hours && data.peak_hours.length > 0 ? (
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={data.peak_hours} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <Bar dataKey="count" fill="#60a5fa" radius={2} />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#9ca3af' }} />
              <Tooltip contentStyle={tooltipStyle} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[80px] flex items-center justify-center text-gray-600 text-xs">No data</div>
        )}
      </div>

      {/* AI call volume */}
      <div className="mb-6">
        <p className="text-xs text-gray-400 mb-1">AI API Calls (daily)</p>
        {data?.ai_call_volume && data.ai_call_volume.length > 0 ? (
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={data.ai_call_volume} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <Bar dataKey="count" fill="#fbbf24" radius={2} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} interval="preserveStartEnd" />
              <Tooltip contentStyle={tooltipStyle} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[80px] flex items-center justify-center text-gray-600 text-xs">No data</div>
        )}
      </div>

      {/* Event counts */}
      {data?.event_counts && Object.keys(data.event_counts).length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2">Event Counts</p>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(data.event_counts)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <div key={type} className="flex justify-between text-xs py-1 border-b border-gray-800/30">
                  <span className="text-gray-400 font-mono">{type}</span>
                  <span className="text-gray-200">{count}</span>
                </div>
              ))}
          </div>
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
