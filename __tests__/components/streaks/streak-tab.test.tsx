import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { StreakTab } from '@/components/streaks/streak-tab'

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

// Mock Supabase
const mockRpc = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}))

const mockStreaks = {
  active_day_streak: 5,
  perfect_day_streak: 3,
  task_streaks: [
    { task_id: 'task-1', title: 'Make Bed', current_streak: 7 },
    { task_id: 'task-2', title: 'Brush Teeth', current_streak: 0 },
  ],
}

const mockMilestones = [
  { streak_type: 'active_day', task_id: null, milestone_days: 7, points_awarded: 50, badge_name: 'Week Warrior' },
]

function setupMocks(overrides?: {
  streaks?: typeof mockStreaks | null
  freezes?: { available: number; used: number } | null
  milestones?: typeof mockMilestones | null
}) {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === 'get_user_streaks') {
      return Promise.resolve({ data: overrides?.streaks ?? mockStreaks })
    }
    if (fn === 'claim_streak_milestone') {
      return Promise.resolve({ data: { success: true, bonus: 50, badge: 'Week Warrior' } })
    }
    if (fn === 'buy_streak_freeze') {
      return Promise.resolve({ data: { success: true } })
    }
    return Promise.resolve({ data: null })
  })

  mockFrom.mockImplementation((table: string) => ({
    select: () => ({
      eq: () => {
        if (table === 'streak_freezes') {
          return {
            single: () => Promise.resolve({ data: overrides?.freezes ?? { available: 2, used: 1 } }),
          }
        }
        // streak_milestones
        return Promise.resolve({ data: overrides?.milestones ?? mockMilestones })
      },
    }),
  }))
}

