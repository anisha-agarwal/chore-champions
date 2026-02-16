import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InviteModal } from '@/components/family/invite-modal'

// Mock Supabase client
const mockRpc = jest.fn()
const mockInsert = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: mockRpc,
    from: () => ({
      insert: mockInsert,
    }),
  }),
}))

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  inviteCode: 'ABC123',
  familyId: 'family-1',
  currentUserId: 'user-1',
}

describe('InviteModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders both tabs', () => {
    render(<InviteModal {...defaultProps} />)

    expect(screen.getByText('Share Code')).toBeInTheDocument()
    expect(screen.getByText('Invite by Email')).toBeInTheDocument()
  })

  it('shows Share Code tab by default', () => {
    render(<InviteModal {...defaultProps} />)

    expect(screen.getByText('Invite Code')).toBeInTheDocument()
    expect(screen.getByText('ABC123')).toBeInTheDocument()
  })

  it('switches to email tab when clicked', async () => {
    render(<InviteModal {...defaultProps} />)

    await userEvent.click(screen.getByText('Invite by Email'))

    expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send Invite' })).toBeInTheDocument()
  })

  it('shows error when user not found', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    render(<InviteModal {...defaultProps} />)

    await userEvent.click(screen.getByText('Invite by Email'))
    await userEvent.type(screen.getByLabelText('Email Address'), 'nobody@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => {
      expect(screen.getByText('No account found with that email address.')).toBeInTheDocument()
    })
  })

  it('shows error when user already in a family', async () => {
    mockRpc.mockResolvedValue({
      data: [{ user_id: 'user-2', display_name: 'Other User', avatar_url: null, has_family: true }],
      error: null,
    })

    render(<InviteModal {...defaultProps} />)

    await userEvent.click(screen.getByText('Invite by Email'))
    await userEvent.type(screen.getByLabelText('Email Address'), 'taken@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => {
      expect(screen.getByText('This user is already in a family.')).toBeInTheDocument()
    })
  })

  it('shows error when invite already pending', async () => {
    mockRpc.mockResolvedValue({
      data: [{ user_id: 'user-2', display_name: 'Other User', avatar_url: null, has_family: false }],
      error: null,
    })
    mockInsert.mockResolvedValue({ error: { code: '23505', message: 'duplicate' } })

    render(<InviteModal {...defaultProps} />)

    await userEvent.click(screen.getByText('Invite by Email'))
    await userEvent.type(screen.getByLabelText('Email Address'), 'duplicate@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => {
      expect(screen.getByText('An invite is already pending for this user.')).toBeInTheDocument()
    })
  })

  it('prevents self-invite', async () => {
    mockRpc.mockResolvedValue({
      data: [{ user_id: 'user-1', display_name: 'Me', avatar_url: null, has_family: false }],
      error: null,
    })

    render(<InviteModal {...defaultProps} />)

    await userEvent.click(screen.getByText('Invite by Email'))
    await userEvent.type(screen.getByLabelText('Email Address'), 'me@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => {
      expect(screen.getByText('You cannot invite yourself.')).toBeInTheDocument()
    })
  })

  it('shows success message on successful invite', async () => {
    mockRpc.mockResolvedValue({
      data: [{ user_id: 'user-2', display_name: 'Jane', avatar_url: null, has_family: false }],
      error: null,
    })
    mockInsert.mockResolvedValue({ error: null })

    render(<InviteModal {...defaultProps} />)

    await userEvent.click(screen.getByText('Invite by Email'))
    await userEvent.type(screen.getByLabelText('Email Address'), 'jane@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => {
      expect(screen.getByText('Invite sent to Jane!')).toBeInTheDocument()
    })
  })

  it('disables button during submission', async () => {
    // Make RPC hang to test loading state
    mockRpc.mockReturnValue(new Promise(() => {}))

    render(<InviteModal {...defaultProps} />)

    await userEvent.click(screen.getByText('Invite by Email'))
    await userEvent.type(screen.getByLabelText('Email Address'), 'test@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => {
      expect(screen.getByText('Sending...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled()
    })
  })
})
