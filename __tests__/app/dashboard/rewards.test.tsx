import { render, screen, waitFor } from '@testing-library/react'
import RewardsPage from '@/app/(dashboard)/rewards/page'

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string; src: string }) => <img alt={props.alt} src={props.src} />,
}))

// Mock data
const mockUser = { id: 'user-1', email: 'test@example.com' }
const mockProfile = {
  id: 'user-1',
  family_id: 'family-1',
  display_name: 'Test User',
  avatar_url: null,
  nickname: null,
  role: 'parent',
  points: 150,
  created_at: '2024-01-01T00:00:00Z',
}

const mockMembers = [
  { ...mockProfile, points: 150 },
  {
    id: 'child-1',
    family_id: 'family-1',
    display_name: 'Timmy',
    avatar_url: null,
    nickname: 'Little T',
    role: 'child',
    points: 100,
    created_at: '2024-01-01T00:00:00Z',
  },
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

// Supabase mock
const mockGetUser = jest.fn()
const mockProfileData = { current: mockProfile as unknown }
const mockMembersData = { current: mockMembers as unknown[] }

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: mockProfileData.current }),
          order: () => Promise.resolve({ data: mockMembersData.current }),
        }),
      }),
    }),
  }),
}))

describe('RewardsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: mockUser } })
    mockProfileData.current = mockProfile
    mockMembersData.current = mockMembers
  })

  it('shows loading state initially', () => {
    mockGetUser.mockReturnValue(new Promise(() => {}))
    render(<RewardsPage />)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('renders page header', async () => {
    render(<RewardsPage />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Rewards' })).toBeInTheDocument()
      expect(screen.getByText('Family leaderboard')).toBeInTheDocument()
    })
  })

  it('renders podium with top 3 members', async () => {
    render(<RewardsPage />)
    await waitFor(() => {
      expect(screen.getByText('150 pts')).toBeInTheDocument()
      expect(screen.getByText('100 pts')).toBeInTheDocument()
      expect(screen.getByText('75 pts')).toBeInTheDocument()
    })
  })

  it('renders member names on podium', async () => {
    render(<RewardsPage />)
    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument()   // First name of "Test User"
      expect(screen.getByText('Little T')).toBeInTheDocument()
      expect(screen.getByText('Sally')).toBeInTheDocument()
    })
  })

  it('renders Available Rewards section', async () => {
    render(<RewardsPage />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Available Rewards' })).toBeInTheDocument()
      expect(screen.getByText('Coming Soon!')).toBeInTheDocument()
    })
  })

  it('shows no-family state when user has no family', async () => {
    mockProfileData.current = { ...mockProfile, family_id: null }

    render(<RewardsPage />)
    await waitFor(() => {
      expect(screen.getByText('No Family Yet')).toBeInTheDocument()
      expect(screen.getByText(/join a family to see the leaderboard/i)).toBeInTheDocument()
    })
  })

  it('shows Set Up Family link in no-family state', async () => {
    mockProfileData.current = { ...mockProfile, family_id: null }

    render(<RewardsPage />)
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Set Up Family' })).toBeInTheDocument()
    })
  })

  describe('fetchData edge cases', () => {
    it('stops loading when user is not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })
      render(<RewardsPage />)
      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
      })
    })

    it('stops loading when profile is not found', async () => {
      mockProfileData.current = null
      render(<RewardsPage />)
      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
      })
    })
  })

  it('renders 4th+ members in a list below podium', async () => {
    const fourMembers = [
      ...mockMembers,
      {
        id: 'child-3',
        family_id: 'family-1',
        display_name: 'Bob',
        avatar_url: null,
        nickname: null,
        role: 'child',
        points: 25,
        created_at: '2024-01-01T00:00:00Z',
      },
    ]
    mockMembersData.current = fourMembers

    render(<RewardsPage />)
    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument()
      expect(screen.getByText('25 pts')).toBeInTheDocument()
      // 4th place indicator
      expect(screen.getByText('4')).toBeInTheDocument()
    })
  })

  describe('podium with fewer than 3 members', () => {
    it('renders podium with only 1 member (no 2nd/3rd place)', async () => {
      mockMembersData.current = [
        { ...mockProfile, points: 150 },
      ]

      render(<RewardsPage />)
      await waitFor(() => {
        expect(screen.getByText('150 pts')).toBeInTheDocument()
      })
      // Only 1st place should render, no 2nd or 3rd
      expect(screen.queryByText('100 pts')).not.toBeInTheDocument()
      expect(screen.queryByText('75 pts')).not.toBeInTheDocument()
    })

    it('renders podium with only 2 members (no 3rd place)', async () => {
      mockMembersData.current = [
        { ...mockProfile, points: 150 },
        {
          id: 'child-1',
          family_id: 'family-1',
          display_name: 'Timmy',
          avatar_url: null,
          nickname: 'Little T',
          role: 'child',
          points: 100,
          created_at: '2024-01-01T00:00:00Z',
        },
      ]

      render(<RewardsPage />)
      await waitFor(() => {
        expect(screen.getByText('150 pts')).toBeInTheDocument()
        expect(screen.getByText('100 pts')).toBeInTheDocument()
      })
      // No 3rd place
      expect(screen.queryByText('75 pts')).not.toBeInTheDocument()
    })

    it('renders 2nd place member with null nickname (line 98/102 || falsy branch)', async () => {
      mockMembersData.current = [
        { ...mockProfile, points: 150 },
        {
          id: 'child-1',
          family_id: 'family-1',
          display_name: 'Timmy Jones',
          avatar_url: null,
          nickname: null,
          role: 'child',
          points: 100,
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'child-2',
          family_id: 'family-1',
          display_name: 'Sally Smith',
          avatar_url: null,
          nickname: null,
          role: 'child',
          points: 75,
          created_at: '2024-01-01T00:00:00Z',
        },
      ]

      render(<RewardsPage />)
      await waitFor(() => {
        // 2nd place should show first name from display_name since nickname is null
        expect(screen.getByText('Timmy')).toBeInTheDocument()
        // 3rd place similarly
        expect(screen.getByText('Sally')).toBeInTheDocument()
      })
    })
  })

  describe('membersData null branch', () => {
    it('handles null membersData (line 42 falsy branch)', async () => {
      mockMembersData.current = null as unknown as unknown[]

      render(<RewardsPage />)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Rewards' })).toBeInTheDocument()
      })
    })
  })
})
