import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationSettingsTab } from '@/components/notifications/notification-settings-tab'

const mockSubscribe = jest.fn()
const mockUnsubscribe = jest.fn()
const mockGetState = jest.fn()

jest.mock('@/lib/push/subscribe', () => ({
  subscribeToPush: (...args: unknown[]) => mockSubscribe(...args),
  unsubscribeFromPush: (...args: unknown[]) => mockUnsubscribe(...args),
  getSubscriptionState: (...args: unknown[]) => mockGetState(...args),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

const defaultPrefs = {
  user_id: 'u1',
  push_enabled: true,
  types_enabled: { task_completed: true, streak_milestone: true, test: true },
  quiet_hours_start: null,
  quiet_hours_end: null,
  timezone: 'UTC',
  updated_at: '2026-04-13T00:00:00Z',
}

function setupFetch(prefs = defaultPrefs) {
  global.fetch = jest.fn((url: string | URL | Request) => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url
    if (urlStr.includes('/api/push/preferences')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: prefs }),
      })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  }) as unknown as typeof fetch
}

function setupNotification(permission: NotificationPermission = 'default') {
  Object.defineProperty(window, 'Notification', {
    value: { permission, requestPermission: jest.fn() },
    writable: true,
    configurable: true,
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetState.mockResolvedValue('unsubscribed')
  setupFetch()
  setupNotification()
})

describe('NotificationSettingsTab', () => {
  it('shows skeleton while loading', () => {
    // Simulate slow fetch
    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch
    render(<NotificationSettingsTab userRole="parent" />)
    expect(screen.getByTestId('notification-settings-skeleton')).toBeInTheDocument()
  })

  it('shows error state when fetch fails', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false })) as unknown as typeof fetch
    render(<NotificationSettingsTab userRole="parent" />)
    await waitFor(() => {
      expect(screen.getByTestId('notification-settings-error')).toBeInTheDocument()
    })
  })

  it('shows retry button on error state', async () => {
    let callCount = 0
    global.fetch = jest.fn(() => {
      callCount++
      if (callCount === 1) return Promise.resolve({ ok: false })
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: defaultPrefs }) })
    }) as unknown as typeof fetch

    render(<NotificationSettingsTab userRole="parent" />)
    await waitFor(() => expect(screen.getByText('Try again')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Try again'))
    await waitFor(() => expect(screen.getByTestId('notification-settings')).toBeInTheDocument())
  })

  it('renders settings when loaded', async () => {
    render(<NotificationSettingsTab userRole="parent" />)
    await waitFor(() => {
      expect(screen.getByTestId('notification-settings')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Enable push notifications')).toBeInTheDocument()
    expect(screen.getByText('What to notify me about')).toBeInTheDocument()
  })

  it('parent sees task_completed toggle', async () => {
    render(<NotificationSettingsTab userRole="parent" />)
    await waitFor(() => {
      expect(screen.getByLabelText('Kid completes a task')).toBeInTheDocument()
    })
  })

  it('child does not see task_completed toggle', async () => {
    render(<NotificationSettingsTab userRole="child" />)
    await waitFor(() => {
      expect(screen.getByTestId('notification-settings')).toBeInTheDocument()
    })
    expect(screen.queryByLabelText('Kid completes a task')).not.toBeInTheDocument()
  })

  it('child sees streak_milestone toggle', async () => {
    render(<NotificationSettingsTab userRole="child" />)
    await waitFor(() => {
      expect(screen.getByLabelText('Streak milestone reached')).toBeInTheDocument()
    })
  })

  it('toggles master switch and patches preferences', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<NotificationSettingsTab userRole="parent" />)
    await waitFor(() => expect(screen.getByTestId('notification-settings')).toBeInTheDocument())

    await user.click(screen.getByLabelText('Enable push notifications'))
    jest.advanceTimersByTime(600)

    await waitFor(() => {
      const patchCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (c: unknown[]) => {
          const url = typeof c[0] === 'string' ? c[0] : ''
          const opts = c[1] as { method?: string } | undefined
          return url.includes('/api/push/preferences') && opts?.method === 'PATCH'
        },
      )
      expect(patchCalls.length).toBeGreaterThanOrEqual(1)
    })
    jest.useRealTimers()
  })

  it('toggles a type checkbox and patches preferences', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<NotificationSettingsTab userRole="parent" />)
    await waitFor(() => expect(screen.getByTestId('notification-settings')).toBeInTheDocument())

    await user.click(screen.getByLabelText('Streak milestone reached'))
    jest.advanceTimersByTime(600)

    await waitFor(() => {
      const patchCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (c: unknown[]) => {
          const url = typeof c[0] === 'string' ? c[0] : ''
          const opts = c[1] as { method?: string } | undefined
          return url.includes('/api/push/preferences') && opts?.method === 'PATCH'
        },
      )
      expect(patchCalls.length).toBeGreaterThanOrEqual(1)
    })
    jest.useRealTimers()
  })

  it('debounces rapid changes (clears previous timer)', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<NotificationSettingsTab userRole="parent" />)
    await waitFor(() => expect(screen.getByTestId('notification-settings')).toBeInTheDocument())

    // Two rapid toggles — the first should be debounced away
    await user.click(screen.getByLabelText('Enable push notifications'))
    await user.click(screen.getByLabelText('Enable push notifications'))
    jest.advanceTimersByTime(600)

    await waitFor(() => {
      const patchCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (c: unknown[]) => {
          const url = typeof c[0] === 'string' ? c[0] : ''
          const opts = c[1] as { method?: string } | undefined
          return url.includes('/api/push/preferences') && opts?.method === 'PATCH'
        },
      )
      // Only one PATCH fires (the second cleared the first's timer)
      expect(patchCalls.length).toBe(1)
    })
    jest.useRealTimers()
  })

  it('type toggles are disabled when master is off', async () => {
    setupFetch({ ...defaultPrefs, push_enabled: false })
    render(<NotificationSettingsTab userRole="parent" />)
    await waitFor(() => expect(screen.getByTestId('notification-settings')).toBeInTheDocument())

    expect(screen.getByLabelText('Streak milestone reached')).toBeDisabled()
  })

  it('renders quiet hours selects', async () => {
    render(<NotificationSettingsTab userRole="parent" />)
    await waitFor(() => expect(screen.getByTestId('notification-settings')).toBeInTheDocument())

    expect(screen.getByLabelText('Quiet hours start')).toBeInTheDocument()
    expect(screen.getByLabelText('Quiet hours end')).toBeInTheDocument()
  })

  it('changes quiet hours and patches', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<NotificationSettingsTab userRole="parent" />)
    await waitFor(() => expect(screen.getByTestId('notification-settings')).toBeInTheDocument())

    await user.selectOptions(screen.getByLabelText('Quiet hours start'), '22')
    jest.advanceTimersByTime(600)

    await waitFor(() => {
      const patchCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (c: unknown[]) => {
          const url = typeof c[0] === 'string' ? c[0] : ''
          const opts = c[1] as { method?: string } | undefined
          return url.includes('/api/push/preferences') && opts?.method === 'PATCH'
        },
      )
      expect(patchCalls.length).toBeGreaterThanOrEqual(1)
    })
    jest.useRealTimers()
  })

  it('changes quiet hours end and patches', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<NotificationSettingsTab userRole="parent" />)
    await waitFor(() => expect(screen.getByTestId('notification-settings')).toBeInTheDocument())

    await user.selectOptions(screen.getByLabelText('Quiet hours end'), '7')
    jest.advanceTimersByTime(600)

    await waitFor(() => {
      const patchCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (c: unknown[]) => {
          const url = typeof c[0] === 'string' ? c[0] : ''
          const opts = c[1] as { method?: string } | undefined
          return url.includes('/api/push/preferences') && opts?.method === 'PATCH'
        },
      )
      expect(patchCalls.length).toBeGreaterThanOrEqual(1)
    })
    jest.useRealTimers()
  })

  it('clears quiet hours when set to empty', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    setupFetch({ ...defaultPrefs, quiet_hours_start: 22, quiet_hours_end: 7 })
    render(<NotificationSettingsTab userRole="parent" />)
    await waitFor(() => expect(screen.getByTestId('notification-settings')).toBeInTheDocument())

    await user.selectOptions(screen.getByLabelText('Quiet hours start'), '')
    jest.advanceTimersByTime(600)

    await waitFor(() => {
      const patchCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (c: unknown[]) => {
          const url = typeof c[0] === 'string' ? c[0] : ''
          const opts = c[1] as { method?: string } | undefined
          return url.includes('/api/push/preferences') && opts?.method === 'PATCH'
        },
      )
      expect(patchCalls.length).toBeGreaterThanOrEqual(1)
    })
    jest.useRealTimers()
  })

  describe('subscribe flow', () => {
    it('calls subscribeToPush on enable button click', async () => {
      mockSubscribe.mockResolvedValue({})
      render(<NotificationSettingsTab userRole="parent" />)
      await waitFor(() => expect(screen.getByTestId('notification-settings')).toBeInTheDocument())

      const enableBtn = screen.getByRole('button', { name: /enable push notifications/i })
      await userEvent.click(enableBtn)

      expect(mockSubscribe).toHaveBeenCalled()
    })

    it('shows error toast when subscribe fails', async () => {
      const { toast } = jest.requireMock('sonner')
      mockSubscribe.mockRejectedValue(new Error('Test fail'))
      render(<NotificationSettingsTab userRole="parent" />)
      await waitFor(() => expect(screen.getByTestId('notification-settings')).toBeInTheDocument())

      await userEvent.click(screen.getByRole('button', { name: /enable push notifications/i }))
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Test fail'))
    })

    it('shows error toast with generic message for non-Error throws', async () => {
      const { toast } = jest.requireMock('sonner')
      mockSubscribe.mockRejectedValue('string error')
      render(<NotificationSettingsTab userRole="parent" />)
      await waitFor(() => expect(screen.getByTestId('notification-settings')).toBeInTheDocument())

      await userEvent.click(screen.getByRole('button', { name: /enable push notifications/i }))
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to enable notifications'))
    })
  })

  describe('unsubscribe flow', () => {
    it('shows unsubscribe link when subscribed', async () => {
      mockGetState.mockResolvedValue('subscribed')
      setupNotification('granted')
      render(<NotificationSettingsTab userRole="parent" />)
      await waitFor(() => {
        expect(screen.getByText(/unsubscribe from this device/i)).toBeInTheDocument()
      })
    })

    it('calls unsubscribeFromPush on click', async () => {
      mockGetState.mockResolvedValue('subscribed')
      mockUnsubscribe.mockResolvedValue(undefined)
      setupNotification('granted')
      render(<NotificationSettingsTab userRole="parent" />)
      await waitFor(() => expect(screen.getByText(/unsubscribe/i)).toBeInTheDocument())

      await userEvent.click(screen.getByText(/unsubscribe from this device/i))
      expect(mockUnsubscribe).toHaveBeenCalled()
    })

    it('shows error toast when unsubscribe fails', async () => {
      const { toast } = jest.requireMock('sonner')
      mockGetState.mockResolvedValue('subscribed')
      mockUnsubscribe.mockRejectedValue(new Error('fail'))
      setupNotification('granted')
      render(<NotificationSettingsTab userRole="parent" />)
      await waitFor(() => expect(screen.getByText(/unsubscribe/i)).toBeInTheDocument())

      await userEvent.click(screen.getByText(/unsubscribe from this device/i))
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to unsubscribe'))
    })
  })

  describe('unsupported browser', () => {
    it('renders unsupported prompt when Notification API is missing', async () => {
      Reflect.deleteProperty(window, 'Notification')
      render(<NotificationSettingsTab userRole="parent" />)
      await waitFor(() => expect(screen.getByTestId('notification-settings')).toBeInTheDocument())
      expect(screen.getByText(/not supported/)).toBeInTheDocument()
    })
  })

  describe('PATCH error handling', () => {
    it('shows error toast when PATCH fails', async () => {
      const { toast } = jest.requireMock('sonner')
      jest.useFakeTimers()
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      let callCount = 0
      global.fetch = jest.fn((url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url
        callCount++
        if (urlStr.includes('/api/push/preferences') && callCount === 1) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: defaultPrefs }) })
        }
        return Promise.resolve({ ok: false })
      }) as unknown as typeof fetch

      render(<NotificationSettingsTab userRole="parent" />)
      await waitFor(() => expect(screen.getByTestId('notification-settings')).toBeInTheDocument())

      await user.click(screen.getByLabelText('Enable push notifications'))
      jest.advanceTimersByTime(600)

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to save notification preferences'))
      jest.useRealTimers()
    })
  })
})
