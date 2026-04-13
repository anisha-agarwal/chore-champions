'use client'

import { getVapidPublicKey, urlBase64ToUint8Array } from './vapid'

export async function subscribeToPush(): Promise<PushSubscription> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported in this browser')
  }

  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission denied')
  }

  const existing = await registration.pushManager.getSubscription()
  if (existing) {
    await postSubscription(existing)
    return existing
  }

  const applicationServerKey = urlBase64ToUint8Array(getVapidPublicKey())
  const subscription = await registration.pushManager.subscribe({
    userVisuallyIndicatesPermission: true,
    applicationServerKey,
  })

  await postSubscription(subscription)
  return subscription
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return

  const registration = await navigator.serviceWorker.getRegistration('/sw.js')
  if (!registration) return

  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  await subscription.unsubscribe()

  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })
}

export async function getSubscriptionState(): Promise<'subscribed' | 'unsubscribed' | 'unsupported'> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported'
  }

  const registration = await navigator.serviceWorker.getRegistration('/sw.js')
  if (!registration) return 'unsubscribed'

  const subscription = await registration.pushManager.getSubscription()
  return subscription ? 'subscribed' : 'unsubscribed'
}

async function postSubscription(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON()
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      p256dh_key: json.keys?.p256dh ?? '',
      auth_key: json.keys?.auth ?? '',
    }),
  })
}
