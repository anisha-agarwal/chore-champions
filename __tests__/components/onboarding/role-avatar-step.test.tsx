import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RoleAvatarStep } from '@/components/onboarding/role-avatar-step'
import { AVATAR_OPTIONS } from '@/lib/types'

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string; src: string }) => <img alt={props.alt} src={props.src} />,
}))

// Mock Supabase client
const mockGetUser = jest.fn()
const mockUpdate = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: () => ({
      update: (...args: unknown[]) => ({
        eq: (...eqArgs: unknown[]) => mockUpdate(...args, ...eqArgs),
      }),
    }),
  }),
}))

describe('RoleAvatarStep', () => {
  const mockOnComplete = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockUpdate.mockResolvedValue({ error: null })
  })

  it('renders role selector with Parent and Kid buttons', () => {
    render(<RoleAvatarStep onComplete={mockOnComplete} />)

    expect(screen.getByText('I am a...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Parent' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kid' })).toBeInTheDocument()
  })

  it('renders heading and description', () => {
    render(<RoleAvatarStep onComplete={mockOnComplete} />)

    expect(screen.getByText('Choose Your Role & Avatar')).toBeInTheDocument()
    expect(screen.getByText(/pick your role and select an avatar/i)).toBeInTheDocument()
  })

  it('renders avatar grid with all AVATAR_OPTIONS', () => {
    render(<RoleAvatarStep onComplete={mockOnComplete} />)

    for (const avatar of AVATAR_OPTIONS) {
      expect(screen.getByAltText(avatar.name)).toBeInTheDocument()
    }
  })

  it('renders Continue button', () => {
    render(<RoleAvatarStep onComplete={mockOnComplete} />)

    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
  })

  it('highlights selected avatar with ring', async () => {
    render(<RoleAvatarStep onComplete={mockOnComplete} />)

    const pantherButton = screen.getByAltText('Panther').closest('button')!
    await userEvent.click(pantherButton)

    expect(pantherButton).toHaveClass('ring-2', 'ring-purple-600', 'bg-purple-50')
  })

  it('updates profile and calls onComplete on continue', async () => {
    render(<RoleAvatarStep onComplete={mockOnComplete} />)

    // Select an avatar
    const foxButton = screen.getByAltText('Fox').closest('button')!
    await userEvent.click(foxButton)

    // Click continue
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        { role: 'child', avatar_url: '/avatars/fox.svg' },
        'id',
        'user-1'
      )
      expect(mockOnComplete).toHaveBeenCalled()
    })
  })

  it('sends parent role when Parent is selected', async () => {
    render(<RoleAvatarStep onComplete={mockOnComplete} />)

    await userEvent.click(screen.getByRole('button', { name: 'Parent' }))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        { role: 'parent', avatar_url: null },
        'id',
        'user-1'
      )
    })
  })

  it('sends null avatar_url when no avatar selected', async () => {
    render(<RoleAvatarStep onComplete={mockOnComplete} />)

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        { role: 'child', avatar_url: null },
        'id',
        'user-1'
      )
    })
  })

  it('shows loading state during submission', async () => {
    mockUpdate.mockReturnValue(new Promise(() => {}))

    render(<RoleAvatarStep onComplete={mockOnComplete} />)

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument()
    })
  })

  it('shows error on profile update failure', async () => {
    mockUpdate.mockResolvedValue({ error: { message: 'Update failed' } })

    render(<RoleAvatarStep onComplete={mockOnComplete} />)

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(screen.getByText(/failed to save your profile/i)).toBeInTheDocument()
    })
    expect(mockOnComplete).not.toHaveBeenCalled()
  })

  it('shows error when user is not logged in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    render(<RoleAvatarStep onComplete={mockOnComplete} />)

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(screen.getByText(/you must be logged in/i)).toBeInTheDocument()
    })
    expect(mockOnComplete).not.toHaveBeenCalled()
  })

  it('renders all avatar names as text', () => {
    render(<RoleAvatarStep onComplete={mockOnComplete} />)

    for (const avatar of AVATAR_OPTIONS) {
      expect(screen.getByText(avatar.name)).toBeInTheDocument()
    }
  })

  it('displays choose your avatar label', () => {
    render(<RoleAvatarStep onComplete={mockOnComplete} />)

    expect(screen.getByText('Choose your avatar')).toBeInTheDocument()
  })
})
