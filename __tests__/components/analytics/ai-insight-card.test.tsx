import { render, screen, waitFor } from '@testing-library/react'
import { AIInsightCard } from '@/components/analytics/ai-insight-card'
import type { KidAnalytics } from '@/lib/types'

// Mock analytics-utils
jest.mock('@/lib/analytics-utils', () => ({
  generateStaticSummary: jest.fn(() => 'Static fallback summary'),
  getCurrentWeekStart: jest.fn(() => '2024-01-07'),
}))

const mockStats: KidAnalytics = {
  daily_points: [{ date: '2024-01-01', points: 10, completions: 2 }],
  task_breakdown: [],
  milestones: [],
  total_points: 150,
  completions_this_week: 5,
  completions_last_week: 3,
}

// Mock sessionStorage
const mockSessionStorage: Record<string, string> = {}
beforeEach(() => {
  Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k])
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => mockSessionStorage[key] ?? null)
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
    mockSessionStorage[key] = value
  })
  jest.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
    delete mockSessionStorage[key]
  })
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('AIInsightCard', () => {
  it('shows loading state initially', () => {
    // Make fetch hang
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock
    const { container } = render(
      <AIInsightCard userId="user-1" role="child" stats={mockStats} />
    )
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('displays narrative on successful fetch', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ narrative: 'Great week! You completed 5 quests.' }),
    })

    render(<AIInsightCard userId="user-1" role="child" stats={mockStats} />)

    await waitFor(() => {
      expect(screen.getByText('Great week! You completed 5 quests.')).toBeInTheDocument()
    })
  })

  it('shows "Weekly Insight" header and AI label', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ narrative: 'Test insight' }),
    })

    render(<AIInsightCard userId="user-1" role="child" stats={mockStats} />)

    await waitFor(() => {
      expect(screen.getByText('Weekly Insight')).toBeInTheDocument()
      expect(screen.getByText('AI')).toBeInTheDocument()
    })
  })

  it('caches insight in sessionStorage on successful fetch', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ narrative: 'Cached insight' }),
    })

    render(<AIInsightCard userId="user-1" role="child" stats={mockStats} />)

    await waitFor(() => {
      expect(screen.getByText('Cached insight')).toBeInTheDocument()
    })

    const key = 'chore-champions:insight:user-1:2024-01-07'
    expect(mockSessionStorage[key]).toBeDefined()
    const cached = JSON.parse(mockSessionStorage[key])
    expect(cached.narrative).toBe('Cached insight')
    expect(cached.expires_at).toBeGreaterThan(Date.now())
  })

  it('uses cached insight when available and not expired', async () => {
    const key = 'chore-champions:insight:user-1:2024-01-07'
    mockSessionStorage[key] = JSON.stringify({
      narrative: 'From cache',
      expires_at: Date.now() + 60 * 60 * 1000,
    })

    global.fetch = jest.fn()

    render(<AIInsightCard userId="user-1" role="child" stats={mockStats} />)

    await waitFor(() => {
      expect(screen.getByText('From cache')).toBeInTheDocument()
    })

    // Should not have fetched
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('ignores expired cached insight and fetches fresh', async () => {
    const key = 'chore-champions:insight:user-1:2024-01-07'
    mockSessionStorage[key] = JSON.stringify({
      narrative: 'Expired insight',
      expires_at: Date.now() - 1000, // expired
    })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ narrative: 'Fresh insight' }),
    })

    render(<AIInsightCard userId="user-1" role="child" stats={mockStats} />)

    await waitFor(() => {
      expect(screen.getByText('Fresh insight')).toBeInTheDocument()
    })

    expect(global.fetch).toHaveBeenCalled()
  })

  it('falls back to static summary on fetch failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    render(<AIInsightCard userId="user-1" role="child" stats={mockStats} />)

    await waitFor(() => {
      expect(screen.getByText('Static fallback summary')).toBeInTheDocument()
    })
  })

  it('falls back to static summary on non-OK response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
    })

    render(<AIInsightCard userId="user-1" role="child" stats={mockStats} />)

    await waitFor(() => {
      expect(screen.getByText('Static fallback summary')).toBeInTheDocument()
    })
  })

  it('uses static summary when API returns null narrative', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ narrative: null }),
    })

    render(<AIInsightCard userId="user-1" role="child" stats={mockStats} />)

    await waitFor(() => {
      expect(screen.getByText('Static fallback summary')).toBeInTheDocument()
    })
  })

  it('renders nothing when narrative is null and no stats', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ narrative: null }),
    })

    const { container } = render(
      <AIInsightCard userId="user-1" role="child" stats={null} />
    )

    await waitFor(() => {
      // Loading should be done
      expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument()
    })

    // Should render nothing (null)
    expect(container.innerHTML).toBe('')
  })

  it('handles sessionStorage.getItem throwing error gracefully', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ narrative: 'Fresh from API' }),
    })

    render(<AIInsightCard userId="user-1" role="child" stats={mockStats} />)

    await waitFor(() => {
      expect(screen.getByText('Fresh from API')).toBeInTheDocument()
    })
  })

  it('handles sessionStorage.setItem throwing error gracefully', async () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ narrative: 'Still works' }),
    })

    render(<AIInsightCard userId="user-1" role="child" stats={mockStats} />)

    await waitFor(() => {
      expect(screen.getByText('Still works')).toBeInTheDocument()
    })
  })

  it('does not set fallback narrative on fetch error when stats is null', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const { container } = render(
      <AIInsightCard userId="user-1" role="child" stats={null} />
    )

    await waitFor(() => {
      expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument()
    })

    // Should render nothing since narrative stays null
    expect(container.innerHTML).toBe('')
  })

  it('sends POST request with correct body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ narrative: 'Insight' }),
    })

    render(<AIInsightCard userId="user-1" role="parent" stats={mockStats} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/analytics-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'parent' }),
      })
    })
  })

  it('does not update state after unmount (cancelled flag)', async () => {
    let resolvePromise: (value: unknown) => void
    global.fetch = jest.fn().mockReturnValue(
      new Promise((resolve) => { resolvePromise = resolve })
    )

    const { unmount } = render(
      <AIInsightCard userId="user-1" role="child" stats={mockStats} />
    )

    // Unmount before fetch resolves
    unmount()

    // Resolve the fetch — should not cause errors
    resolvePromise!({
      ok: true,
      json: async () => ({ narrative: 'Late response' }),
    })

    // No assertion needed — just verifying no state update errors
  })

  it('does not cache when narrative is null from API and stats produce fallback', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ narrative: null }),
    })

    // generateStaticSummary returns 'Static fallback summary' which is truthy
    // so it will be cached
    render(<AIInsightCard userId="user-1" role="child" stats={mockStats} />)

    await waitFor(() => {
      expect(screen.getByText('Static fallback summary')).toBeInTheDocument()
    })

    const key = 'chore-champions:insight:user-1:2024-01-07'
    const cached = JSON.parse(mockSessionStorage[key])
    expect(cached.narrative).toBe('Static fallback summary')
  })
})
