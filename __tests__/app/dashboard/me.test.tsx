import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MePage from '@/app/(dashboard)/me/page'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: jest.fn(),
  }),
}))

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string }) => <img alt={props.alt} />,
}))

// Mock Supabase client
const mockGetUser = jest.fn()
const mockSignOut = jest.fn()
const mockUpdateUser = jest.fn().mockResolvedValue({ error: null })
const mockSupabaseData = {
  profile: null as unknown,
  parentCount: 2,
}

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      get getUser() {
        return mockGetUser
      },
      get signOut() {
        return mockSignOut
      },
      get updateUser() {
        return mockUpdateUser
      },
    },
    from: () => ({
      select: (query: string, options?: { count?: string; head?: boolean }) => {
        if (options?.count === 'exact') {
          // Parent count query
          return {
            eq: () => ({
              eq: () => Promise.resolve({ count: mockSupabaseData.parentCount }),
            }),
          }
        }
        // Profile query
        return {
          eq: () => ({
            single: () => Promise.resolve({ data: mockSupabaseData.profile }),
          }),
        }
      },
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  }),
}))

describe('Me Page', () => {
  const mockProfile = {
    id: 'user-123',
    family_id: 'family-123',
    display_name: 'Test User',
    nickname: null,
    avatar_url: '/avatars/panther.svg',
    role: 'child' as const,
    points: 100,
    created_at: '2024-01-01',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
    })
    mockSupabaseData.profile = mockProfile
    mockSupabaseData.parentCount = 2
  })

  it('shows loading state initially', () => {
    mockGetUser.mockReturnValue(new Promise(() => {}))

    render(<MePage />)

    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('renders page header with My Profile title', async () => {
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })
  })

  it('renders profile with role selector', async () => {
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    expect(screen.getByText('Role')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Parent' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kid' })).toBeInTheDocument()
  })

  it('displays current role as selected', async () => {
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    const kidButton = screen.getByRole('button', { name: 'Kid' })
    expect(kidButton).toHaveClass('bg-purple-600')
  })

  it('shows warning and disables role selector for last parent', async () => {
    mockSupabaseData.profile = { ...mockProfile, role: 'parent' }
    mockSupabaseData.parentCount = 1

    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    expect(screen.getByText(/only parent/i)).toBeInTheDocument()

    const parentButton = screen.getByRole('button', { name: 'Parent' })
    const kidButton = screen.getByRole('button', { name: 'Kid' })
    expect(parentButton).toBeDisabled()
    expect(kidButton).toBeDisabled()
  })

  it('allows role change when not last parent', async () => {
    mockSupabaseData.profile = { ...mockProfile, role: 'parent' }
    mockSupabaseData.parentCount = 2

    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    expect(screen.queryByText(/only parent/i)).not.toBeInTheDocument()

    const kidButton = screen.getByRole('button', { name: 'Kid' })
    expect(kidButton).not.toBeDisabled()
  })

  it('role selector buttons are clickable', async () => {
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    const kidButton = screen.getByRole('button', { name: 'Kid' })
    const parentButton = screen.getByRole('button', { name: 'Parent' })

    // Buttons should be in the document
    expect(kidButton).toBeInTheDocument()
    expect(parentButton).toBeInTheDocument()

    // Both buttons should be enabled (not disabled)
    expect(kidButton).not.toBeDisabled()
    expect(parentButton).not.toBeDisabled()
  })

  it('renders section headers', async () => {
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    // Section headers have uppercase CSS class but DOM text is title case
    expect(screen.getByText('Personal Info')).toBeInTheDocument()
    expect(screen.getByText('Role')).toBeInTheDocument()
  })

  it('opens avatar modal when avatar is clicked', async () => {
    const user = userEvent.setup()
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    // Find avatar button by aria-label
    const avatarButton = screen.getByRole('button', { name: 'Change avatar' })
    await user.click(avatarButton)

    expect(screen.getByText('Choose Avatar')).toBeInTheDocument()
  })

  it('renders form with Display Name and Nickname inputs', async () => {
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    expect(screen.getByText('Display Name')).toBeInTheDocument()
    expect(screen.getByText('Nickname')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
  })

  it('renders Save Changes button', async () => {
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
  })

  it('renders Sign Out button', async () => {
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument()
  })

  it('displays email address as read-only', async () => {
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    expect(screen.getByText('Email')).toBeInTheDocument()
    const emailInput = screen.getByDisplayValue('test@example.com')
    expect(emailInput).toHaveAttribute('readOnly')
  })

  it('renders Change Password button', async () => {
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument()
  })

  it('opens change password modal', async () => {
    const user = userEvent.setup()
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Change Password' }))

    expect(screen.getByText('New Password')).toBeInTheDocument()
    expect(screen.getByText('Confirm Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Update Password' })).toBeInTheDocument()
  })

  it('sign out button is in the header', async () => {
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    const header = screen.getByText('My Profile').closest('header')
    expect(header).toContainElement(screen.getByRole('button', { name: 'Sign Out' }))
  })

  it('displays "Tap to change avatar" caption under avatar', async () => {
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    expect(screen.getByText('Tap to change avatar')).toBeInTheDocument()
  })
})
