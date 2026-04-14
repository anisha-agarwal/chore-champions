'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { PermissionPrompt } from './permission-prompt'
import { subscribeToPush, unsubscribeFromPush, getSubscriptionState } from '@/lib/push/subscribe'
import type { NotificationPreferences, NotificationType, TypesEnabled } from '@/lib/push/types'
import { NOTIFICATION_TYPES } from '@/lib/push/types'

interface NotificationSettingsTabProps {
  userRole: 'parent' | 'child'
}

const TYPE_LABELS: Record<NotificationType, string> = {
  task_completed: 'Kid completes a task',
  streak_milestone: 'Streak milestone reached',
  test: 'Test notifications',
}

const TYPE_DESCRIPTIONS: Record<NotificationType, string> = {
  task_completed: 'Get notified when your child finishes a quest',
  streak_milestone: 'Celebrate streak achievements',
  test: 'Used for testing — safe to disable',
}

const PARENT_ONLY_TYPES: NotificationType[] = ['task_completed']

export function NotificationSettingsTab({ userRole }: NotificationSettingsTabProps) {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [testSending, setTestSending] = useState(false)
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>('default')
  const [subscriptionState, setSubscriptionState] = useState<'subscribed' | 'unsubscribed' | 'unsupported'>('unsubscribed')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchPrefs = useCallback(async () => {
    const res = await fetch('/api/push/preferences')
    if (res.ok) {
      const data = await res.json()
      setPrefs(data.data)
    }
    setLoading(false)
  }, [])

  const checkPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      setPermissionState('unsupported')
      setSubscriptionState('unsupported')
      return
    }
    setPermissionState(Notification.permission)
    const state = await getSubscriptionState()
    setSubscriptionState(state)
  }, [])

  useEffect(() => {
    fetchPrefs()
    checkPermission()
  }, [fetchPrefs, checkPermission])

  const patchPrefs = useCallback((patch: Record<string, unknown>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const res = await fetch('/api/push/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) toast.error('Failed to save notification preferences')
    }, 500)
  }, [])

  const handleSubscribe = async () => {
    setSubscribing(true)
    try {
      await subscribeToPush()
      setPermissionState('granted')
      setSubscriptionState('subscribed')
      toast.success('Push notifications enabled!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to enable notifications'
      toast.error(msg)
      setPermissionState(Notification.permission)
    } finally {
      setSubscribing(false)
    }
  }

  const handleUnsubscribe = async () => {
    setSubscribing(true)
    try {
      await unsubscribeFromPush()
      setSubscriptionState('unsubscribed')
      toast.success('Push notifications disabled on this device')
    } catch {
      toast.error('Failed to unsubscribe')
    } finally {
      setSubscribing(false)
    }
  }

  const handleMasterToggle = () => {
    const next = !prefs!.push_enabled
    setPrefs({ ...prefs!, push_enabled: next })
    patchPrefs({ push_enabled: next })
  }

  const handleTypeToggle = (type: NotificationType) => {
    const next: TypesEnabled = { ...prefs!.types_enabled, [type]: !prefs!.types_enabled[type] }
    setPrefs({ ...prefs!, types_enabled: next })
    patchPrefs({ types_enabled: { [type]: next[type] } })
  }

  const handleSendTest = async () => {
    setTestSending(true)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        toast.success(`Test notification sent to ${data.sent} device(s)`)
      } else {
        toast.error('Failed to send test notification')
      }
    } catch {
      toast.error('Failed to send test notification')
    } finally {
      setTestSending(false)
    }
  }

  const handleQuietHoursChange = (field: 'quiet_hours_start' | 'quiet_hours_end', value: string) => {
    const parsed = value === '' ? null : parseInt(value, 10)
    setPrefs({ ...prefs!, [field]: parsed })
    patchPrefs({ [field]: parsed })
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse" data-testid="notification-settings-skeleton">
        <div className="h-12 bg-gray-100 rounded-lg" />
        <div className="h-20 bg-gray-100 rounded-lg" />
        <div className="h-32 bg-gray-100 rounded-lg" />
      </div>
    )
  }

  if (!prefs) {
    return (
      <div className="text-center py-8 text-gray-500" data-testid="notification-settings-error">
        <p>Failed to load preferences.</p>
        <button onClick={fetchPrefs} className="text-purple-600 hover:underline mt-2 text-sm">
          Try again
        </button>
      </div>
    )
  }

  const visibleTypes = NOTIFICATION_TYPES.filter(
    (t) => !PARENT_ONLY_TYPES.includes(t) || userRole === 'parent',
  )

  return (
    <div className="space-y-6" data-testid="notification-settings">
      {/* Permission / Subscribe Section */}
      <section>
        <PermissionPrompt
          state={permissionState}
          onRequestPermission={handleSubscribe}
          loading={subscribing}
        />
        {subscriptionState === 'subscribed' && (
          <button
            onClick={handleUnsubscribe}
            disabled={subscribing}
            className="mt-2 text-sm text-gray-500 hover:text-red-600 transition"
          >
            Unsubscribe from this device
          </button>
        )}
      </section>

      {/* Master toggle */}
      <section className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">Push notifications</p>
          <p className="text-xs text-gray-500">Get reminders and celebrations</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.push_enabled}
            onChange={handleMasterToggle}
            className="sr-only peer"
            aria-label="Enable push notifications"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:bg-purple-600 transition after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition peer-checked:after:translate-x-full" />
        </label>
      </section>

      {/* Per-type toggles */}
      <section>
        <p className="text-sm font-medium text-gray-700 mb-3">What to notify me about</p>
        <div className="space-y-3">
          {visibleTypes.map((type) => (
            <label key={type} className={`flex items-center justify-between ${!prefs.push_enabled ? 'opacity-50' : ''}`}>
              <div>
                <p className="text-sm text-gray-900">{TYPE_LABELS[type]}</p>
                <p className="text-xs text-gray-500">{TYPE_DESCRIPTIONS[type]}</p>
              </div>
              <input
                type="checkbox"
                checked={prefs.types_enabled[type]}
                onChange={() => handleTypeToggle(type)}
                disabled={!prefs.push_enabled}
                className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500"
                aria-label={TYPE_LABELS[type]}
              />
            </label>
          ))}
        </div>
      </section>

      {/* Quiet hours */}
      <section>
        <p className="text-sm font-medium text-gray-700 mb-3">Quiet hours</p>
        <div className={`flex items-center gap-2 text-sm ${!prefs.push_enabled ? 'opacity-50' : ''}`}>
          <span className="text-gray-600">Don&apos;t send between</span>
          <select
            value={prefs.quiet_hours_start ?? ''}
            onChange={(e) => handleQuietHoursChange('quiet_hours_start', e.target.value)}
            disabled={!prefs.push_enabled}
            className="border rounded px-2 py-1 text-sm"
            aria-label="Quiet hours start"
          >
            <option value="">Off</option>
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
            ))}
          </select>
          <span className="text-gray-600">and</span>
          <select
            value={prefs.quiet_hours_end ?? ''}
            onChange={(e) => handleQuietHoursChange('quiet_hours_end', e.target.value)}
            disabled={!prefs.push_enabled}
            className="border rounded px-2 py-1 text-sm"
            aria-label="Quiet hours end"
          >
            <option value="">Off</option>
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
            ))}
          </select>
        </div>
      </section>

      {/* Send test notification */}
      <section>
        <button
          onClick={handleSendTest}
          disabled={!prefs.push_enabled || subscriptionState !== 'subscribed' || testSending}
          className="w-full text-sm text-purple-600 border border-purple-200 rounded-lg px-4 py-2.5 hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {testSending ? 'Sending...' : 'Send test notification'}
        </button>
      </section>
    </div>
  )
}
