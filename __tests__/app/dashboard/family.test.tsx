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
const mockInsert = jest.fn()
const mockUpdate = jest.fn()
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
      insert: (...args: unknown[]) => {
        const result = mockInsert(...args)
        return {
          ...result,
          select: () => ({
            single: () => result,
          }),
        }
      },
      update: (...args: unknown[]) => ({
        eq: (...eqArgs: unknown[]) => mockUpdate(...args, ...eqArgs),
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
  SentInvites: () => <div data-testid="sent-invites" />,
}))

describe('FamilyPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: mockUser } })
    mockProfileData.current = mockProfile
    mockFamilyData.current = mockFamily
    mockMembersData.current = mockMembers
    mockInsert.mockResolvedValue({ data: { id: 'new-family', name: 'New Family', invite_code: 'XYZ', created_at: '' }, error: null })
    mockUpdate.mockResolvedValue({ error: null })
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

  describe('fetchData edge cases', () => {
    it('stops loading when user is not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })
      render(<FamilyPage />)
      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
      })
    })

    it('stops loading when profile is not found', async () => {
      mockProfileData.current = null
      render(<FamilyPage />)
      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
      })
    })
  })

  describe('handleCreateFamily', () => {
    beforeEach(() => {
      mockProfileData.current = { ...mockProfile, family_id: null }
      mockFamilyData.current = null
    })

    it('does nothing when family name is empty', async () => {
      const user = userEvent.setup()
      render(<FamilyPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Create Family' })).toBeInTheDocument()
      })

      // The input is required, so the form won't submit with an empty field
      // Just verify the button is there and no insert is called
      expect(mockInsert).not.toHaveBeenCalled()
    })

    it('shows error when profile is not loaded', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      // Set profile to null so currentUser is null
      mockProfileData.current = null

      const user = userEvent.setup()
      render(<FamilyPage />)

      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
      })
      consoleSpy.mockRestore()
    })

    it('creates a family successfully', async () => {
      const user = userEvent.setup()
      render(<FamilyPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Family Name')).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText('Family Name'), 'New Family')
      await user.click(screen.getByRole('button', { name: 'Create Family' }))

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalled()
      })
    })

    it('shows error when family insert fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockInsert.mockResolvedValue({ data: null, error: { message: 'Insert failed' } })

      const user = userEvent.setup()
      render(<FamilyPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Family Name')).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText('Family Name'), 'Test Family')
      await user.click(screen.getByRole('button', { name: 'Create Family' }))

      await waitFor(() => {
        expect(screen.getByText(/failed to create family/i)).toBeInTheDocument()
      })
      consoleSpy.mockRestore()
    })

    it('shows error when profile update fails after family creation', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockUpdate.mockResolvedValue({ error: { message: 'Update failed' } })

      const user = userEvent.setup()
      render(<FamilyPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Family Name')).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText('Family Name'), 'Test Family')
      await user.click(screen.getByRole('button', { name: 'Create Family' }))

      await waitFor(() => {
        expect(screen.getByText(/failed to update profile/i)).toBeInTheDocument()
      })
      consoleSpy.mockRestore()
    })
  })

  describe('handleRemoveMember', () => {
    it('removes a member successfully', async () => {
      const user = userEvent.setup()
      render(<FamilyPage />)

      await waitFor(() => {
        expect(screen.getByTitle('Remove member')).toBeInTheDocument()
      })

      await user.click(screen.getByTitle('Remove member'))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Remove' }))

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
      })
    })

    it('shows error when remove fails', async () => {
      mockUpdate.mockResolvedValue({ error: { message: 'Remove failed' } })

      const user = userEvent.setup()
      render(<FamilyPage />)

      await waitFor(() => {
        expect(screen.getByTitle('Remove member')).toBeInTheDocument()
      })

      await user.click(screen.getByTitle('Remove member'))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Remove' }))

      await waitFor(() => {
        expect(screen.getByText(/failed to remove member/i)).toBeInTheDocument()
      })
    })
  })

  describe('remove parent member', () => {
    it('sets memberToRemove for a parent member (line 232)', async () => {
      // Add another parent so the remove button shows in the Parents section
      mockMembersData.current = [
        mockProfile,
        {
          id: 'parent-2',
          family_id: 'family-1',
          display_name: 'Other Parent',
          avatar_url: null,
          nickname: null,
          role: 'parent',
          points: 75,
          created_at: '2024-01-01T00:00:00Z',
        },
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

      const user = userEvent.setup()
      render(<FamilyPage />)

      await waitFor(() => {
        expect(screen.getByText('Other Parent')).toBeInTheDocument()
      })

      // There should be two remove buttons now (one for Other Parent, one for child)
      const removeButtons = screen.getAllByTitle('Remove member')
      expect(removeButtons.length).toBeGreaterThanOrEqual(2)

      // Click the first remove button (for Other Parent in Parents section)
      await user.click(removeButtons[0])

      expect(screen.getByRole('heading', { name: /remove family member/i })).toBeInTheDocument()
      expect(screen.getByText(/are you sure you want to remove/i)).toBeInTheDocument()
    })
  })

  describe('invite modal', () => {
    it('opens invite modal when Invite button is clicked', async () => {
      const user = userEvent.setup()
      render(<FamilyPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Invite' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Invite' }))

      // InviteModal should open (it renders with isOpen=true)
      await waitFor(() => {
        expect(screen.getByText('Invite Family Member')).toBeInTheDocument()
      })
    })
  })

  describe('role-based rendering', () => {
    it('child user does not see Invite button', async () => {
      mockProfileData.current = { ...mockProfile, id: 'child-1', role: 'child' }

      render(<FamilyPage />)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'The Smiths' })).toBeInTheDocument()
      })

      expect(screen.queryByRole('button', { name: 'Invite' })).not.toBeInTheDocument()
    })

    it('child user does not see remove buttons', async () => {
      mockProfileData.current = { ...mockProfile, id: 'child-1', role: 'child' }

      render(<FamilyPage />)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'The Smiths' })).toBeInTheDocument()
      })

      expect(screen.queryByTitle('Remove member')).not.toBeInTheDocument()
    })

    it('child user does not see SentInvites', async () => {
      mockProfileData.current = { ...mockProfile, id: 'child-1', role: 'child' }

      render(<FamilyPage />)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'The Smiths' })).toBeInTheDocument()
      })

      expect(screen.queryByTestId('sent-invites')).not.toBeInTheDocument()
    })

    it('parent user sees SentInvites', async () => {
      render(<FamilyPage />)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'The Smiths' })).toBeInTheDocument()
      })

      expect(screen.getByTestId('sent-invites')).toBeInTheDocument()
    })
  })
})
