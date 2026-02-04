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
      data: { user: { id: 'user-123' } },
    })
    mockSupabaseData.profile = mockProfile
    mockSupabaseData.parentCount = 2
  })

  it('shows loading state initially', () => {
    mockGetUser.mockReturnValue(new Promise(() => {}))

    render(<MePage />)

    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('renders profile with role selector', async () => {
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })

    expect(screen.getByText('Role')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Parent' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kid' })).toBeInTheDocument()
  })

  it('displays current role as selected', async () => {
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })

    const kidButton = screen.getByRole('button', { name: 'Kid' })
    expect(kidButton).toHaveClass('bg-purple-600')
  })

  it('shows warning and disables role selector for last parent', async () => {
    mockSupabaseData.profile = { ...mockProfile, role: 'parent' }
    mockSupabaseData.parentCount = 1

    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
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
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })

    expect(screen.queryByText(/only parent/i)).not.toBeInTheDocument()

    const kidButton = screen.getByRole('button', { name: 'Kid' })
    expect(kidButton).not.toBeDisabled()
  })

  it('role selector buttons are clickable', async () => {
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
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

  it('displays points in header', async () => {
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })

    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('points')).toBeInTheDocument()
  })

  it('displays role badge in header', async () => {
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })

    // Role badge has specific styling class
    const badge = document.querySelector('.bg-gray-100.rounded-full')
    expect(badge).toHaveTextContent('Kid')
  })

  it('displays Parent badge for parent role', async () => {
    mockSupabaseData.profile = { ...mockProfile, role: 'parent' }

    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })

    // Role badge has specific styling class
    const badge = document.querySelector('.bg-gray-100.rounded-full')
    expect(badge).toHaveTextContent('Parent')
  })

  it('opens avatar modal when avatar is clicked', async () => {
    const user = userEvent.setup()
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })

    // Find avatar button by the "Change" text inside it
    const changeText = screen.getByText('Change')
    const avatarButton = changeText.closest('button')!
    await user.click(avatarButton)

    expect(screen.getByText('Choose Avatar')).toBeInTheDocument()
  })

  it('renders form with Display Name and Nickname inputs', async () => {
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })

    expect(screen.getByText('Display Name')).toBeInTheDocument()
    expect(screen.getByText('Nickname')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
  })

  it('renders centered Save Changes button', async () => {
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })

    const saveButton = screen.getByRole('button', { name: 'Save Changes' })
    expect(saveButton).toBeInTheDocument()
  })

  it('renders Sign Out button', async () => {
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument()
  })

  it('displays nickname when available', async () => {
    mockSupabaseData.profile = { ...mockProfile, nickname: 'Cool Kid' }

    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('Cool Kid')).toBeInTheDocument()
    })
  })
})
