jest.mock('@/lib/push/vapid', () => ({
  getVapidPublicKey: () => 'test-vapid-key',
  urlBase64ToUint8Array: () => new Uint8Array([1, 2, 3]),
}))

const mockFetchResponse = { ok: true, status: 200, json: () => Promise.resolve({}) }
const mockFetch = jest.fn(() => Promise.resolve(mockFetchResponse))
global.fetch = mockFetch as unknown as typeof fetch

const mockSubscription = {
  endpoint: 'https://push.example.com/sub-1',
  toJSON: () => ({
    endpoint: 'https://push.example.com/sub-1',
    keys: { p256dh: 'pk', auth: 'ak' },
  }),
  unsubscribe: jest.fn(() => Promise.resolve(true)),
}

const mockGetSubscription = jest.fn(() => Promise.resolve(null))
const mockSubscribe = jest.fn(() => Promise.resolve(mockSubscription))
const mockGetRegistration = jest.fn()

const mockRegistration = {
  pushManager: {
    getSubscription: mockGetSubscription,
    subscribe: mockSubscribe,
  },
}

const mockRequestPermission = jest.fn(() => Promise.resolve('granted' as NotificationPermission))

beforeEach(() => {
  jest.clearAllMocks()
  mockFetch.mockResolvedValue(mockFetchResponse)
  mockGetSubscription.mockResolvedValue(null)
  mockSubscribe.mockResolvedValue(mockSubscription)
  mockGetRegistration.mockResolvedValue(mockRegistration)

  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      register: jest.fn(() => Promise.resolve(mockRegistration)),
      ready: Promise.resolve(mockRegistration),
      getRegistration: mockGetRegistration,
    },
    writable: true,
    configurable: true,
  })

  Object.defineProperty(window, 'PushManager', {
    value: class PushManager {},
    writable: true,
    configurable: true,
  })

  Object.defineProperty(window, 'Notification', {
    value: { requestPermission: mockRequestPermission, permission: 'default' },
    writable: true,
    configurable: true,
  })
})

import {
  subscribeToPush,
  unsubscribeFromPush,
  getSubscriptionState,
} from '@/lib/push/subscribe'

describe('subscribeToPush', () => {
  it('registers SW, requests permission, subscribes, and posts to API', async () => {
    const sub = await subscribeToPush()
    expect(sub).toBe(mockSubscription)
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js')
    expect(mockRequestPermission).toHaveBeenCalled()
    expect(mockSubscribe).toHaveBeenCalledWith({
      userVisuallyIndicatesPermission: true,
      applicationServerKey: expect.any(Uint8Array),
    })
    expect(mockFetch).toHaveBeenCalledWith('/api/push/subscribe', expect.objectContaining({
      method: 'POST',
    }))
  })

  it('returns existing subscription if already subscribed', async () => {
    mockGetSubscription.mockResolvedValue(mockSubscription)
    const sub = await subscribeToPush()
    expect(sub).toBe(mockSubscription)
    expect(mockSubscribe).not.toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledWith('/api/push/subscribe', expect.anything())
  })

  it('handles subscription with missing keys', async () => {
    const noKeysSub = {
      ...mockSubscription,
      toJSON: () => ({ endpoint: 'https://push.example.com/sub-1', keys: undefined }),
    }
    mockSubscribe.mockResolvedValue(noKeysSub)
    await subscribeToPush()
    const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body)
    expect(body.p256dh_key).toBe('')
    expect(body.auth_key).toBe('')
  })

  it('throws when permission is denied', async () => {
    mockRequestPermission.mockResolvedValue('denied')
    await expect(subscribeToPush()).rejects.toThrow('Notification permission denied')
  })

  it('throws when browser does not support push', async () => {
    Reflect.deleteProperty(navigator, 'serviceWorker')
    await expect(subscribeToPush()).rejects.toThrow('not supported')
  })

  it('throws when PushManager is not available', async () => {
    Reflect.deleteProperty(window, 'PushManager')
    await expect(subscribeToPush()).rejects.toThrow('not supported')
  })
})

describe('unsubscribeFromPush', () => {
  it('unsubscribes from browser and posts to unsubscribe API', async () => {
    mockGetRegistration.mockResolvedValue(mockRegistration)
    mockGetSubscription.mockResolvedValue(mockSubscription)

    await unsubscribeFromPush()

    expect(mockSubscription.unsubscribe).toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledWith('/api/push/unsubscribe', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('https://push.example.com/sub-1'),
    }))
  })

  it('does nothing when serviceWorker is not available', async () => {
    Reflect.deleteProperty(navigator, 'serviceWorker')
    await unsubscribeFromPush()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does nothing when no registration found', async () => {
    mockGetRegistration.mockResolvedValue(undefined)
    await unsubscribeFromPush()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does nothing when no subscription exists', async () => {
    mockGetRegistration.mockResolvedValue(mockRegistration)
    mockGetSubscription.mockResolvedValue(null)
    await unsubscribeFromPush()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('getSubscriptionState', () => {
  it('returns "subscribed" when a subscription exists', async () => {
    mockGetRegistration.mockResolvedValue(mockRegistration)
    mockGetSubscription.mockResolvedValue(mockSubscription)
    expect(await getSubscriptionState()).toBe('subscribed')
  })

  it('returns "unsubscribed" when no subscription exists', async () => {
    mockGetRegistration.mockResolvedValue(mockRegistration)
    mockGetSubscription.mockResolvedValue(null)
    expect(await getSubscriptionState()).toBe('unsubscribed')
  })

  it('returns "unsubscribed" when no registration found', async () => {
    mockGetRegistration.mockResolvedValue(undefined)
    expect(await getSubscriptionState()).toBe('unsubscribed')
  })

  it('returns "unsupported" when serviceWorker is not available', async () => {
    Reflect.deleteProperty(navigator, 'serviceWorker')
    expect(await getSubscriptionState()).toBe('unsupported')
  })

  it('returns "unsupported" when PushManager is not available', async () => {
    Reflect.deleteProperty(window, 'PushManager')
    expect(await getSubscriptionState()).toBe('unsupported')
  })
})
