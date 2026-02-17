import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FamilyPage from '@/app/(dashboard)/family/page'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/family',
}))

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string; src: string }) => <img alt={props.alt} src={props.src} />,
}))

// Mock data
const mockUser = { id: 'parent-1', email: 'test@example.com' }
const mockProfile = {
  id: 'parent-1',
  family_id: 'family-1',
  display_name: 'Jane Parent',
  avatar_url: null,
  nickname: null,
  role: 'parent',
  points: 100,
  created_at: '2024-01-01T00:00:00Z',
}

const mockFamily = {
  id: 'family-1',
  name: 'The Smiths',
  invite_code: 'ABCD1234',
  created_at: '2024-01-01T00:00:00Z',
}

const mockMembers = [
  mockProfile,
  {
    id: 'child-1',
    family_id: 'family-1',
    display_name: 'Timmy Smith',
    avatar_url: null,
    nickname: 'Little T',
    role: 'child',
    points: 50,
    created_at: '2024-01-01T00:00:00Z',
  },
]

// Supabase mock
const mockGetUser = jest.fn()
const mockProfileData = { current: mockProfile as unknown }
const mockFamilyData = { current: mockFamily as unknown }
const mockMembersData = { current: mockMembers as unknown[] }

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => ({
      select: () => {
        if (table === 'profiles') {
          return {
            eq: () => ({
              single: () => Promise.resolve({ data: mockProfileData.current }),
              order: () => ({
                order: () => Promise.resolve({ data: mockMembersData.current }),
              }),
            }),
          }
        }
        if (table === 'families') {
          return {
            eq: () => ({
              single: () => Promise.resolve({ data: mockFamilyData.current }),
            }),
          }
        }
        // family_invites (for SentInvites and PendingInvites)
        return {
          eq: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [] }),
            }),
          }),
        }
      },
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'new-family', name: 'New Family', invite_code: 'XYZ', created_at: '' }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
    rpc: () => Promise.resolve({ data: [] }),
  }),
}))

// Mock child components that do their own data fetching
jest.mock('@/components/family/pending-invites', () => ({
  PendingInvites: () => null,
}))

jest.mock('@/components/family/sent-invites', () => ({
  SentInvites: () => null,
}))

describe('FamilyPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: mockUser } })
    mockProfileData.current = mockProfile
    mockFamilyData.current = mockFamily
    mockMembersData.current = mockMembers
  })

  it('shows loading state initially', () => {
    mockGetUser.mockReturnValue(new Promise(() => {}))
    render(<FamilyPage />)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('renders family name as heading', async () => {
    render(<FamilyPage />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'The Smiths' })).toBeInTheDocument()
    })
  })

  it('renders member count', async () => {
    render(<FamilyPage />)
    await waitFor(() => {
      expect(screen.getByText('2 members')).toBeInTheDocument()
    })
  })

  it('renders Parents section', async () => {
    render(<FamilyPage />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Parents' })).toBeInTheDocument()
    })
  })

  it('renders Kids section', async () => {
    render(<FamilyPage />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Kids' })).toBeInTheDocument()
    })
  })

  it('renders member names', async () => {
    render(<FamilyPage />)
    await waitFor(() => {
      expect(screen.getByText('Jane Parent')).toBeInTheDocument()
      expect(screen.getByText('Little T')).toBeInTheDocument()
    })
  })

  it('renders Invite button for parent users', async () => {
    render(<FamilyPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Invite' })).toBeInTheDocument()
    })
  })

  it('renders member points', async () => {
    render(<FamilyPage />)
    await waitFor(() => {
      expect(screen.getByText('100 pts')).toBeInTheDocument()
      expect(screen.getByText('50 pts')).toBeInTheDocument()
    })
  })

  it('renders remove member buttons for other members', async () => {
    render(<FamilyPage />)
    await waitFor(() => {
      // Remove button should exist for the child but not for the current user
      const removeButtons = screen.getAllByTitle('Remove member')
      expect(removeButtons).toHaveLength(1)
    })
  })

  it('opens remove confirmation modal when remove button is clicked', async () => {
    const user = userEvent.setup()
    render(<FamilyPage />)

    await waitFor(() => {
      expect(screen.getByTitle('Remove member')).toBeInTheDocument()
    })

    await user.click(screen.getByTitle('Remove member'))

    expect(screen.getByRole('heading', { name: /remove family member/i })).toBeInTheDocument()
    expect(screen.getByText(/are you sure you want to remove/i)).toBeInTheDocument()
  })

  it('shows no-family create form when user has no family', async () => {
    mockProfileData.current = { ...mockProfile, family_id: null }
    mockFamilyData.current = null

    render(<FamilyPage />)
    await waitFor(() => {
      expect(screen.getByText('Create a family to get started!')).toBeInTheDocument()
    })

    expect(screen.getByLabelText('Family Name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Family' })).toBeInTheDocument()
  })

  it('shows join link when no family', async () => {
    mockProfileData.current = { ...mockProfile, family_id: null }
    mockFamilyData.current = null

    render(<FamilyPage />)
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /enter invite code/i })).toBeInTheDocument()
    })
  })
})
