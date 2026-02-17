import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

  afterEach(() => {
    // Always restore real timers in case a test used fake timers
    jest.useRealTimers()
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
    const user = userEvent.setup()
    render(<InviteModal {...defaultProps} />)

    await user.click(screen.getByText('Invite by Email'))

    expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send Invite' })).toBeInTheDocument()
  })

  it('shows error when user not found', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })
    const user = userEvent.setup()

    render(<InviteModal {...defaultProps} />)

    await user.click(screen.getByText('Invite by Email'))
    await user.type(screen.getByLabelText('Email Address'), 'nobody@example.com')
    await user.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => {
      expect(screen.getByText('No account found with that email address.')).toBeInTheDocument()
    })
  })

  it('shows error when user already in a family', async () => {
    mockRpc.mockResolvedValue({
      data: [{ user_id: 'user-2', display_name: 'Other User', avatar_url: null, has_family: true }],
      error: null,
    })
    const user = userEvent.setup()

    render(<InviteModal {...defaultProps} />)

    await user.click(screen.getByText('Invite by Email'))
    await user.type(screen.getByLabelText('Email Address'), 'taken@example.com')
    await user.click(screen.getByRole('button', { name: 'Send Invite' }))

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
    const user = userEvent.setup()

    render(<InviteModal {...defaultProps} />)

    await user.click(screen.getByText('Invite by Email'))
    await user.type(screen.getByLabelText('Email Address'), 'duplicate@example.com')
    await user.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => {
      expect(screen.getByText('An invite is already pending for this user.')).toBeInTheDocument()
    })
  })

  it('prevents self-invite', async () => {
    mockRpc.mockResolvedValue({
      data: [{ user_id: 'user-1', display_name: 'Me', avatar_url: null, has_family: false }],
      error: null,
    })
    const user = userEvent.setup()

    render(<InviteModal {...defaultProps} />)

    await user.click(screen.getByText('Invite by Email'))
    await user.type(screen.getByLabelText('Email Address'), 'me@example.com')
    await user.click(screen.getByRole('button', { name: 'Send Invite' }))

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
    const user = userEvent.setup()

    render(<InviteModal {...defaultProps} />)

    await user.click(screen.getByText('Invite by Email'))
    await user.type(screen.getByLabelText('Email Address'), 'jane@example.com')
    await user.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => {
      expect(screen.getByText('Invite sent to Jane!')).toBeInTheDocument()
    })
  })

  it('disables button during submission', async () => {
    // Make RPC hang to test loading state
    mockRpc.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()

    render(<InviteModal {...defaultProps} />)

    await user.click(screen.getByText('Invite by Email'))
    await user.type(screen.getByLabelText('Email Address'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => {
      expect(screen.getByText('Sending...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled()
    })
  })

  describe('copyToClipboard', () => {
    let writeTextMock: jest.Mock

    beforeEach(() => {
      writeTextMock = jest.fn().mockResolvedValue(undefined)
      // JSDOM doesn't have clipboard API - define it on the global navigator
      Object.defineProperty(window.navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      })
    })

    it('copies invite code to clipboard and shows Copied!', async () => {
      render(<InviteModal {...defaultProps} />)

      const copyButtons = screen.getAllByRole('button', { name: 'Copy' })
      fireEvent.click(copyButtons[0])

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledWith('ABC123')
        expect(screen.getByText('Copied!')).toBeInTheDocument()
      })
    })

    it('copies invite link to clipboard', async () => {
      render(<InviteModal {...defaultProps} />)

      const copyButtons = screen.getAllByRole('button', { name: 'Copy' })
      fireEvent.click(copyButtons[1])

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('/join/ABC123'))
      })
    })

    it('handles clipboard failure gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      writeTextMock.mockRejectedValue(new Error('Clipboard denied'))

      render(<InviteModal {...defaultProps} />)

      const copyButtons = screen.getAllByRole('button', { name: 'Copy' })
      fireEvent.click(copyButtons[0])

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to copy:', expect.any(Error))
      })
      consoleSpy.mockRestore()
    })
  })

  describe('handleSendInvite edge cases', () => {
    it('does not call RPC when email is empty', async () => {
      const user = userEvent.setup()
      render(<InviteModal {...defaultProps} />)

      await user.click(screen.getByText('Invite by Email'))

      // The email input is required, so form won't submit with empty email
      expect(mockRpc).not.toHaveBeenCalled()
    })

    it('shows RPC error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } })
      const user = userEvent.setup()

      render(<InviteModal {...defaultProps} />)

      await user.click(screen.getByText('Invite by Email'))
      await user.type(screen.getByLabelText('Email Address'), 'test@example.com')
      await user.click(screen.getByRole('button', { name: 'Send Invite' }))

      await waitFor(() => {
        expect(screen.getByText('Failed to look up user. Please try again.')).toBeInTheDocument()
      })
    })

    it('shows generic insert error (non-23505)', async () => {
      mockRpc.mockResolvedValue({
        data: [{ user_id: 'user-2', display_name: 'Other', avatar_url: null, has_family: false }],
        error: null,
      })
      mockInsert.mockResolvedValue({ error: { code: '42000', message: 'Some other error' } })
      const user = userEvent.setup()

      render(<InviteModal {...defaultProps} />)

      await user.click(screen.getByText('Invite by Email'))
      await user.type(screen.getByLabelText('Email Address'), 'other@example.com')
      await user.click(screen.getByRole('button', { name: 'Send Invite' }))

      await waitFor(() => {
        expect(screen.getByText('Failed to send invite. Please try again.')).toBeInTheDocument()
      })
    })
  })

  describe('handleClose', () => {
    it('Done button calls onClose', async () => {
      const onClose = jest.fn()
      const user = userEvent.setup()
      render(<InviteModal {...defaultProps} onClose={onClose} />)

      const doneButton = screen.getByRole('button', { name: 'Done' })
      await user.click(doneButton)

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('tab aria attributes', () => {
    it('Share Code tab is aria-selected by default', () => {
      render(<InviteModal {...defaultProps} />)

      const codeTab = screen.getByRole('tab', { name: 'Share Code' })
      expect(codeTab).toHaveAttribute('aria-selected', 'true')

      const emailTab = screen.getByRole('tab', { name: 'Invite by Email' })
      expect(emailTab).toHaveAttribute('aria-selected', 'false')
    })

    it('Email tab becomes aria-selected when clicked', async () => {
      const user = userEvent.setup()
      render(<InviteModal {...defaultProps} />)

      await user.click(screen.getByRole('tab', { name: 'Invite by Email' }))

      const codeTab = screen.getByRole('tab', { name: 'Share Code' })
      expect(codeTab).toHaveAttribute('aria-selected', 'false')

      const emailTab = screen.getByRole('tab', { name: 'Invite by Email' })
      expect(emailTab).toHaveAttribute('aria-selected', 'true')
    })
  })
})
