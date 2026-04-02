import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RewardsPage from '@/app/(dashboard)/rewards/page'

// Mock next/navigation
const mockPush = jest.fn()
const mockGet = jest.fn().mockReturnValue(null)
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: mockGet }),
  useRouter: () => ({ push: mockPush }),
}))

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string; src: string }) => <img alt={props.alt} src={props.src} />,
}))

// Mock sonner
jest.mock('sonner', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
  Toaster: () => null,
}))

// Mock data
const mockUser = { id: 'user-parent', email: 'parent@example.com' }
const mockChildUser = { id: 'user-child', email: 'child@example.com' }

const mockParentProfile = {
  id: 'user-parent',
  family_id: 'family-1',
  display_name: 'Test Parent',
  avatar_url: null,
  nickname: null,
  role: 'parent',
  points: 200,
  created_at: '2024-01-01T00:00:00Z',
}

const mockChildProfile = {
  id: 'user-child',
  family_id: 'family-1',
  display_name: 'Timmy Jones',
  avatar_url: null,
  nickname: 'Little T',
  role: 'child',
  points: 100,
  created_at: '2024-01-01T00:00:00Z',
}

const mockMembers = [
  mockParentProfile,
  mockChildProfile,
  {
    id: 'child-2',
    family_id: 'family-1',
    display_name: 'Sally',
    avatar_url: null,
    nickname: null,
    role: 'child',
    points: 75,
    created_at: '2024-01-01T00:00:00Z',
  },
]

const mockRewards = [
  {
    id: 'reward-1',
    family_id: 'family-1',
    title: 'Movie Night',
    description: null,
    points_cost: 50,
    icon_id: 'movie',
    category: 'activities',
    stock: null,
    active: true,
    created_by: 'user-parent',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
]

const mockRedemptions = [
  {
    id: 'redemption-1',
    reward_id: 'reward-1',
    redeemed_by: 'user-child',
    points_cost: 50,
    status: 'pending',
    redeemed_at: new Date().toISOString(),
    resolved_at: null,
    resolved_by: null,
    rewards: { title: 'Movie Night', icon_id: 'movie' },
  },
]

const mockPendingApprovals = [
  {
    id: 'redemption-1',
    reward_id: 'reward-1',
    redeemed_by: 'user-child',
    points_cost: 50,
    status: 'pending',
    redeemed_at: new Date().toISOString(),
    resolved_at: null,
    resolved_by: null,
    rewards: { title: 'Movie Night', icon_id: 'movie', family_id: 'family-1' },
    profiles: { display_name: 'Timmy', nickname: 'Little T', avatar_url: null },
  },
]

// Mutable state containers
const mockState = {
  user: mockUser as typeof mockUser | null,
  profile: mockParentProfile as unknown,
  members: mockMembers as unknown[],
  rewards: mockRewards as unknown[],
  myRedemptions: [] as unknown[],
  myRedemptionsCount: 0,
  pendingApprovals: [] as unknown[],
  pendingPoints: [] as unknown[],
}

const mockGetUser = jest.fn()
const mockRpc = jest.fn()
const mockInsert = jest.fn()
const mockUpdate = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: () => mockGetUser(),
    },
    rpc: (name: string, args: unknown) => mockRpc(name, args),
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => {
              const membersPromise = Promise.resolve({ data: mockState.members })
              return Object.assign(membersPromise, {
                single: () => Promise.resolve({ data: mockState.profile }),
                order: () => Promise.resolve({ data: mockState.members }),
              })
            },
          }),
        }
      }
      if (table === 'rewards') {
        return {
          select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
            // Seed check: select('*', { count: 'exact', head: true })
            if (opts?.head) {
              return {
                eq: () => Promise.resolve({ count: (mockState.rewards ?? []).length }),
              }
            }
            return {
              eq: () => ({
                order: () => Promise.resolve({ data: mockState.rewards }),
              }),
            }
          },
          insert: (data: unknown) => mockInsert(data),
          update: (data: unknown) => ({
            eq: (...args: unknown[]) => mockUpdate(data, ...args),
          }),
        }
      }
      if (table === 'reward_redemptions') {
        return {
          select: (cols: string) => {
            // Pending points query
            if (cols === 'points_cost') {
              return {
                eq: () => ({
                  eq: () => Promise.resolve({ data: mockState.pendingPoints }),
                }),
              }
            }
            // Pending approvals query (parent)
            if (cols.includes('profiles!')) {
              return {
                eq: () => ({
                  eq: () => ({
                    order: () => Promise.resolve({ data: mockState.pendingApprovals }),
                  }),
                }),
              }
            }
            // My redemptions query (with count)
            return {
              eq: () => ({
                order: () => ({
                  range: () =>
                    Promise.resolve({
                      data: mockState.myRedemptions,
                      count: mockState.myRedemptionsCount,
                    }),
                }),
              }),
            }
          },
        }
      }
      return {
        select: () => ({
          eq: () => ({ single: () => Promise.resolve({ data: null }) }),
        }),
      }
    },
  }),
}))

