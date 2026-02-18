import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PendingInvites } from '@/components/family/pending-invites'

// Mock Supabase client - use a stable singleton to avoid re-render issues
const mockRpc = jest.fn()
const mockSelect = jest.fn()
const mockUpdate = jest.fn()

const mockSupabase = {
  rpc: mockRpc,
  from: () => ({
    select: mockSelect,
    update: mockUpdate,
  }),
}

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}))

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => <img alt="" {...props} />,
}))

const mockOnAccepted = jest.fn()

const mockInvites = [
  {
    id: 'invite-1',
    family_id: 'family-1',
    invited_by: 'parent-1',
    invited_user_id: 'user-1',
    status: 'pending',
    created_at: '2026-02-15T00:00:00Z',
    responded_at: null,
    families: { name: 'The Smiths' },
    inviter: { display_name: 'John Smith', avatar_url: null },
  },
]

describe('PendingInvites', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function setupSelectMock(data: unknown[] | null) {
    // Chain: .select().eq().eq().order()
    const orderFn = jest.fn().mockResolvedValue({ data, error: null })
    const eqStatusFn = jest.fn().mockReturnValue({ order: orderFn })
    const eqUserFn = jest.fn().mockReturnValue({ eq: eqStatusFn })
    mockSelect.mockReturnValue({ eq: eqUserFn })
  }

  it('renders nothing when no pending invites', async () => {
    setupSelectMock([])

    const { container } = render(
      <PendingInvites userId="user-1" onAccepted={mockOnAccepted} />
    )

    await waitFor(() => {
      // After loading, should render nothing
      expect(container.querySelector('.animate-spin')).not.toBeInTheDocument()
    })

    expect(screen.queryByText('Pending Invites')).not.toBeInTheDocument()
  })

  it('renders invite cards with family name and inviter display name', async () => {
    setupSelectMock(mockInvites)

    render(
      <PendingInvites userId="user-1" onAccepted={mockOnAccepted} />
    )

    await waitFor(() => {
      expect(screen.getByText('The Smiths')).toBeInTheDocument()
    })

    expect(screen.getByText('Invited by John Smith')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument()
  })

  it('calls accept_family_invite RPC and triggers onAccepted', async () => {
    setupSelectMock(mockInvites)
    mockRpc.mockResolvedValue({ error: null })

    render(
      <PendingInvites userId="user-1" onAccepted={mockOnAccepted} />
    )

    await waitFor(() => {
      expect(screen.getByText('The Smiths')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: 'Accept' }))

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('accept_family_invite', { invite_id: 'invite-1' })
      expect(mockOnAccepted).toHaveBeenCalled()
    })
  })

  it('updates invite status to declined on decline', async () => {
    setupSelectMock(mockInvites)
    const eqFn = jest.fn().mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: eqFn })

    render(
      <PendingInvites userId="user-1" onAccepted={mockOnAccepted} />
    )

    await waitFor(() => {
      expect(screen.getByText('The Smiths')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: 'Decline' }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'declined' })
      )
    })

    // Invite should be removed from list
    await waitFor(() => {
      expect(screen.queryByText('The Smiths')).not.toBeInTheDocument()
    })
  })

  it('disables buttons during submission', async () => {
    setupSelectMock(mockInvites)
    // Make RPC hang
    mockRpc.mockReturnValue(new Promise(() => {}))

    render(
      <PendingInvites userId="user-1" onAccepted={mockOnAccepted} />
    )

    await waitFor(() => {
      expect(screen.getByText('The Smiths')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: 'Accept' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Decline' })).toBeDisabled()
    })
  })

  it('shows error when fetch fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    // Setup select mock to return error
    const orderFn = jest.fn().mockResolvedValue({ data: null, error: { message: 'Fetch failed' } })
    const eqStatusFn = jest.fn().mockReturnValue({ order: orderFn })
    const eqUserFn = jest.fn().mockReturnValue({ eq: eqStatusFn })
    mockSelect.mockReturnValue({ eq: eqUserFn })

    render(
      <PendingInvites userId="user-1" onAccepted={mockOnAccepted} />
    )

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch invites:', expect.objectContaining({ message: 'Fetch failed' }))
    })
    consoleSpy.mockRestore()
  })

  it('shows error when decline fails', async () => {
    setupSelectMock(mockInvites)
    const eqFn = jest.fn().mockResolvedValue({ error: { message: 'Decline failed' } })
    mockUpdate.mockReturnValue({ eq: eqFn })

    render(
      <PendingInvites userId="user-1" onAccepted={mockOnAccepted} />
    )

    await waitFor(() => {
      expect(screen.getByText('The Smiths')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: 'Decline' }))

    await waitFor(() => {
      expect(screen.getByText('Failed to decline invite. Please try again.')).toBeInTheDocument()
    })
  })

  it('handles null data from fetch (line 38 falsy branch)', async () => {
    // Setup select mock to return null data (not error, but data is null)
    const orderFn = jest.fn().mockResolvedValue({ data: null, error: null })
    const eqStatusFn = jest.fn().mockReturnValue({ order: orderFn })
    const eqUserFn = jest.fn().mockReturnValue({ eq: eqStatusFn })
    mockSelect.mockReturnValue({ eq: eqUserFn })

    const { container } = render(
      <PendingInvites userId="user-1" onAccepted={mockOnAccepted} />
    )

    await waitFor(() => {
      // After loading, should render nothing (empty invites)
      expect(container.querySelector('.animate-spin')).not.toBeInTheDocument()
    })

    expect(screen.queryByText('Pending Invites')).not.toBeInTheDocument()
  })

  it('shows error message on RPC failure', async () => {
    setupSelectMock(mockInvites)
    mockRpc.mockResolvedValue({ error: { message: 'Something went wrong' } })

    render(
      <PendingInvites userId="user-1" onAccepted={mockOnAccepted} />
    )

    await waitFor(() => {
      expect(screen.getByText('The Smiths')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: 'Accept' }))

    await waitFor(() => {
      expect(screen.getByText('Failed to accept invite. Please try again.')).toBeInTheDocument()
    })
  })
})
