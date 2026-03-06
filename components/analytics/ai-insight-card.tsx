'use client'

import { useState, useEffect } from 'react'
import { generateStaticSummary } from '@/lib/analytics-utils'
import { getCurrentWeekStart } from '@/lib/analytics-utils'
import type { KidAnalytics, FamilyAnalytics } from '@/lib/types'

interface AIInsightCardProps {
  userId: string
  role: 'parent' | 'child'
  stats: KidAnalytics | FamilyAnalytics | null
}

const INSIGHT_TTL_MS = 60 * 60 * 1000 // 1 hour

function getCachedInsight(userId: string, weekStart: string): string | null {
  try {
    const key = `chore-champions:insight:${userId}:${weekStart}`
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { narrative: string; expires_at: number }
    if (parsed.expires_at <= Date.now()) {
      sessionStorage.removeItem(key)
      return null
    }
    return parsed.narrative
  } catch {
    return null
  }
}

function setCachedInsight(userId: string, weekStart: string, narrative: string): void {
  try {
    const key = `chore-champions:insight:${userId}:${weekStart}`
    sessionStorage.setItem(
      key,
      JSON.stringify({ narrative, expires_at: Date.now() + INSIGHT_TTL_MS })
    )
  } catch {
    // sessionStorage not available
  }
}

export function AIInsightCard({ userId, role, stats }: AIInsightCardProps) {
  const [narrative, setNarrative] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const weekStart = getCurrentWeekStart()
    const cached = getCachedInsight(userId, weekStart)

    if (cached) {
      setNarrative(cached)
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchInsight() {
      try {
        const res = await fetch('/api/ai/analytics-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        })
        if (!res.ok) throw new Error('Request failed')
        const data = await res.json() as { narrative: string | null }
        if (!cancelled) {
          const text = data.narrative ?? (stats ? generateStaticSummary(stats, role) : null)
          if (text) {
            setCachedInsight(userId, weekStart, text)
          }
          setNarrative(text)
        }
      } catch {
        if (!cancelled && stats) {
          setNarrative(generateStaticSummary(stats, role))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchInsight()
    return () => { cancelled = true }
    // Fetch once on mount only — not tied to chart time range changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl bg-purple-50 p-4 animate-pulse">
        <div className="h-4 bg-purple-100 rounded w-3/4 mb-2" />
        <div className="h-4 bg-purple-100 rounded w-1/2" />
      </div>
    )
  }

  if (!narrative) return null

  return (
    <div className="rounded-xl bg-purple-50 border border-purple-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-purple-600 font-semibold text-sm">Weekly Insight</span>
        <span className="text-xs text-purple-300">AI</span>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{narrative}</p>
    </div>
  )
}
