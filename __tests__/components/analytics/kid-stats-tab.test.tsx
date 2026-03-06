import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { KidStatsTab } from '@/components/analytics/kid-stats-tab'
import type { KidAnalytics, KidHeatmap, UserStreaks } from '@/lib/types'

// Mock sonner
jest.mock('sonner', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}))

// Mock next/dynamic to render children synchronously
jest.mock('next/dynamic', () => {
  return (loader: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
    // Eagerly load and return the component
    let Component: React.ComponentType<Record<string, unknown>> | null = null
    const promise = loader()
    promise.then((mod) => { Component = mod.default })
    return function DynamicComponent(props: Record<string, unknown>) {
      if (!Component) return null
      return <Component {...props} />
    }
  }
})

// Mock child components to simplify tests
jest.mock('@/components/analytics/ai-insight-card', () => ({
  AIInsightCard: () => <div data-testid="ai-insight-card" />,
}))

// Mock Supabase
const mockRpc = jest.fn()
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: mockRpc,
  }),
}))

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>
  }
})

const mockAnalytics: KidAnalytics = {
  daily_points: [
    { date: '2024-01-01', points: 10, completions: 2 },
    { date: '2024-01-02', points: 20, completions: 3 },
  ],
  task_breakdown: [{ task_id: 't1', title: 'Make Bed', count: 5 }],
  milestones: [],
  total_points: 150,
  completions_this_week: 5,
  completions_last_week: 3,
}

const mockHeatmap: KidHeatmap = {
  heatmap_data: [{ date: '2024-01-01', points: 10, completions: 2 }],
}

const mockStreaks: UserStreaks = {
  active_day_streak: 5,
  perfect_day_streak: 3,
  task_streaks: [],
}

function setupMocks(overrides?: {
  analytics?: KidAnalytics | null
  analyticsError?: { code: string } | null
  heatmap?: KidHeatmap | null
  streaks?: UserStreaks | null
  analyticsReject?: boolean
}) {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === 'get_kid_analytics') {
      if (overrides?.analyticsReject) {
        return Promise.reject(new Error('Network error'))
      }
      return Promise.resolve({
        data: overrides?.analytics !== undefined ? overrides.analytics : mockAnalytics,
        error: overrides?.analyticsError ?? null,
      })
    }
    if (fn === 'get_kid_heatmap') {
      return Promise.resolve({
        data: overrides?.heatmap !== undefined ? overrides.heatmap : mockHeatmap,
        error: null,
      })
    }
    if (fn === 'get_user_streaks') {
      return Promise.resolve({
        data: overrides?.streaks !== undefined ? overrides.streaks : mockStreaks,
        error: null,
      })
    }
    return Promise.resolve({ data: null, error: null })
  })
}