describe('RewardsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGet.mockReturnValue(null) // default tab = store
    mockState.user = mockUser
    mockState.profile = mockParentProfile
    mockState.members = mockMembers
    mockState.rewards = mockRewards
    mockState.myRedemptions = []
    mockState.myRedemptionsCount = 0
    mockState.pendingApprovals = []
    mockState.pendingPoints = []
    mockGetUser.mockResolvedValue({ data: { user: mockUser } })
    mockInsert.mockResolvedValue({ error: null })
    mockUpdate.mockResolvedValue({ error: null })
    mockRpc.mockResolvedValue({ data: { success: true } })
  })

  it('shows loading state initially', () => {
    mockGetUser.mockReturnValue(new Promise(() => {}))
    render(<RewardsPage />)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('stops loading when user not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    render(<RewardsPage />)
    await waitFor(() => expect(document.querySelector('.animate-spin')).not.toBeInTheDocument())
  })

  it('stops loading when profile not found', async () => {
    mockState.profile = null
    render(<RewardsPage />)
    await waitFor(() => expect(document.querySelector('.animate-spin')).not.toBeInTheDocument())
  })

  it('shows no-family state when user has no family', async () => {
    mockState.profile = { ...mockParentProfile, family_id: null }
    render(<RewardsPage />)
    await waitFor(() => expect(screen.getByText('No Family Yet')).toBeInTheDocument())
    expect(screen.getByText(/join a family to see the leaderboard/i)).toBeInTheDocument()
  })

  it('shows Set Up Family link in no-family state', async () => {
    mockState.profile = { ...mockParentProfile, family_id: null }
    render(<RewardsPage />)
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Set Up Family' })).toBeInTheDocument()
    )
  })

  it('renders page header', async () => {
    render(<RewardsPage />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Rewards' })).toBeInTheDocument()
      expect(screen.getByText('Family leaderboard')).toBeInTheDocument()
    })
  })

  it('renders leaderboard podium', async () => {
    render(<RewardsPage />)
    await waitFor(() => {
      expect(screen.getByText('200 pts')).toBeInTheDocument()
      expect(screen.getByText('🏆')).toBeInTheDocument()
      expect(screen.getByText('👑')).toBeInTheDocument()
    })
  })

  it('renders member names on podium (uses first name when no nickname)', async () => {
    render(<RewardsPage />)
    await waitFor(() => {
      // topThree[0] = Parent (no nickname) → "Test"
      expect(screen.getByText('Test')).toBeInTheDocument()
      // topThree[1] = Timmy (has nickname "Little T")
      expect(screen.getByText('Little T')).toBeInTheDocument()
      // topThree[2] = Sally (no nickname) → "Sally"
      expect(screen.getByText('Sally')).toBeInTheDocument()
    })
  })

  it('renders 4th+ members in list below podium', async () => {
    mockState.members = [
      ...mockMembers,
      { id: 'child-3', family_id: 'family-1', display_name: 'Bob', avatar_url: null, nickname: null, role: 'child', points: 25, created_at: '2024-01-01T00:00:00Z' },
    ]
    render(<RewardsPage />)
    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument()
      expect(screen.getByText('4')).toBeInTheDocument()
    })
  })

  it('renders with only 1 member (no 2nd/3rd place)', async () => {
    mockState.members = [mockParentProfile]
    render(<RewardsPage />)
    await waitFor(() => expect(screen.getByText('200 pts')).toBeInTheDocument())
    expect(screen.queryByText('🥈')).not.toBeInTheDocument()
  })

  it('renders with 2 members (no 3rd place)', async () => {
    mockState.members = [mockParentProfile, mockChildProfile]
    render(<RewardsPage />)
    await waitFor(() => {
      expect(screen.getByText('200 pts')).toBeInTheDocument()
      expect(screen.getByText('100 pts')).toBeInTheDocument()
    })
    expect(screen.queryByText('🥉')).not.toBeInTheDocument()
  })

  it('handles null membersData', async () => {
    mockState.members = null as unknown as unknown[]
    render(<RewardsPage />)
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Rewards' })).toBeInTheDocument()
    )
  })

  it('handles null data from all queries', async () => {
    mockState.rewards = null as unknown as typeof mockState.rewards
    mockState.myRedemptions = null as unknown as typeof mockState.myRedemptions
    mockState.myRedemptionsCount = null as unknown as number
    mockState.pendingApprovals = null as unknown as typeof mockState.pendingApprovals
    mockState.pendingPoints = null as unknown as typeof mockState.pendingPoints
    render(<RewardsPage />)
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Rewards' })).toBeInTheDocument()
    )
  })

  it('renders 2nd place member display name when no nickname', async () => {
    mockState.members = [
      mockParentProfile,
      { ...mockChildProfile, nickname: null },
      { id: 'child-2', family_id: 'family-1', display_name: 'Sally Jones', avatar_url: null, nickname: null, role: 'child', points: 75, created_at: '2024-01-01T00:00:00Z' },
    ]
    render(<RewardsPage />)
    await waitFor(() => expect(screen.getByText('Timmy')).toBeInTheDocument())
  })

  describe('parent view', () => {
    it('shows Store, My Rewards, Manage, Approvals tabs', async () => {
      render(<RewardsPage />)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Store' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'My Rewards' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Manage' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Approvals' })).toBeInTheDocument()
      })
    })

    it('shows points balance', async () => {
      render(<RewardsPage />)
      await waitFor(() =>
        expect(screen.getByText('200 pts available')).toBeInTheDocument()
      )
    })

    it('shows pending points when there are pending redemptions', async () => {
      mockState.pendingPoints = [{ points_cost: 50 }]
      render(<RewardsPage />)
      await waitFor(() =>
        expect(screen.getByText('(50 pending approval)')).toBeInTheDocument()
      )
    })

    it('shows approval badge count when approvals pending', async () => {
      mockState.pendingApprovals = mockPendingApprovals
      render(<RewardsPage />)
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Approvals (1)' })).toBeInTheDocument()
      )
    })

    it('shows store tab content by default', async () => {
      render(<RewardsPage />)
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
      )
    })

    it('shows reward cards in store', async () => {
      render(<RewardsPage />)
      await waitFor(() => expect(screen.getByText('Movie Night')).toBeInTheDocument())
    })

    it('switches to my-rewards tab', async () => {
      render(<RewardsPage />)
      await waitFor(() => screen.getByRole('button', { name: 'My Rewards' }))
      await userEvent.click(screen.getByRole('button', { name: 'My Rewards' }))
      expect(mockPush).toHaveBeenCalledWith('?tab=my-rewards')
    })

    it('shows my-rewards tab content when tab=my-rewards', async () => {
      mockGet.mockReturnValue('my-rewards')
      mockState.myRedemptions = mockRedemptions
      mockState.myRedemptionsCount = 1
      render(<RewardsPage />)
      await waitFor(() => expect(screen.getByText('Waiting for approval')).toBeInTheDocument())
    })

    it('shows manage tab content when tab=manage', async () => {
      mockGet.mockReturnValue('manage')
      render(<RewardsPage />)
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Add Reward/i })).toBeInTheDocument()
      )
    })

    it('shows approvals tab content when tab=approvals', async () => {
      mockGet.mockReturnValue('approvals')
      mockState.pendingApprovals = mockPendingApprovals
      render(<RewardsPage />)
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
      )
    })

    it('opens form when Add Reward clicked in manage tab', async () => {
      mockGet.mockReturnValue('manage')
      render(<RewardsPage />)
      await waitFor(() => screen.getByRole('button', { name: /Add Reward/i }))
      await userEvent.click(screen.getByRole('button', { name: /Add Reward/i }))
      expect(screen.getByText('New Reward')).toBeInTheDocument()
    })

    it('opens edit form when Edit clicked in manage tab', async () => {
      mockGet.mockReturnValue('manage')
      render(<RewardsPage />)
      await waitFor(() => screen.getByRole('button', { name: 'Edit' }))
      await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
      expect(screen.getByText('Edit Reward')).toBeInTheDocument()
    })

    it('creates reward via form submit', async () => {
      mockGet.mockReturnValue('manage')
      render(<RewardsPage />)
      await waitFor(() => screen.getByRole('button', { name: /Add Reward/i }))
      await userEvent.click(screen.getByRole('button', { name: /Add Reward/i }))
      await userEvent.type(screen.getByLabelText(/Title/i), 'New Reward')
      await userEvent.click(screen.getByRole('button', { name: 'Create Reward' }))
      await waitFor(() => expect(mockInsert).toHaveBeenCalled())
    })

    it('updates reward via form submit', async () => {
      mockGet.mockReturnValue('manage')
      render(<RewardsPage />)
      await waitFor(() => screen.getByRole('button', { name: 'Edit' }))
      await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
      await waitFor(() => screen.getByLabelText(/Title/i))
      // Clear and retype
      await userEvent.clear(screen.getByLabelText(/Title/i))
      await userEvent.type(screen.getByLabelText(/Title/i), 'Updated')
      await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
      await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
    })

    it('shows error when update reward fails', async () => {
      mockUpdate.mockResolvedValue({ error: { message: 'Update failed' } })
      mockGet.mockReturnValue('manage')
      render(<RewardsPage />)
      await waitFor(() => screen.getByRole('button', { name: 'Edit' }))
      await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
      await waitFor(() => screen.getByLabelText(/Title/i))
      await userEvent.clear(screen.getByLabelText(/Title/i))
      await userEvent.type(screen.getByLabelText(/Title/i), 'Updated')
      await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
      await waitFor(() =>
        expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
      )
    })

    it('shows error toast when insert fails', async () => {
      mockInsert.mockResolvedValue({ error: { message: 'DB error' } })
      mockGet.mockReturnValue('manage')
      render(<RewardsPage />)
      await waitFor(() => screen.getByRole('button', { name: /Add Reward/i }))
      await userEvent.click(screen.getByRole('button', { name: /Add Reward/i }))
      await userEvent.type(screen.getByLabelText(/Title/i), 'Test')
      await userEvent.click(screen.getByRole('button', { name: 'Create Reward' }))
      await waitFor(() =>
        expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
      )
    })

    it('toggles reward active state', async () => {
      mockGet.mockReturnValue('manage')
      render(<RewardsPage />)
      await waitFor(() => screen.getByRole('button', { name: 'Deactivate' }))
      await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
      await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
    })

    it('shows toast error when toggle update fails', async () => {
      const { toast } = jest.requireMock('sonner')
      mockUpdate.mockResolvedValue({ error: { message: 'Toggle failed' } })
      mockGet.mockReturnValue('manage')
      render(<RewardsPage />)
      await waitFor(() => screen.getByRole('button', { name: 'Deactivate' }))
      await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Toggle failed'))
    })

    it('deletes reward (soft-delete via deactivate)', async () => {
      mockGet.mockReturnValue('manage')
      render(<RewardsPage />)
      await waitFor(() => screen.getByRole('button', { name: 'Delete' }))
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
      const modal = screen.getByText('Delete Reward?').closest('div')!
      await userEvent.click(within(modal).getByRole('button', { name: /^Delete$/ }))
      await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
    })

    it('throws error from delete when update fails', async () => {
      mockUpdate.mockResolvedValue({ error: { message: 'Cannot delete' } })
      mockGet.mockReturnValue('manage')
      render(<RewardsPage />)
      await waitFor(() => screen.getByRole('button', { name: 'Delete' }))
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
      const modal = screen.getByText('Delete Reward?').closest('div')!
      await userEvent.click(within(modal).getByRole('button', { name: /^Delete$/ }))
      await waitFor(() =>
        expect(screen.getByText('Cannot delete')).toBeInTheDocument()
      )
    })

    it('approves redemption in approvals tab', async () => {
      mockGet.mockReturnValue('approvals')
      mockState.pendingApprovals = mockPendingApprovals
      render(<RewardsPage />)
      await waitFor(() => screen.getByRole('button', { name: 'Approve' }))
      await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
      await waitFor(() =>
        expect(mockRpc).toHaveBeenCalledWith('resolve_redemption', expect.objectContaining({ p_action: 'approved' }))
      )
    })

    it('shows toast error when approve RPC fails', async () => {
      const { toast } = jest.requireMock('sonner')
      mockRpc.mockResolvedValue({ data: { success: false, error: 'Already approved' } })
      mockGet.mockReturnValue('approvals')
      mockState.pendingApprovals = mockPendingApprovals
      render(<RewardsPage />)
      await waitFor(() => screen.getByRole('button', { name: 'Approve' }))
      await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
      await waitFor(() => expect(toast.error).toHaveBeenCalled())
    })

    it('rejects redemption in approvals tab', async () => {
      mockGet.mockReturnValue('approvals')
      mockState.pendingApprovals = mockPendingApprovals
      render(<RewardsPage />)
      await waitFor(() => screen.getByRole('button', { name: 'Reject' }))
      await userEvent.click(screen.getByRole('button', { name: 'Reject' }))
      const modal = screen.getByText('Reject Reward?').closest('div')!
      await userEvent.click(within(modal).getByRole('button', { name: /^Reject$/ }))
      await waitFor(() =>
        expect(mockRpc).toHaveBeenCalledWith('resolve_redemption', expect.objectContaining({ p_action: 'rejected' }))
      )
    })

    it('shows toast error when reject RPC fails', async () => {
      const { toast } = jest.requireMock('sonner')
      mockRpc.mockResolvedValue({ data: { success: false, error: 'Already resolved' } })
      mockGet.mockReturnValue('approvals')
      mockState.pendingApprovals = mockPendingApprovals
      render(<RewardsPage />)
      await waitFor(() => screen.getByRole('button', { name: 'Reject' }))
      await userEvent.click(screen.getByRole('button', { name: 'Reject' }))
      const modal = screen.getByText('Reject Reward?').closest('div')!
      await userEvent.click(within(modal).getByRole('button', { name: /^Reject$/ }))
      await waitFor(() => expect(toast.error).toHaveBeenCalled())
    })

    it('loads more redemptions', async () => {
      mockGet.mockReturnValue('my-rewards')
      mockState.myRedemptions = mockRedemptions
      mockState.myRedemptionsCount = 25 // > PAGE_SIZE=20, triggers hasMore
      render(<RewardsPage />)
      await waitFor(() => screen.getByRole('button', { name: /Load more/i }))
      await userEvent.click(screen.getByRole('button', { name: /Load more/i }))
      // Second fetch called (for offset=20)
      await waitFor(() => expect(screen.getByRole('button', { name: /Load more/i })).toBeInTheDocument())
    })
  })

  describe('child view', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: mockChildUser } })
      mockState.profile = mockChildProfile
    })

    it('shows Store and My Rewards tabs but not Manage/Approvals', async () => {
      render(<RewardsPage />)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Store' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'My Rewards' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Manage' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Approvals' })).not.toBeInTheDocument()
      })
    })

    it('shows child points balance', async () => {
      render(<RewardsPage />)
      await waitFor(() => expect(screen.getByText('100 pts available')).toBeInTheDocument())
    })

    it('can redeem a reward (calls RPC)', async () => {
      render(<RewardsPage />)
      await waitFor(() => screen.getAllByRole('button', { name: 'Redeem' }))
      await userEvent.click(screen.getAllByRole('button', { name: 'Redeem' })[0])
      // Confirm modal opens
      expect(screen.getByText('Redeem Reward')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Confirm Redemption' }))
      await waitFor(() =>
        expect(mockRpc).toHaveBeenCalledWith('redeem_reward', expect.any(Object))
      )
    })

    it('throws error when redeem RPC fails', async () => {
      mockRpc.mockResolvedValue({ data: { success: false, error: 'Not enough points' } })
      render(<RewardsPage />)
      await waitFor(() => screen.getAllByRole('button', { name: 'Redeem' }))
      await userEvent.click(screen.getAllByRole('button', { name: 'Redeem' })[0])
      await userEvent.click(screen.getByRole('button', { name: 'Confirm Redemption' }))
      await waitFor(() =>
        expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
      )
    })

    it('handles redeem RPC returning null data', async () => {
      mockRpc.mockResolvedValue({ data: null })
      render(<RewardsPage />)
      await waitFor(() => screen.getAllByRole('button', { name: 'Redeem' }))
      await userEvent.click(screen.getAllByRole('button', { name: 'Redeem' })[0])
      await userEvent.click(screen.getByRole('button', { name: 'Confirm Redemption' }))
      await waitFor(() =>
        expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
      )
    })
  })

  describe('approve/reject RPC with null data', () => {
    it('shows toast error when approve RPC returns null', async () => {
      const { toast } = jest.requireMock('sonner')
      mockRpc.mockResolvedValue({ data: null })
      mockGet.mockReturnValue('approvals')
      mockState.pendingApprovals = mockPendingApprovals
      render(<RewardsPage />)
      await waitFor(() => screen.getByRole('button', { name: 'Approve' }))
      await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
      await waitFor(() => expect(toast.error).toHaveBeenCalled())
    })

    it('shows toast error when reject RPC returns null', async () => {
      const { toast } = jest.requireMock('sonner')
      mockRpc.mockResolvedValue({ data: null })
      mockGet.mockReturnValue('approvals')
      mockState.pendingApprovals = mockPendingApprovals
      render(<RewardsPage />)
      await waitFor(() => screen.getByRole('button', { name: 'Reject' }))
      await userEvent.click(screen.getByRole('button', { name: 'Reject' }))
      const modal = screen.getByText('Reject Reward?').closest('div')!
      await userEvent.click(within(modal).getByRole('button', { name: /^Reject$/ }))
      await waitFor(() => expect(toast.error).toHaveBeenCalled())
    })
  })

  describe('Default reward seeding', () => {
    it('seeds default rewards when parent loads page with no rewards', async () => {
      mockState.rewards = []
      render(<RewardsPage />)
      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ title: '30 Min Screen Time', family_id: 'family-1', created_by: 'user-parent' }),
          ])
        )
      })
    })

    it('does not seed when rewards already exist', async () => {
      mockState.rewards = mockRewards
      render(<RewardsPage />)
      await waitFor(() => expect(screen.getByText('Movie Night')).toBeInTheDocument())
      expect(mockInsert).not.toHaveBeenCalled()
    })

    it('does not seed for child users', async () => {
      mockState.rewards = []
      mockState.user = mockChildUser
      mockState.profile = mockChildProfile
      mockGetUser.mockResolvedValue({ data: { user: mockChildUser } })
      render(<RewardsPage />)
      await waitFor(() => expect(screen.getByText('No rewards available yet.')).toBeInTheDocument())
      expect(mockInsert).not.toHaveBeenCalled()
    })
  })
})
