import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { ParentAnalytics } from '@/components/analytics/parent-analytics'
import type { FamilyAnalytics } from '@/lib/types'

// Mock sonner
jest.mock('sonner', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}))

// Mock next/dynamic to render children synchronously
jest.mock('next/dynamic', () => {
  return (loader: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
    let Component: React.ComponentType<Record<string, unknown>> | null = null
    const promise = loader()
    promise.then((mod) => { Component = mod.default })
    return function DynamicComponent(props: Record<string, unknown>) {
      if (!Component) return null
      return <Component {...props} />
    }
  }
})

// Mock child components to simplify testing
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

const mockAnalytics: FamilyAnalytics = {
  children: [
    {
      profile: { id: 'c1', display_name: 'Alice', nickname: null, avatar_url: null, points: 100 },
      completions_this_week: 8,
      completions_last_week: 5,
      completion_rate: 0.8,
    },
    {
      profile: { id: 'c2', display_name: 'Bob', nickname: 'Bobby', avatar_url: null, points: 200 },
      completions_this_week: 3,
      completions_last_week: 7,
      completion_rate: 0.6,
    },
  ],
  daily_totals: [
    { date: '2024-01-01', points: 30, completions: 5 },
    { date: '2024-01-08', points: 20, completions: 3 },
  ],
  top_tasks: [
    { task_id: 't1', title: 'Make Bed', count: 15 },
    { task_id: 't2', title: 'Brush Teeth', count: 10 },
  ],
  bottom_tasks: [
    { task_id: 't3', title: 'Clean Room', count: 2 },
  ],
  family_completion_rate: 0.75,
}

function setupMocks(overrides?: {
  analytics?: FamilyAnalytics | null
  error?: { code: string } | null
  reject?: boolean
}) {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === 'get_family_analytics') {
      if (overrides?.reject) {
        return Promise.reject(new Error('Network error'))
      }
      return Promise.resolve({
        data: overrides?.analytics !== undefined ? overrides.analytics : mockAnalytics,
        error: overrides?.error ?? null,
      })
    }
    return Promise.resolve({ data: null, error: null })
  })
}

