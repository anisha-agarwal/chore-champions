'use client'

import { useSyncExternalStore } from 'react'
import { isInAppBrowser } from '@/lib/utils'

function subscribe() {
  // User agent never changes — no-op subscription
  return () => {}
}

function getSnapshot() {
  return isInAppBrowser(navigator.userAgent)
}

function getServerSnapshot() {
  return false
}

export function InAppBrowserBanner() {
  const show = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  if (!show) return null

  return (
    <div role="alert" className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm">
      <p className="font-semibold">Open in your browser</p>
      <p className="mt-1">
        Google and Facebook sign-in won&apos;t work in this browser. Tap the menu (
        <span className="font-mono">...</span>) and select &quot;Open in Safari&quot; or &quot;Open in Chrome&quot;.
      </p>
    </div>
  )
}
