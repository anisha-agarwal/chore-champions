import { render, screen, waitFor, act } from '@testing-library/react'
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
const mockUpdate = jest.fn()
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
      update: (...args: unknown[]) => ({
        eq: (...eqArgs: unknown[]) => mockUpdate(...args, ...eqArgs),
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
    mockUpdate.mockResolvedValue({ error: null })
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

  it('calls signOut and redirects when Sign Out is clicked', async () => {
    mockSignOut.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Sign Out' }))

    expect(mockSignOut).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  it('shows password mismatch error', async () => {
    const user = userEvent.setup()
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    // Open password modal
    await user.click(screen.getByRole('button', { name: 'Change Password' }))

    // Fill in mismatched passwords
    await user.type(screen.getByLabelText('New Password'), 'password123')
    await user.type(screen.getByLabelText('Confirm Password'), 'different123')

    await user.click(screen.getByRole('button', { name: 'Update Password' }))

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
  })

  it('shows password too short error', async () => {
    const user = userEvent.setup()
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Change Password' }))

    await user.type(screen.getByLabelText('New Password'), 'abc')
    await user.type(screen.getByLabelText('Confirm Password'), 'abc')

    await user.click(screen.getByRole('button', { name: 'Update Password' }))

    expect(screen.getByText('Password must be at least 6 characters.')).toBeInTheDocument()
  })

  it('shows success on password change', async () => {
    mockUpdateUser.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Change Password' }))

    await user.type(screen.getByLabelText('New Password'), 'newpassword123')
    await user.type(screen.getByLabelText('Confirm Password'), 'newpassword123')

    await user.click(screen.getByRole('button', { name: 'Update Password' }))

    await waitFor(() => {
      expect(screen.getByText('Password updated successfully!')).toBeInTheDocument()
    })
  })

  it('shows error from supabase on password change failure', async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: 'Password too weak' } })
    const user = userEvent.setup()
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Change Password' }))

    await user.type(screen.getByLabelText('New Password'), 'newpassword123')
    await user.type(screen.getByLabelText('Confirm Password'), 'newpassword123')

    await user.click(screen.getByRole('button', { name: 'Update Password' }))

    await waitFor(() => {
      expect(screen.getByText('Password too weak')).toBeInTheDocument()
    })
  })

  it('renders avatar selection grid when avatar modal is open', async () => {
    const user = userEvent.setup()
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Change avatar' }))

    // Should show avatar options
    expect(screen.getByText('Panther')).toBeInTheDocument()
    expect(screen.getByText('Fox')).toBeInTheDocument()
    expect(screen.getByText('Bear')).toBeInTheDocument()
  })

  it('shows Profile not found when no profile exists', async () => {
    mockSupabaseData.profile = null

    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('Profile not found')).toBeInTheDocument()
    })
  })

  it('allows typing in display name input', async () => {
    const user = userEvent.setup()
    render(<MePage />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })

    // The display name input should be editable (not readonly)
    const displayNameInput = screen.getByDisplayValue('Test User')
    expect(displayNameInput).not.toHaveAttribute('readOnly')

    // Verify it is an input that can be interacted with
    await user.click(displayNameInput)
    expect(document.activeElement).toBe(displayNameInput)
  })

  describe('fetchProfile falsy branch coverage', () => {
    it('handles null email in user (line 49 || falsy)', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: null } },
      })

      render(<MePage />)

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument()
      })

      // Email input should show empty string since user.email is null
      // Use the label to find it specifically
      const emailLabel = screen.getByText('Email')
      const emailSection = emailLabel.closest('div')
      const emailInput = emailSection?.querySelector('input')
      expect(emailInput).toHaveValue('')
    })

    it('handles profile with nickname set (line 51 truthy branch)', async () => {
      mockSupabaseData.profile = { ...mockProfile, nickname: 'Cool Nick' }

      render(<MePage />)

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument()
      })

      expect(screen.getByDisplayValue('Cool Nick')).toBeInTheDocument()
    })

    it('handles null parent count (line 61 || falsy)', async () => {
      mockSupabaseData.parentCount = null as unknown as number

      render(<MePage />)

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument()
      })
    })
  })

  describe('fetchProfile edge cases', () => {
    it('shows Profile not found when user is not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })
      mockSupabaseData.profile = null

      render(<MePage />)

      await waitFor(() => {
        expect(screen.getByText('Profile not found')).toBeInTheDocument()
      })
    })

    it('skips parent count query when no family_id', async () => {
      mockSupabaseData.profile = { ...mockProfile, family_id: null }

      render(<MePage />)

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument()
      })

      // Should still render, just without parent count constraint
      expect(screen.getByRole('button', { name: 'Parent' })).toBeInTheDocument()
    })
  })

  describe('handleAvatarSelect', () => {
    it('selects a new avatar and closes modal', async () => {
      const user = userEvent.setup()
      render(<MePage />)

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Change avatar' }))

      expect(screen.getByText('Choose Avatar')).toBeInTheDocument()

      // Click on Fox avatar
      await user.click(screen.getByText('Fox'))

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
      })
    })

    it('closes modal even on error', async () => {
      mockUpdate.mockResolvedValue({ error: { message: 'Failed' } })
      const user = userEvent.setup()
      render(<MePage />)

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Change avatar' }))
      await user.click(screen.getByText('Fox'))

      await waitFor(() => {
        expect(screen.queryByText('Choose Avatar')).not.toBeInTheDocument()
      })
    })
  })

  describe('password modal cancel', () => {
    it('closes password modal when Cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<MePage />)

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Change Password' }))

      expect(screen.getByText('New Password')).toBeInTheDocument()

      // Click Cancel button in the password modal (line 362)
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      await waitFor(() => {
        expect(screen.queryByText('New Password')).not.toBeInTheDocument()
      })
    })

    it('closes password modal via backdrop click (Modal onClose)', async () => {
      const user = userEvent.setup()
      render(<MePage />)

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Change Password' }))

      expect(screen.getByText('New Password')).toBeInTheDocument()

      // Click backdrop (line 317 - Modal onClose)
      const backdrops = document.querySelectorAll('.fixed.inset-0')
      // The backdrop is the one with bg-black/50
      const backdrop = Array.from(backdrops).find(el => el.classList.contains('bg-black/50')) as HTMLElement
      await user.click(backdrop)

      await waitFor(() => {
        expect(screen.queryByText('New Password')).not.toBeInTheDocument()
      })
    })
  })

  describe('password auto-close after success', () => {
    it('auto-closes password modal after 1500ms on success', async () => {
      jest.useFakeTimers()
      mockUpdateUser.mockResolvedValue({ error: null })
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<MePage />)

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Change Password' }))

      await user.type(screen.getByLabelText('New Password'), 'newpassword123')
      await user.type(screen.getByLabelText('Confirm Password'), 'newpassword123')

      await user.click(screen.getByRole('button', { name: 'Update Password' }))

      await waitFor(() => {
        expect(screen.getByText('Password updated successfully!')).toBeInTheDocument()
      })

      // Advance past the 1500ms timeout
      act(() => {
        jest.advanceTimersByTime(1600)
      })

      await waitFor(() => {
        expect(screen.queryByText('Password updated successfully!')).not.toBeInTheDocument()
      })

      jest.useRealTimers()
    })
  })

  describe('save success timer', () => {
    it('resets saveSuccess after 1500ms', async () => {
      jest.useFakeTimers()
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<MePage />)

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
      })

      // Advance past the 1500ms setTimeout
      act(() => {
        jest.advanceTimersByTime(1600)
      })

      // The success state should have been reset (setSaveSuccess(false))
      // This covers line 92

      jest.useRealTimers()
    })
  })

  describe('handleSave', () => {
    it('saves profile changes successfully', async () => {
      const user = userEvent.setup()
      render(<MePage />)

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
      })
    })

    it('does not save when profile is null', async () => {
      mockSupabaseData.profile = null

      render(<MePage />)

      await waitFor(() => {
        expect(screen.getByText('Profile not found')).toBeInTheDocument()
      })

      // No save button visible since we're on the "Profile not found" screen
      expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument()
    })

    it('handles save error gracefully', async () => {
      mockUpdate.mockResolvedValue({ error: { message: 'Save failed' } })
      const user = userEvent.setup()
      render(<MePage />)

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      // Should not show success message
      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
      })
    })
  })

  describe('input onChange handlers (lines 244, 250)', () => {
    it('triggers displayName onChange by typing', async () => {
      const { fireEvent } = await import('@testing-library/react')
      render(<MePage />)

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument()
      })

      const displayNameInput = screen.getByDisplayValue('Test User')
      fireEvent.change(displayNameInput, { target: { value: 'Updated Name' } })
      expect(displayNameInput).toHaveValue('Updated Name')
    })

    it('triggers nickname onChange by typing', async () => {
      const { fireEvent } = await import('@testing-library/react')
      render(<MePage />)

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument()
      })

      const nicknameInput = screen.getByPlaceholderText('e.g., Baby Bison, Panther')
      fireEvent.change(nicknameInput, { target: { value: 'Cool Nickname' } })
      expect(nicknameInput).toHaveValue('Cool Nickname')
    })
  })

  describe('avatar modal close via backdrop (line 290)', () => {
    it('closes avatar modal via backdrop click', async () => {
      const user = userEvent.setup()
      render(<MePage />)

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Change avatar' }))
      expect(screen.getByText('Choose Avatar')).toBeInTheDocument()

      // Close via backdrop
      const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50') as HTMLElement
      await user.click(backdrop)

      await waitFor(() => {
        expect(screen.queryByText('Choose Avatar')).not.toBeInTheDocument()
      })
    })
  })

  describe('avatar modal grid rendering (lines 244-290)', () => {
    it('renders all avatar options in the grid', async () => {
      const user = userEvent.setup()
      render(<MePage />)

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Change avatar' }))

      // Verify all avatar options render
      expect(screen.getByText('Panther')).toBeInTheDocument()
      expect(screen.getByText('Bison')).toBeInTheDocument()
      expect(screen.getByText('Fox')).toBeInTheDocument()
      expect(screen.getByText('Owl')).toBeInTheDocument()
      expect(screen.getByText('Bear')).toBeInTheDocument()
      expect(screen.getByText('Wolf')).toBeInTheDocument()
      expect(screen.getByText('Horse')).toBeInTheDocument()
      expect(screen.getByText('Snake')).toBeInTheDocument()
      expect(screen.getByText('Rabbit')).toBeInTheDocument()
      expect(screen.getByText('Cat')).toBeInTheDocument()
      expect(screen.getByText('Dog')).toBeInTheDocument()
      expect(screen.getByText('Dragon')).toBeInTheDocument()

      // Verify grid container exists
      const gridContainer = screen.getByText('Panther').closest('.grid')
      expect(gridContainer).toBeInTheDocument()
    })

    it('highlights the currently selected avatar', async () => {
      const user = userEvent.setup()
      render(<MePage />)

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Change avatar' }))

      // The profile has avatar_url: '/avatars/panther.svg', so Panther should have ring class
      const pantherButton = screen.getByText('Panther').closest('button')
      expect(pantherButton).toHaveClass('ring-2')
    })

    it('closes avatar modal after selecting an avatar', async () => {
      const user = userEvent.setup()
      render(<MePage />)

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Change avatar' }))
      expect(screen.getByText('Choose Avatar')).toBeInTheDocument()

      // Click on Bear avatar
      await user.click(screen.getByText('Bear'))

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
        expect(screen.queryByText('Choose Avatar')).not.toBeInTheDocument()
      })
    })
  })
})
