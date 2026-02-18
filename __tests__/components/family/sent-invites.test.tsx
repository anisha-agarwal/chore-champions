import { render, screen, waitFor } from '@testing-library/react'
import { SentInvites } from '@/components/family/sent-invites'

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string; src: string }) => <img alt={props.alt} src={props.src} />,
}))

// Mock Supabase client
const mockSelect = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: mockSelect,
    }),
  }),
}))

describe('SentInvites', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders nothing while loading', () => {
    // Keep the promise pending to simulate loading
    mockSelect.mockReturnValue({
      eq: () => ({
        eq: () => ({
          order: () => new Promise(() => {}),
        }),
      }),
    })

    const { container } = render(<SentInvites familyId="family-1" />)
    // Should return null during loading
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when no invites', async () => {
    mockSelect.mockReturnValue({
      eq: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    })

    const { container } = render(<SentInvites familyId="family-1" />)

    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })

  it('renders invite list when invites exist', async () => {
    const mockInvites = [
      {
        id: 'invite-1',
        family_id: 'family-1',
        invited_by: 'parent-1',
        invited_user_id: 'user-2',
        status: 'pending',
        created_at: '2024-01-01T00:00:00Z',
        responded_at: null,
        invited_user: {
          display_name: 'Jane Smith',
          avatar_url: null,
        },
      },
      {
        id: 'invite-2',
        family_id: 'family-1',
        invited_by: 'parent-1',
        invited_user_id: 'user-3',
        status: 'pending',
        created_at: '2024-01-02T00:00:00Z',
        responded_at: null,
        invited_user: {
          display_name: 'Bob Jones',
          avatar_url: '/avatars/fox.svg',
        },
      },
    ]

    mockSelect.mockReturnValue({
      eq: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: mockInvites, error: null }),
        }),
      }),
    })

    render(<SentInvites familyId="family-1" />)

    await waitFor(() => {
      expect(screen.getByText('Pending Invites Sent')).toBeInTheDocument()
    })

    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
    // Each invite should show "Pending" badge
    const pendingBadges = screen.getAllByText('Pending')
    expect(pendingBadges).toHaveLength(2)
  })

  it('handles null data from fetch (line 37 falsy branch)', async () => {
    mockSelect.mockReturnValue({
      eq: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    })

    const { container } = render(<SentInvites familyId="family-1" />)

    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })

  it('renders nothing on error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    mockSelect.mockReturnValue({
      eq: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: null, error: { message: 'Query error' } }),
        }),
      }),
    })

    const { container } = render(<SentInvites familyId="family-1" />)

    await waitFor(() => {
      // Ensure the async error path has executed before restoring the spy
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch sent invites:', { message: 'Query error' })
      // On error, invites stay empty so component returns null
      expect(container.firstChild).toBeNull()
    })
    consoleSpy.mockRestore()
  })
})
