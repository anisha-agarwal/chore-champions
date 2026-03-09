'use client'

import { useState } from 'react'
import type { AppError } from '@/lib/types'

interface ErrorTableProps {
  errors: AppError[]
  total: number
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

const typeColors: Record<string, string> = {
  rpc: 'bg-blue-900 text-blue-300',
  api: 'bg-purple-900 text-purple-300',
  client: 'bg-orange-900 text-orange-300',
  boundary: 'bg-red-900 text-red-300',
  middleware: 'bg-yellow-900 text-yellow-300',
}

export function ErrorTable({ errors, total, page, totalPages, onPageChange }: ErrorTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (errors.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No errors in this time range.
      </div>
    )
  }

  return (
    <div>
      <div className="text-xs text-gray-400 mb-2">{total} total errors</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-xs border-b border-gray-800">
              <th className="pb-2 pr-3">Type</th>
              <th className="pb-2 pr-3">Route</th>
              <th className="pb-2 pr-3">Message</th>
              <th className="pb-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {errors.map((err) => (
              <>
                <tr
                  key={err.id}
                  className="border-b border-gray-800/50 cursor-pointer hover:bg-gray-800/30"
                  onClick={() => setExpanded(expanded === err.id ? null : err.id)}
                >
                  <td className="py-2 pr-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${typeColors[err.error_type] ?? 'bg-gray-800 text-gray-300'}`}>
                      {err.error_type}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-gray-300 font-mono text-xs max-w-[120px] truncate">{err.route}</td>
                  <td className="py-2 pr-3 text-gray-200 max-w-[200px] truncate">{err.error_message}</td>
                  <td className="py-2 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(err.created_at).toLocaleTimeString()}
                  </td>
                </tr>
                {expanded === err.id && (
                  <tr key={`${err.id}-detail`} className="bg-gray-900/50">
                    <td colSpan={4} className="px-3 py-3 text-xs text-gray-300">
                      <div className="space-y-1">
                        {err.error_code && <div><span className="text-gray-500">Code:</span> {err.error_code}</div>}
                        {err.method && <div><span className="text-gray-500">Method:</span> {err.method}</div>}
                        {err.user_id && <div><span className="text-gray-500">User:</span> {err.user_id}</div>}
                        {Object.keys(err.metadata ?? {}).length > 0 && (
                          <div>
                            <span className="text-gray-500">Metadata:</span>
                            <pre className="mt-1 text-xs bg-gray-800 p-2 rounded overflow-x-auto">
                              {JSON.stringify(err.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-2 mt-4 text-sm">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-2 py-1 bg-gray-800 rounded disabled:opacity-40 hover:bg-gray-700"
          >
            ←
          </button>
          <span className="text-gray-400">Page {page} of {totalPages}</span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-2 py-1 bg-gray-800 rounded disabled:opacity-40 hover:bg-gray-700"
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}