describe('ParentAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows loading skeleton initially', () => {
    mockRpc.mockReturnValue(new Promise(() => {}))
    render(<ParentAnalytics familyId="fam-1" userId="user-1" />)
    expect(screen.getByLabelText('Loading analytics')).toBeInTheDocument()
  })

  it('shows auth error state when RPC returns 42501', async () => {
    setupMocks({ error: { code: '42501' } })
    render(<ParentAnalytics familyId="fam-1" userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('You need to be a parent to view family analytics.')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Go to Family' })).toHaveAttribute('href', '/family')
    })
  })

  it('shows fetch error toast on RPC error', async () => {
    setupMocks({ error: { code: 'PGRST000' } })
    render(<ParentAnalytics familyId="fam-1" userId="user-1" />)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Couldn't load family analytics")
    })
  })

  it('shows empty state when analytics is null', async () => {
    setupMocks({ analytics: null })
    render(<ParentAnalytics familyId="fam-1" userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Invite your kids to see their progress here')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Go to Family' })).toHaveAttribute('href', '/family')
    })
  })

  it('shows empty state when children array is empty', async () => {
    setupMocks({ analytics: { ...mockAnalytics, children: [] } })
    render(<ParentAnalytics familyId="fam-1" userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Invite your kids to see their progress here')).toBeInTheDocument()
    })
  })

  it('renders success state with completion rate', async () => {
    setupMocks()
    render(<ParentAnalytics familyId="fam-1" userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('75%')).toBeInTheDocument()
      expect(screen.getByText('Completion rate')).toBeInTheDocument()
    })
  })

  it('renders total quests this week', async () => {
    setupMocks()
    render(<ParentAnalytics familyId="fam-1" userId="user-1" />)

    await waitFor(() => {
      // 8 + 3 = 11
      expect(screen.getByText('11')).toBeInTheDocument()
      expect(screen.getByText('Quests this week')).toBeInTheDocument()
    })
  })

  it('renders kids count', async () => {
    setupMocks()
    render(<ParentAnalytics familyId="fam-1" userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Kids')).toBeInTheDocument()
      const kidsCard = screen.getByText('Kids').closest('div')!
      expect(kidsCard.querySelector('.text-2xl')).toHaveTextContent('2')
    })
  })

  it('shows warning banner when some kids have zero completions', async () => {
    setupMocks({
      analytics: {
        ...mockAnalytics,
        children: [
          { ...mockAnalytics.children[0], completions_this_week: 0 },
          mockAnalytics.children[1],
        ],
      },
    })
    render(<ParentAnalytics familyId="fam-1" userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText(/No quests completed yet for some kids/)).toBeInTheDocument()
    })
  })

  it('does not show warning banner when all kids have completions', async () => {
    setupMocks()
    render(<ParentAnalytics familyId="fam-1" userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Completion rate')).toBeInTheDocument()
    })
    expect(screen.queryByText(/No quests completed yet for some kids/)).not.toBeInTheDocument()
  })

  it('renders AI insight card', async () => {
    setupMocks()
    render(<ParentAnalytics familyId="fam-1" userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('ai-insight-card')).toBeInTheDocument()
    })
  })

  it('renders Child comparison heading and TimeRangeSelector', async () => {
    setupMocks()
    render(<ParentAnalytics familyId="fam-1" userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Child comparison')).toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'Select time range' })).toBeInTheDocument()
    })
  })

  it('renders Activity trend heading', async () => {
    setupMocks()
    render(<ParentAnalytics familyId="fam-1" userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Activity trend')).toBeInTheDocument()
    })
  })

  it('renders Points distribution heading', async () => {
    setupMocks()
    render(<ParentAnalytics familyId="fam-1" userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Points distribution')).toBeInTheDocument()
    })
  })

  it('renders Most completed quests section when top_tasks exist', async () => {
    setupMocks()
    render(<ParentAnalytics familyId="fam-1" userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Most completed quests' })).toBeInTheDocument()
    })
  })

  it('renders Least completed quests section when bottom_tasks exist', async () => {
    setupMocks()
    render(<ParentAnalytics familyId="fam-1" userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Least completed quests' })).toBeInTheDocument()
    })
  })

  it('does not render top tasks section when top_tasks is empty', async () => {
    setupMocks({ analytics: { ...mockAnalytics, top_tasks: [] } })
    render(<ParentAnalytics familyId="fam-1" userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Completion rate')).toBeInTheDocument()
    })
    expect(screen.queryByText('Most completed quests')).not.toBeInTheDocument()
  })

  it('does not render bottom tasks section when bottom_tasks is empty', async () => {
    setupMocks({ analytics: { ...mockAnalytics, bottom_tasks: [] } })
    render(<ParentAnalytics familyId="fam-1" userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Completion rate')).toBeInTheDocument()
    })
    expect(screen.queryByText('Least completed quests')).not.toBeInTheDocument()
  })

  it('changes time range on button click and refetches', async () => {
    setupMocks()
    const user = userEvent.setup()
    render(<ParentAnalytics familyId="fam-1" userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Completion rate')).toBeInTheDocument()
    })

    expect(mockRpc).toHaveBeenCalledWith('get_family_analytics', { p_family_id: 'fam-1', p_weeks: 12 })

    await user.click(screen.getByRole('button', { name: '26w' }))

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('get_family_analytics', { p_family_id: 'fam-1', p_weeks: 26 })
    })
  })

  it('aborts fetch on unmount', () => {
    const abortSpy = jest.spyOn(AbortController.prototype, 'abort')
    setupMocks()

    const { unmount } = render(<ParentAnalytics familyId="fam-1" userId="user-1" />)
    unmount()

    expect(abortSpy).toHaveBeenCalled()
    abortSpy.mockRestore()
  })

  it('calls RPC with correct parameters', async () => {
    setupMocks()
    render(<ParentAnalytics familyId="fam-1" userId="user-1" />)

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('get_family_analytics', {
        p_family_id: 'fam-1',
        p_weeks: 12,
      })
    })
  })
})
