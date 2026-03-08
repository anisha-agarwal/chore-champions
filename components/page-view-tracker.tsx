'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { logClientEvent } from '@/lib/observability/client-logger'

/**
 * Tracks page views for DAU counting.
 * Fires once per navigation, deduplicating via lastPathRef.
 * Does not duplicate Vercel Analytics page view tracking.
 */
export function PageViewTracker() {
  const pathname = usePathname()
  const lastPathRef = useRef<string | null>(null)

  useEffect(() => {
    if (pathname && pathname !== lastPathRef.current) {
      lastPathRef.current = pathname
      logClientEvent({
        event_type: 'page_view',
        metadata: { path: pathname },
      })
    }
  }, [pathname])

  return null
}