describe('StreakTab', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupMocks()
  })

  it('shows loading skeleton initially', () => {
    // Make RPC hang
    mockRpc.mockReturnValue(new Promise(() => {}))
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => new Promise(() => {}),
        }),
      }),
    })

    render(<StreakTab userId="user-1" userPoints={100} />)

    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders active streak count summary', async () => {
    render(<StreakTab userId="user-1" userPoints={100} />)

    await waitFor(() => {
      // 3 active: active_day (5), perfect_day (3), Make Bed (7) — Brush Teeth is 0
      expect(screen.getByText(/active streaks/)).toBeInTheDocument()
    })
  })

  it('renders Active Day streak card', async () => {
    render(<StreakTab userId="user-1" userPoints={100} />)

    await waitFor(() => {
      expect(screen.getByText('Active Day')).toBeInTheDocument()
      expect(screen.getByTestId('streak-count-active_day')).toHaveTextContent('5')
    })
  })

  it('renders Perfect Day streak card', async () => {
    render(<StreakTab userId="user-1" userPoints={100} />)

    await waitFor(() => {
      expect(screen.getByText('Perfect Day')).toBeInTheDocument()
      expect(screen.getByTestId('streak-count-perfect_day')).toHaveTextContent('3')
    })
  })

  it('renders task streak cards', async () => {
    render(<StreakTab userId="user-1" userPoints={100} />)

    await waitFor(() => {
      expect(screen.getByText('Make Bed')).toBeInTheDocument()
      expect(screen.getByText('Brush Teeth')).toBeInTheDocument()
    })
  })

  it('renders freeze section', async () => {
    render(<StreakTab userId="user-1" userPoints={100} />)

    await waitFor(() => {
      expect(screen.getByText('Streak Freezes')).toBeInTheDocument()
      expect(screen.getByTestId('freeze-count')).toHaveTextContent('1')
    })
  })

  it('shows singular "streak" when only 1 active', async () => {
    setupMocks({
      streaks: {
        active_day_streak: 1,
        perfect_day_streak: 0,
        task_streaks: [],
      },
    })

    render(<StreakTab userId="user-1" userPoints={100} />)

    await waitFor(() => {
      expect(screen.getByText(/active streak$/)).toBeInTheDocument()
    })
  })

  it('handles null streaks data', async () => {
    setupMocks({ streaks: null })

    render(<StreakTab userId="user-1" userPoints={100} />)

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  it('handles null freezes data gracefully', async () => {
    setupMocks({ freezes: null })

    render(<StreakTab userId="user-1" userPoints={100} />)

    await waitFor(() => {
      // When freeze data is null, defaults to { available: 0, used: 0 }
      expect(screen.getByText('Streak Freezes')).toBeInTheDocument()
      expect(screen.getByTestId('freeze-count')).toBeInTheDocument()
    })
  })

  it('handles null milestones data', async () => {
    setupMocks({ milestones: null })

    render(<StreakTab userId="user-1" userPoints={100} />)

    await waitFor(() => {
      expect(screen.getByText('Active Day')).toBeInTheDocument()
    })
  })

  it('calls claim_streak_milestone RPC and shows toast on success', async () => {
    setupMocks({
      streaks: {
        active_day_streak: 7,
        perfect_day_streak: 0,
        task_streaks: [],
      },
      milestones: [],
    })

    const user = userEvent.setup()
    render(<StreakTab userId="user-1" userPoints={100} />)

    await waitFor(() => {
      expect(screen.getByText('Active Day')).toBeInTheDocument()
    })

    // Find the claimable 7-day milestone for Active Day
    const claimableButton = screen.getAllByLabelText(/Week Warrior.*claimable/)[0]
    await user.click(claimableButton)

    expect(mockRpc).toHaveBeenCalledWith('claim_streak_milestone', {
      p_user_id: 'user-1',
      p_streak_type: 'active_day',
      p_task_id: '00000000-0000-0000-0000-000000000000',
      p_milestone_days: 7,
      p_current_streak: 7,
    })

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Week Warrior unlocked! +50 points')
    })
  })

  it('calls buy_streak_freeze RPC and shows toast on success', async () => {
    const user = userEvent.setup()
    render(<StreakTab userId="user-1" userPoints={100} />)

    await waitFor(() => {
      expect(screen.getByText('Streak Freezes')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Buy Freeze/i }))

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('buy_streak_freeze', { p_user_id: 'user-1' })
      expect(toast.success).toHaveBeenCalledWith('Streak freeze purchased!')
    })
  })

  it('handles failed claim (success: false)', async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_user_streaks') return Promise.resolve({ data: { ...mockStreaks, active_day_streak: 7 } })
      if (fn === 'claim_streak_milestone') return Promise.resolve({ data: { success: false, error: 'Already claimed' } })
      return Promise.resolve({ data: null })
    })

    const user = userEvent.setup()
    render(<StreakTab userId="user-1" userPoints={100} />)

    await waitFor(() => {
      expect(screen.getByText('Active Day')).toBeInTheDocument()
    })

    const claimableButton = screen.getAllByLabelText(/Week Warrior.*claimable/)[0]
    await user.click(claimableButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Already claimed')
    })
  })

  it('handles failed buy (success: false) with toast error', async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_user_streaks') return Promise.resolve({ data: mockStreaks })
      if (fn === 'buy_streak_freeze') return Promise.resolve({ data: { success: false, error: 'Not enough points' } })
      return Promise.resolve({ data: null })
    })

    const user = userEvent.setup()
    render(<StreakTab userId="user-1" userPoints={100} />)

    await waitFor(() => {
      expect(screen.getByText('Streak Freezes')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Buy Freeze/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Not enough points')
    })
  })

  it('claims task-specific milestone with task_id', async () => {
    setupMocks({
      streaks: {
        active_day_streak: 0,
        perfect_day_streak: 0,
        task_streaks: [
          { task_id: 'task-1', title: 'Make Bed', current_streak: 7 },
        ],
      },
      milestones: [],
    })

    const user = userEvent.setup()
    render(<StreakTab userId="user-1" userPoints={100} />)

    await waitFor(() => {
      expect(screen.getByText('Make Bed')).toBeInTheDocument()
    })

    // The Make Bed card should have a claimable 7-day milestone
    // There are multiple streak cards, find the one for Make Bed
    const claimableButtons = screen.getAllByLabelText(/Week Warrior.*claimable/)
    await user.click(claimableButtons[claimableButtons.length - 1])

    expect(mockRpc).toHaveBeenCalledWith('claim_streak_milestone', {
      p_user_id: 'user-1',
      p_streak_type: 'task',
      p_task_id: 'task-1',
      p_milestone_days: 7,
      p_current_streak: 7,
    })
  })

  it('claims perfect day milestone', async () => {
    setupMocks({
      streaks: {
        active_day_streak: 0,
        perfect_day_streak: 7,
        task_streaks: [],
      },
      milestones: [],
    })

    const user = userEvent.setup()
    render(<StreakTab userId="user-1" userPoints={100} />)

    await waitFor(() => {
      expect(screen.getByText('Perfect Day')).toBeInTheDocument()
    })

    const claimableButtons = screen.getAllByLabelText(/Week Warrior.*claimable/)
    await user.click(claimableButtons[0])

    expect(mockRpc).toHaveBeenCalledWith('claim_streak_milestone', {
      p_user_id: 'user-1',
      p_streak_type: 'perfect_day',
      p_task_id: '00000000-0000-0000-0000-000000000000',
      p_milestone_days: 7,
      p_current_streak: 7,
    })
  })

  it('filters claimed milestones by streak type and task_id', async () => {
    setupMocks({
      streaks: {
        active_day_streak: 7,
        perfect_day_streak: 7,
        task_streaks: [
          { task_id: 'task-1', title: 'Make Bed', current_streak: 7 },
        ],
      },
      milestones: [
        { streak_type: 'active_day', task_id: null, milestone_days: 7, points_awarded: 50, badge_name: 'Week Warrior' },
        { streak_type: 'task', task_id: 'task-1', milestone_days: 7, points_awarded: 50, badge_name: 'Week Warrior' },
      ],
    })

    render(<StreakTab userId="user-1" userPoints={100} />)

    await waitFor(() => {
      // Active Day 7d should be claimed
      // Perfect Day 7d should be claimable (not in milestones)
      // Make Bed 7d should be claimed
      const claimedBadges = screen.getAllByLabelText(/Week Warrior.*claimed/)
      const claimableBadges = screen.getAllByLabelText(/Week Warrior.*claimable/)
      expect(claimedBadges.length).toBe(2) // active_day + task
      expect(claimableBadges.length).toBe(1) // perfect_day
    })
  })
})
