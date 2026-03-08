import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import ObservabilityDashboard from '@/app/admin/observability/page'

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockSearchParams = new URLSearchParams()

jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}))

// Mock panel components
jest.mock('@/components/admin/health-panel', () => ({
  HealthPanel: ({ error, onRetry }: { error: string | null; onRetry: () => void }) => (
    <div data-testid="health-panel">
      {error ? <button onClick={onRetry}>retry-health</button> : 'health-ok'}
    </div>
  ),
}))
jest.mock('@/components/admin/error-panel', () => ({
  ErrorPanel: ({ error, onRetry, onPageChange }: { error: string | null; onRetry: () => void; onPageChange: (p: number) => void }) => (
    <div data-testid="error-panel">
      {error ? <button onClick={onRetry}>retry-errors</button> : 'errors-ok'}
      <button onClick={() => onPageChange(2)}>page-2</button>
    </div>
  ),
}))
jest.mock('@/components/admin/performance-panel', () => ({
  PerformancePanel: ({ error, onRetry }: { error: string | null; onRetry: () => void }) => (
    <div data-testid="performance-panel">
      {error ? <button onClick={onRetry}>retry-perf</button> : 'perf-ok'}
    </div>
  ),
}))
jest.mock('@/components/admin/usage-panel', () => ({
  UsagePanel: ({ error, onRetry }: { error: string | null; onRetry: () => void }) => (
    <div data-testid="usage-panel">
      {error ? <button onClick={onRetry}>retry-usage</button> : 'usage-ok'}
    </div>
  ),
}))

// Mock service client for cleanup
jest.mock('@/lib/observability/service-client', () => ({
  createServiceClient: () => ({
    rpc: jest.fn().mockResolvedValue({
      data: { errors_deleted: 5, events_deleted: 10 },
      error: null,
    }),
  }),
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

function setupSuccessfulFetch() {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/summary')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ error_count: 0 }) })
    if (url.includes('/health')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ supabase: 'ok' }) })
    if (url.includes('/errors')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ errors: [], total: 0, page: 1, total_pages: 1 }) })
    if (url.includes('/performance')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ route_latency: [], rpc_timing: [], latency_trend: [] }) })
    if (url.includes('/usage')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ daily_active_users: [], top_chores: [], least_chores: [], peak_hours: [], ai_call_volume: [], event_counts: {} }) })
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })
  })
}

describe('ObservabilityDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    setupSuccessfulFetch()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders all 4 panels', async () => {
    await act(async () => {
      render(<ObservabilityDashboard />)
    })

    expect(screen.getByTestId('health-panel')).toBeInTheDocument()
    expect(screen.getByTestId('error-panel')).toBeInTheDocument()
    expect(screen.getByTestId('performance-panel')).toBeInTheDocument()
    expect(screen.getByTestId('usage-panel')).toBeInTheDocument()
  })

  it('renders time range buttons', async () => {
    await act(async () => {
      render(<ObservabilityDashboard />)
    })

    expect(screen.getByText('24h')).toBeInTheDocument()
    expect(screen.getByText('7d')).toBeInTheDocument()
    expect(screen.getByText('30d')).toBeInTheDocument()
  })

  it('changes time range on button click', async () => {
    await act(async () => {
      render(<ObservabilityDashboard />)
    })

    await act(async () => {
      fireEvent.click(screen.getByText('7d'))
    })

    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('range=7d'))
  })

  it('handles logout', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/logout')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })
    })

    await act(async () => {
      render(<ObservabilityDashboard />)
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Logout'))
    })

    expect(mockPush).toHaveBeenCalledWith('/admin/observability/login')
  })

  it('redirects to login on 401 response', async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ error: 'Unauthorized' }) })
    )

    await act(async () => {
      render(<ObservabilityDashboard />)
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/observability/login')
    })
  })

  it('manually refreshes on Refresh button click', async () => {
    await act(async () => {
      render(<ObservabilityDashboard />)
    })

    const initialCallCount = mockFetch.mock.calls.length

    await act(async () => {
      fireEvent.click(screen.getByText('Refresh'))
    })

    expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCallCount)
  })

  it('auto-refreshes after 30 seconds', async () => {
    await act(async () => {
      render(<ObservabilityDashboard />)
    })

    const callsAfterMount = mockFetch.mock.calls.length

    await act(async () => {
      jest.advanceTimersByTime(30_000)
    })

    expect(mockFetch.mock.calls.length).toBeGreaterThan(callsAfterMount)
  })

  it('changes error page via panel callback', async () => {
    await act(async () => {
      render(<ObservabilityDashboard />)
    })

    await act(async () => {
      fireEvent.click(screen.getByText('page-2'))
    })

    // Flush any remaining async operations (fetch chains from re-triggered effects)
    await act(async () => {})

    const allUrls = mockFetch.mock.calls.map((c: unknown[]) => c[0])
    expect(allUrls.some((u: string) => u.includes('page=2'))).toBe(true)
  })
})
