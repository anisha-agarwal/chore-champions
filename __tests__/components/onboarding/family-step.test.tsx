import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FamilyStep } from '@/components/onboarding/family-step'

// Mock Supabase client
const mockRpc = jest.fn()
const mockGetUser = jest.fn()
const mockUpdate = jest.fn()
const mockInsert = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    rpc: (...args: unknown[]) => ({
      single: () => mockRpc(...args),
    }),
    from: () => ({
      update: (...args: unknown[]) => ({
        eq: (...eqArgs: unknown[]) => mockUpdate(...args, ...eqArgs),
      }),
      insert: (...args: unknown[]) => ({
        select: () => ({
          single: () => mockInsert(...args),
        }),
      }),
    }),
  }),
}))

describe('FamilyStep', () => {
  const mockOnComplete = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockUpdate.mockResolvedValue({ error: null })
  })

  describe('Choose mode', () => {
    it('renders choose mode by default with join and create buttons', () => {
      render(<FamilyStep onComplete={mockOnComplete} />)

      expect(screen.getByText('Join or Create a Family')).toBeInTheDocument()
      expect(screen.getByText('Join existing family')).toBeInTheDocument()
      expect(screen.getByText('Create new family')).toBeInTheDocument()
    })

    it('shows description text', () => {
      render(<FamilyStep onComplete={mockOnComplete} />)

      expect(screen.getByText(/every champion needs a team/i)).toBeInTheDocument()
    })

    it('shows subtitle text for join option', () => {
      render(<FamilyStep onComplete={mockOnComplete} />)

      expect(screen.getByText('I have an invite code')).toBeInTheDocument()
    })

    it('shows subtitle text for create option', () => {
      render(<FamilyStep onComplete={mockOnComplete} />)

      expect(screen.getByText('Start fresh and invite others later')).toBeInTheDocument()
    })
  })

  describe('Join mode', () => {
    it('shows invite code input when clicking Join', async () => {
      render(<FamilyStep onComplete={mockOnComplete} />)

      await userEvent.click(screen.getByText('Join existing family'))

      expect(screen.getByText('Join a Family')).toBeInTheDocument()
      expect(screen.getByLabelText('Invite Code')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /join family/i })).toBeInTheDocument()
    })

    it('shows back button in join mode', async () => {
      render(<FamilyStep onComplete={mockOnComplete} />)

      await userEvent.click(screen.getByText('Join existing family'))

      expect(screen.getByText('Back')).toBeInTheDocument()
    })

    it('returns to choose mode when Back is clicked', async () => {
      render(<FamilyStep onComplete={mockOnComplete} />)

      await userEvent.click(screen.getByText('Join existing family'))
      expect(screen.getByText('Join a Family')).toBeInTheDocument()

      await userEvent.click(screen.getByText('Back'))
      expect(screen.getByText('Join or Create a Family')).toBeInTheDocument()
    })

    it('calls onComplete with familyId on successful join', async () => {
      mockRpc.mockResolvedValue({ data: { id: 'family-1', name: 'The Smiths' }, error: null })

      render(<FamilyStep onComplete={mockOnComplete} />)

      await userEvent.click(screen.getByText('Join existing family'))
      await userEvent.type(screen.getByLabelText('Invite Code'), 'ABC123')
      await userEvent.click(screen.getByRole('button', { name: /join family/i }))

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith('family-1')
      })
    })

    it('shows error on invalid invite code', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'Not found' } })

      render(<FamilyStep onComplete={mockOnComplete} />)

      await userEvent.click(screen.getByText('Join existing family'))
      await userEvent.type(screen.getByLabelText('Invite Code'), 'BADCODE')
      await userEvent.click(screen.getByRole('button', { name: /join family/i }))

      await waitFor(() => {
        expect(screen.getByText(/invalid or expired invite code/i)).toBeInTheDocument()
      })
      expect(mockOnComplete).not.toHaveBeenCalled()
    })

    it('shows error when user is not logged in during join', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })
      mockRpc.mockResolvedValue({ data: { id: 'family-1', name: 'Test' }, error: null })

      render(<FamilyStep onComplete={mockOnComplete} />)

      await userEvent.click(screen.getByText('Join existing family'))
      await userEvent.type(screen.getByLabelText('Invite Code'), 'ABC123')
      await userEvent.click(screen.getByRole('button', { name: /join family/i }))

      await waitFor(() => {
        expect(screen.getByText(/you must be logged in to join/i)).toBeInTheDocument()
      })
    })

    it('shows error when profile update fails during join', async () => {
      mockRpc.mockResolvedValue({ data: { id: 'family-1', name: 'Test' }, error: null })
      mockUpdate.mockResolvedValue({ error: { message: 'Update failed' } })

      render(<FamilyStep onComplete={mockOnComplete} />)

      await userEvent.click(screen.getByText('Join existing family'))
      await userEvent.type(screen.getByLabelText('Invite Code'), 'ABC123')
      await userEvent.click(screen.getByRole('button', { name: /join family/i }))

      await waitFor(() => {
        expect(screen.getByText(/failed to join family/i)).toBeInTheDocument()
      })
    })

    it('trims whitespace from invite code', async () => {
      mockRpc.mockResolvedValue({ data: { id: 'family-1', name: 'Test' }, error: null })

      render(<FamilyStep onComplete={mockOnComplete} />)

      await userEvent.click(screen.getByText('Join existing family'))
      await userEvent.type(screen.getByLabelText('Invite Code'), '  ABC123  ')
      await userEvent.click(screen.getByRole('button', { name: /join family/i }))

      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith('get_family_by_invite_code', { code: 'ABC123' })
      })
    })
  })

  describe('Create mode', () => {
    it('shows family name input when clicking Create', async () => {
      render(<FamilyStep onComplete={mockOnComplete} />)

      await userEvent.click(screen.getByText('Create new family'))

      expect(screen.getByText('Create a Family')).toBeInTheDocument()
      expect(screen.getByLabelText('Family Name')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create family/i })).toBeInTheDocument()
    })

    it('shows back button in create mode', async () => {
      render(<FamilyStep onComplete={mockOnComplete} />)

      await userEvent.click(screen.getByText('Create new family'))

      expect(screen.getByText('Back')).toBeInTheDocument()
    })

    it('returns to choose mode when Back is clicked from create', async () => {
      render(<FamilyStep onComplete={mockOnComplete} />)

      await userEvent.click(screen.getByText('Create new family'))
      expect(screen.getByText('Create a Family')).toBeInTheDocument()

      await userEvent.click(screen.getByText('Back'))
      expect(screen.getByText('Join or Create a Family')).toBeInTheDocument()
    })

    it('calls onComplete with familyId on successful creation', async () => {
      mockInsert.mockResolvedValue({ data: { id: 'new-family-1' }, error: null })

      render(<FamilyStep onComplete={mockOnComplete} />)

      await userEvent.click(screen.getByText('Create new family'))
      await userEvent.type(screen.getByLabelText('Family Name'), 'The Champions')
      await userEvent.click(screen.getByRole('button', { name: /create family/i }))

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith('new-family-1')
      })
    })

    it('shows error on failed family creation', async () => {
      mockInsert.mockResolvedValue({ data: null, error: { message: 'Insert failed' } })

      render(<FamilyStep onComplete={mockOnComplete} />)

      await userEvent.click(screen.getByText('Create new family'))
      await userEvent.type(screen.getByLabelText('Family Name'), 'Test Family')
      await userEvent.click(screen.getByRole('button', { name: /create family/i }))

      await waitFor(() => {
        expect(screen.getByText(/failed to create family/i)).toBeInTheDocument()
      })
      expect(mockOnComplete).not.toHaveBeenCalled()
    })

    it('shows error when user is not logged in during create', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      render(<FamilyStep onComplete={mockOnComplete} />)

      await userEvent.click(screen.getByText('Create new family'))
      await userEvent.type(screen.getByLabelText('Family Name'), 'Test Family')
      await userEvent.click(screen.getByRole('button', { name: /create family/i }))

      await waitFor(() => {
        expect(screen.getByText(/you must be logged in to create/i)).toBeInTheDocument()
      })
    })

    it('shows error when profile update fails after family creation', async () => {
      mockInsert.mockResolvedValue({ data: { id: 'new-family-1' }, error: null })
      mockUpdate.mockResolvedValue({ error: { message: 'Update failed' } })

      render(<FamilyStep onComplete={mockOnComplete} />)

      await userEvent.click(screen.getByText('Create new family'))
      await userEvent.type(screen.getByLabelText('Family Name'), 'Test Family')
      await userEvent.click(screen.getByRole('button', { name: /create family/i }))

      await waitFor(() => {
        expect(screen.getByText(/family created but failed to link/i)).toBeInTheDocument()
      })
    })

    it('trims whitespace from family name', async () => {
      mockInsert.mockResolvedValue({ data: { id: 'new-family-1' }, error: null })

      render(<FamilyStep onComplete={mockOnComplete} />)

      await userEvent.click(screen.getByText('Create new family'))
      await userEvent.type(screen.getByLabelText('Family Name'), '  The Smiths  ')
      await userEvent.click(screen.getByRole('button', { name: /create family/i }))

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith({ name: 'The Smiths' })
      })
    })
  })

  describe('Empty input guards', () => {
    it('does not submit join when invite code is only whitespace', async () => {
      render(<FamilyStep onComplete={mockOnComplete} />)

      await userEvent.click(screen.getByText('Join existing family'))

      // Type only spaces
      const input = screen.getByLabelText('Invite Code')
      await userEvent.type(input, '   ')

      // Submit the form directly (bypass HTML validation)
      const form = input.closest('form')!
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

      expect(mockRpc).not.toHaveBeenCalled()
      expect(mockOnComplete).not.toHaveBeenCalled()
    })

    it('does not submit create when family name is only whitespace', async () => {
      render(<FamilyStep onComplete={mockOnComplete} />)

      await userEvent.click(screen.getByText('Create new family'))

      // Type only spaces
      const input = screen.getByLabelText('Family Name')
      await userEvent.type(input, '   ')

      // Submit the form directly (bypass HTML validation)
      const form = input.closest('form')!
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

      expect(mockInsert).not.toHaveBeenCalled()
      expect(mockOnComplete).not.toHaveBeenCalled()
    })
  })

  describe('Error clearing', () => {
    it('clears error when navigating back from join mode', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'Not found' } })

      render(<FamilyStep onComplete={mockOnComplete} />)

      await userEvent.click(screen.getByText('Join existing family'))
      await userEvent.type(screen.getByLabelText('Invite Code'), 'BADCODE')
      await userEvent.click(screen.getByRole('button', { name: /join family/i }))

      await waitFor(() => {
        expect(screen.getByText(/invalid or expired invite code/i)).toBeInTheDocument()
      })

      await userEvent.click(screen.getByText('Back'))

      // Go back to join mode - error should be cleared
      await userEvent.click(screen.getByText('Join existing family'))
      expect(screen.queryByText(/invalid or expired invite code/i)).not.toBeInTheDocument()
    })
  })
})