describe('KidStatsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows loading skeleton initially', () => {
    mockRpc.mockReturnValue(new Promise(() => {}))
    render(<KidStatsTab userId="user-1" />)
    expect(screen.getByLabelText('Loading analytics')).toBeInTheDocument()
  })

  it('shows auth error state when RPC returns code 42501', async () => {
    setupMocks({ analyticsError: { code: '42501' } })
    render(<KidStatsTab userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Please sign in again to view your stats.')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login')
    })
  })

  it('shows fetch error and toast on RPC rejection', async () => {
    setupMocks({ analyticsReject: true })
    render(<KidStatsTab userId="user-1" />)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Couldn't load analytics")
    })
  })

  it('shows empty state when analytics is null', async () => {
    setupMocks({ analytics: null })
    render(<KidStatsTab userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Your adventure is just beginning')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Go to Quests' })).toHaveAttribute('href', '/quests')
    })
  })

  it('shows empty state when no completions and no daily points', async () => {
    setupMocks({
      analytics: {
        ...mockAnalytics,
        daily_points: [],
        completions_this_week: 0,
        completions_last_week: 0,
      },
    })
    render(<KidStatsTab userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Your adventure is just beginning')).toBeInTheDocument()
    })
  })

  it('renders success state with quest count', async () => {
    setupMocks()
    render(<KidStatsTab userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Quests this week')).toBeInTheDocument()
      // The quest count appears in summary card as bold text
      const questCard = screen.getByText('Quests this week').closest('div')!
      expect(questCard.querySelector('.text-2xl')).toHaveTextContent('5')
    })
  })

  it('displays percentage change vs last week', async () => {
    setupMocks()
    render(<KidStatsTab userId="user-1" />)

    await waitFor(() => {
      // 5 vs 3: up, delta=2, percentage=67 (Math.round(2/3*100))
      expect(screen.getByText('vs last week')).toBeInTheDocument()
    })
  })

  it('shows upward trend styling for increased completions', async () => {
    setupMocks()
    render(<KidStatsTab userId="user-1" />)

    await waitFor(() => {
      // direction=up, so text should have text-green-600
      const pctEl = screen.getByText(/\+.*%/)
      expect(pctEl).toHaveClass('text-green-600')
    })
  })

  it('shows downward trend styling for decreased completions', async () => {
    setupMocks({
      analytics: { ...mockAnalytics, completions_this_week: 2, completions_last_week: 5 },
    })
    render(<KidStatsTab userId="user-1" />)

    await waitFor(() => {
      const pctEl = screen.getByText(/-.*%/)
      expect(pctEl).toHaveClass('text-red-500')
    })
  })

  it('renders AI insight card', async () => {
    setupMocks()
    render(<KidStatsTab userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('ai-insight-card')).toBeInTheDocument()
    })
  })

  it('renders Points over time heading', async () => {
    setupMocks()
    render(<KidStatsTab userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Points over time' })).toBeInTheDocument()
    })
  })

  it('renders Week comparison heading', async () => {
    setupMocks()
    render(<KidStatsTab userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Week comparison')).toBeInTheDocument()
    })
  })

  it('renders TimeRangeSelector', async () => {
    setupMocks()
    render(<KidStatsTab userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByRole('group', { name: 'Select time range' })).toBeInTheDocument()
    })
  })

  it('changes time range on button click and refetches', async () => {
    setupMocks()
    const user = userEvent.setup()
    render(<KidStatsTab userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Quests this week')).toBeInTheDocument()
    })

    // Initial call
    expect(mockRpc).toHaveBeenCalledWith('get_kid_analytics', { p_user_id: 'user-1', p_weeks: 12 })

    // Change to 4w
    await user.click(screen.getByRole('button', { name: '4w' }))

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('get_kid_analytics', { p_user_id: 'user-1', p_weeks: 4 })
    })
  })

  it('renders heatmap section when heatmap data is available', async () => {
    setupMocks()
    render(<KidStatsTab userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Activity heatmap')).toBeInTheDocument()
    })
  })

  it('does not render heatmap when heatmap data is null', async () => {
    setupMocks({ heatmap: null })
    render(<KidStatsTab userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Quests this week')).toBeInTheDocument()
    })
    expect(screen.queryByText('Activity heatmap')).not.toBeInTheDocument()
  })

  it('renders badges section when streaks are available', async () => {
    setupMocks()
    render(<KidStatsTab userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Badges (0)')).toBeInTheDocument()
    })
  })

  it('does not render badges section when streaks are null', async () => {
    setupMocks({ streaks: null })
    render(<KidStatsTab userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Quests this week')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Badges/)).not.toBeInTheDocument()
  })

  it('shows message when daily_points is empty but has completions', async () => {
    setupMocks({
      analytics: {
        ...mockAnalytics,
        daily_points: [],
        completions_this_week: 5,
        completions_last_week: 3,
      },
    })
    render(<KidStatsTab userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText(/No activity in this period/)).toBeInTheDocument()
    })
  })

  it('shows same trend styling when completions are equal', async () => {
    setupMocks({
      analytics: { ...mockAnalytics, completions_this_week: 5, completions_last_week: 5 },
    })
    render(<KidStatsTab userId="user-1" />)

    await waitFor(() => {
      const pctEl = screen.getByText('0%')
      expect(pctEl).toHaveClass('text-gray-600')
    })
  })

  it('handles heatmap RPC rejection gracefully', async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_kid_analytics') {
        return Promise.resolve({ data: mockAnalytics, error: null })
      }
      if (fn === 'get_kid_heatmap') {
        return Promise.reject(new Error('Heatmap error'))
      }
      if (fn === 'get_user_streaks') {
        return Promise.resolve({ data: mockStreaks, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    render(<KidStatsTab userId="user-1" />)

    // Should still render successfully - heatmap failure is non-blocking
    await waitFor(() => {
      expect(screen.getByText('Quests this week')).toBeInTheDocument()
    })
    // Heatmap section should not appear
    expect(screen.queryByText('Activity heatmap')).not.toBeInTheDocument()
  })

  it('handles streaks RPC rejection gracefully', async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_kid_analytics') {
        return Promise.resolve({ data: mockAnalytics, error: null })
      }
      if (fn === 'get_kid_heatmap') {
        return Promise.resolve({ data: mockHeatmap, error: null })
      }
      if (fn === 'get_user_streaks') {
        return Promise.reject(new Error('Streaks error'))
      }
      return Promise.resolve({ data: null, error: null })
    })

    render(<KidStatsTab userId="user-1" />)

    // Should still render - streaks failure is non-blocking
    await waitFor(() => {
      expect(screen.getByText('Quests this week')).toBeInTheDocument()
    })
    // Badges section should not appear (streaks is null)
    expect(screen.queryByText(/Badges/)).not.toBeInTheDocument()
  })

  it('aborts fetch on unmount', () => {
    const abortSpy = jest.spyOn(AbortController.prototype, 'abort')
    setupMocks()

    const { unmount } = render(<KidStatsTab userId="user-1" />)
    unmount()

    expect(abortSpy).toHaveBeenCalled()
    abortSpy.mockRestore()
  })

  it('calls RPCs with correct parameters', async () => {
    setupMocks()
    render(<KidStatsTab userId="user-1" />)

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('get_kid_analytics', { p_user_id: 'user-1', p_weeks: 12 })
      expect(mockRpc).toHaveBeenCalledWith('get_kid_heatmap', { p_user_id: 'user-1' })
      expect(mockRpc).toHaveBeenCalledWith('get_user_streaks', { p_user_id: 'user-1' })
    })
  })
})
