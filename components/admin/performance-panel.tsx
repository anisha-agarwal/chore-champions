'use client'

import { SparklineChart } from './sparkline-chart'
import type { PerformanceMetrics } from '@/lib/types'

interface PerformancePanelProps {
  data: PerformanceMetrics | null
  error: string | null
  onRetry: () => void
}

export function PerformancePanel({ data, error, onRetry }: PerformancePanelProps) {
  if (error) {
    return (
      <PanelShell title="Performance">
        <div className="flex flex-col items-center py-6 gap-3">
          <p className="text-gray-400 text-sm">Unable to load performance data.</p>
          <button onClick={onRetry} className="text-purple-400 hover:text-purple-300 text-sm underline">
            Retry
          </button>
        </div>
      </PanelShell>
    )
  }

  return (
    <PanelShell title="Performance">
      <p className="text-xs text-gray-500 mb-4">
        API Route Latency (server-side only). For Core Web Vitals, see{' '}
        <a
          href="https://vercel.com/analytics"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-400 hover:text-purple-300 underline"
        >
          Vercel Analytics
        </a>.
      </p>

      {/* Latency trend */}
      {data?.latency_trend && data.latency_trend.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-1">Avg Latency Trend</p>
          <SparklineChart data={data.latency_trend} dataKey="avg_ms" color="#a78bfa" height={60} />
        </div>
      )}

      {/* Route latency table */}
      {data?.route_latency && data.route_latency.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2">Route Latency (p95)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-800">
                  <th className="pb-1 pr-3">Route</th>
                  <th className="pb-1 pr-3">p95</th>
                  <th className="pb-1 pr-3">Avg</th>
                  <th className="pb-1">Calls</th>
                </tr>
              </thead>
              <tbody>
                {data.route_latency.map((row) => (
                  <tr key={row.route} className="border-b border-gray-800/40">
                    <td className="py-1 pr-3 text-gray-300 font-mono">{row.route}</td>
                    <td className={`py-1 pr-3 ${row.p95_ms > 1000 ? 'text-yellow-400' : 'text-gray-200'}`}>
                      {row.p95_ms}ms
                    </td>
                    <td className="py-1 pr-3 text-gray-400">{row.avg_ms}ms</td>
                    <td className="py-1 text-gray-500">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RPC timing table */}
      {data?.rpc_timing && data.rpc_timing.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2">RPC Timing (p95)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-800">
                  <th className="pb-1 pr-3">RPC</th>
                  <th className="pb-1 pr-3">p95</th>
                  <th className="pb-1 pr-3">Avg</th>
                  <th className="pb-1">Calls</th>
                </tr>
              </thead>
              <tbody>
                {data.rpc_timing.map((row) => (
                  <tr key={row.rpc_name} className="border-b border-gray-800/40">
                    <td className="py-1 pr-3 text-gray-300 font-mono">{row.rpc_name}</td>
                    <td className={`py-1 pr-3 ${row.p95_ms > 500 ? 'text-yellow-400' : 'text-gray-200'}`}>
                      {row.p95_ms}ms
                    </td>
                    <td className="py-1 pr-3 text-gray-400">{row.avg_ms}ms</td>
                    <td className="py-1 text-gray-500">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!data?.route_latency?.length && !data?.rpc_timing?.length && (
        <p className="text-gray-500 text-sm text-center py-4">No performance data yet.</p>
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
