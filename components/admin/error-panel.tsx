'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { ErrorTable } from './error-table'
import type { ErrorListResult, AppError } from '@/lib/types'
import type { APP_ERROR_TYPES } from '@/lib/observability/constants'

const BarChart = dynamic(() => import('recharts').then((m) => m.BarChart), { ssr: false })
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false })
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false })

type ErrorType = typeof APP_ERROR_TYPES[number]

interface ErrorPanelProps {
  data: ErrorListResult | null
  error: string | null
  onPageChange: (page: number) => void
  onRetry: () => void
}

function groupByRoute(errors: AppError[]): Array<{ route: string; count: number }> {
  const map = new Map<string, number>()
  for (const e of errors) {
    map.set(e.route, (map.get(e.route) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([route, count]) => ({ route, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
}

export function ErrorPanel({ data, error, onPageChange, onRetry }: ErrorPanelProps) {
  const [typeFilter, setTypeFilter] = useState<ErrorType | ''>('')

  if (error) {
    return (
      <PanelShell title="Errors">
        <div className="flex flex-col items-center py-6 gap-3">
          <p className="text-gray-400 text-sm">Unable to load error data.</p>
          <button onClick={onRetry} className="text-purple-400 hover:text-purple-300 text-sm underline">
            Retry
          </button>
        </div>
      </PanelShell>
    )
  }

  const errors = data?.errors ?? []
  const byRoute = groupByRoute(errors)

  return (
    <PanelShell title="Errors">
      {/* Type filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['', 'rpc', 'api', 'client', 'boundary', 'middleware'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTypeFilter(t)
              onPageChange(1)
            }}
            className={`text-xs px-2 py-1 rounded ${typeFilter === t ? 'bg-purple-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {t === '' ? 'All' : t}
          </button>
        ))}
      </div>

      {/* Bar chart by route */}
      {byRoute.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-1">Errors by Route</p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={byRoute} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <Bar dataKey="count" fill="#f87171" radius={2} />
              <XAxis dataKey="route" tick={{ fontSize: 9, fill: '#9ca3af' }} interval={0} height={20} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb', fontSize: 12 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Error table */}
      <ErrorTable
        errors={errors}
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        totalPages={data?.total_pages ?? 1}
        onPageChange={onPageChange}
      />
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
